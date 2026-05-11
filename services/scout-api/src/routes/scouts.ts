import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/client';

const kycUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDF are allowed for KYC documents'));
    }
  },
});

const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT_NAME!;

const router = Router();

const UpdateScoutSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  preferred_language: z.enum(['en', 'fr', 'sw', 'pt', 'ha', 'am']).optional(),
  wallet_mobile_money: z.string().optional(),
  wallet_provider: z.enum(['mpesa', 'mtn_momo', 'airtel_money', 'flutterwave']).optional(),
  fcm_token: z.string().max(512).optional(),
});

// GET /api/v1/scouts/me
router.get('/me', async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  const result = await db.query(
    `SELECT
      id, phone, full_name, status, country, district,
      preferred_language, wallet_provider,
      total_earnings_usd, pending_earnings_usd,
      report_count, validated_report_count, quality_score,
      badge_level, referral_code, onboarding_completed,
      kyc_status, created_at
    FROM scouts WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      type: 'https://afrixplore.io/errors/not-found',
      title: 'Scout Not Found',
      status: 404,
      detail: 'Scout profile not found',
    });
  }

  return res.json(result.rows[0]);
});

// PATCH /api/v1/scouts/me
router.patch('/me', async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const body = UpdateScoutSchema.parse(req.body);
    const fields = Object.entries(body);

    if (fields.length === 0) {
      return res.status(400).json({
        type: 'https://afrixplore.io/errors/validation',
        title: 'No fields to update',
        status: 400,
      });
    }

    const setClauses = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ');
    const values = [userId, ...fields.map(([, v]) => v)];

    await db.query(
      `UPDATE scouts SET ${setClauses}, updated_at = NOW() WHERE id = $1`,
      values
    );

    return res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        type: 'https://afrixplore.io/errors/validation',
        title: 'Validation Error',
        status: 400,
        errors: error.errors,
      });
    }
    throw error;
  }
});

// POST /api/v1/scouts/me/kyc
router.post('/me/kyc', kycUpload.single('document'), async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  if (!req.file) {
    return res.status(400).json({
      type: 'https://afrixplore.io/errors/validation',
      title: 'No document uploaded',
      status: 400,
      detail: 'Attach a KYC document as multipart/form-data field "document"',
    });
  }

  // Check for duplicate submission
  const existing = await db.query(
    `SELECT kyc_status FROM scouts WHERE id = $1`,
    [userId]
  );
  const kycStatus: string | null = existing.rows[0]?.kyc_status ?? null;
  if (kycStatus === 'approved') {
    return res.status(409).json({
      type: 'https://afrixplore.io/errors/conflict',
      title: 'KYC Already Approved',
      status: 409,
      detail: 'Your identity has already been verified',
    });
  }

  const ext = req.file.originalname.split('.').pop() || 'jpg';
  const blobName = `scouts/${userId}/kyc/${uuidv4()}.${ext}`;

  const credential = new DefaultAzureCredential();
  const blobServiceClient = new BlobServiceClient(
    `https://${STORAGE_ACCOUNT}.blob.core.windows.net`,
    credential
  );
  const containerClient = blobServiceClient.getContainerClient('kyc-docs');
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(req.file.buffer, {
    blobHTTPHeaders: { blobContentType: req.file.mimetype },
    metadata: { uploadedBy: userId },
  });

  const documentUrl = `https://${STORAGE_ACCOUNT}.blob.core.windows.net/kyc-docs/${blobName}`;

  await db.query(
    `UPDATE scouts SET
      kyc_document_url = $1,
      kyc_submitted_at = NOW(),
      kyc_status = 'submitted',
      updated_at = NOW()
    WHERE id = $2`,
    [documentUrl, userId]
  );

  return res.status(202).json({
    message: 'KYC document received and under review',
    kyc_status: 'submitted',
  });
});

export { router as scoutRouter };

export default router;

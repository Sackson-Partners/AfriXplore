import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client';

const router = Router();

const UpdateScoutSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  preferred_language: z.enum(['en', 'fr', 'sw', 'pt', 'ha', 'am']).optional(),
  wallet_mobile_money: z.string().optional(),
  wallet_provider: z.enum(['mpesa', 'mtn_momo', 'airtel_money', 'flutterwave']).optional(),
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

export { router as scoutRouter };

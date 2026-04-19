import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  initiatePhoneOTP,
  challengePhoneOTP,
  verifyPhoneOTP,
} from '../auth/entraOtp';
import { db } from '../db/client';

const router = Router();

const config = {
  scoutTenantId: process.env.ENTRA_SCOUT_TENANT_ID!,
  scoutClientId: process.env.ENTRA_SCOUT_CLIENT_ID!,
};

/**
 * @openapi
 * /scout/v1/auth/otp/initiate:
 *   post:
 *     summary: Initiate phone OTP
 *     description: Sends a 6-digit OTP to the scout's phone via Azure AD CIAM. Max 3 requests per 10 minutes.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone_number, country]
 *             properties:
 *               phone_number:
 *                 type: string
 *                 example: "+233501234567"
 *                 description: E.164 format
 *               country:
 *                 type: string
 *                 example: "GH"
 *     responses:
 *       200:
 *         description: OTP sent — returns continuation_token for /otp/verify
 *       429:
 *         description: Too many OTP requests
 */
router.post('/otp/initiate', async (req: Request, res: Response) => {
  const schema = z.object({
    phone_number: z.string()
      .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format (+254XXXXXXXXX)'),
    country: z.string().length(2).toUpperCase(),
  });

  try {
    const { phone_number, country } = schema.parse(req.body);

    // Rate limit: max 3 OTP requests per phone per 10 minutes
    const recentRequests = await db.query(
      `SELECT COUNT(*) as count FROM otp_attempts
       WHERE phone = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
      [phone_number]
    );

    if (parseInt(recentRequests.rows[0].count) >= 3) {
      return res.status(429).json({
        type: 'https://afrixplore.io/errors/rate-limited',
        title: 'Too Many OTP Requests',
        status: 429,
        detail: 'Maximum 3 OTP requests per 10 minutes. Please wait.',
      });
    }

    const result = await initiatePhoneOTP(
      phone_number,
      config.scoutTenantId,
      config.scoutClientId
    );

    const challenge = await challengePhoneOTP(
      result.continuationToken,
      config.scoutTenantId,
      config.scoutClientId
    );

    await db.query(
      `INSERT INTO otp_attempts (phone, country, created_at) VALUES ($1, $2, NOW())`,
      [phone_number, country]
    );

    const existingScout = await db.query(
      'SELECT id, status, kyc_status FROM scouts WHERE phone = $1',
      [phone_number]
    );

    return res.json({
      continuation_token: challenge.continuationToken,
      code_length: result.codeLength,
      resend_interval_seconds: result.allowedResendInterval,
      is_new_user: existingScout.rows.length === 0,
      message: `Verification code sent to ${phone_number}`,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        type: 'https://afrixplore.io/errors/validation',
        title: 'Validation Error',
        status: 400,
        errors: error.errors,
      });
    }
    process.stderr.write(JSON.stringify({ level: 'error', service: 'scout-api', ts: new Date().toISOString(), msg: 'OTP initiation error', error: (error as Error).message }) + '\n');
    return res.status(500).json({
      type: 'https://afrixplore.io/errors/otp-failed',
      title: 'OTP Send Failed',
      status: 500,
      detail: 'Failed to send verification code. Please try again.',
    });
  }
});

/**
 * @openapi
 * /scout/v1/auth/otp/verify:
 *   post:
 *     summary: Verify OTP and issue tokens
 *     description: Verifies the 6-digit code and returns access + refresh tokens. Creates or updates the scout record.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp, continuation_token, phone_number, country]
 *             properties:
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               continuation_token:
 *                 type: string
 *               phone_number:
 *                 type: string
 *               country:
 *                 type: string
 *                 example: "GH"
 *               preferred_language:
 *                 type: string
 *                 default: "en"
 *     responses:
 *       200:
 *         description: Tokens issued
 *       401:
 *         description: Invalid or expired OTP
 */
router.post('/otp/verify', async (req: Request, res: Response) => {
  const schema = z.object({
    otp: z.string().length(6).regex(/^\d{6}$/),
    continuation_token: z.string().min(1),
    phone_number: z.string(),
    country: z.string().length(2).toUpperCase(),
    preferred_language: z.string().default('en'),
  });

  try {
    const body = schema.parse(req.body);

    const tokens = await verifyPhoneOTP(
      body.otp,
      body.continuation_token,
      config.scoutTenantId,
      config.scoutClientId
    );

    const scoutResult = await db.query(
      `INSERT INTO scouts (
        phone, country, preferred_language,
        entra_object_id, status, kyc_status
      )
      VALUES ($1, $2, $3, $4, 'pending_kyc', 'pending')
      ON CONFLICT (phone) DO UPDATE SET
        entra_object_id = EXCLUDED.entra_object_id,
        updated_at = NOW()
      RETURNING id, status, kyc_status, onboarding_completed`,
      [
        body.phone_number,
        body.country,
        body.preferred_language,
        tokens.idToken,
      ]
    );

    const scout = scoutResult.rows[0];

    return res.json({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
      scout: {
        id: scout.id,
        status: scout.status,
        kyc_status: scout.kyc_status,
        onboarding_completed: scout.onboarding_completed,
        is_new_user: tokens.isNewUser,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        type: 'https://afrixplore.io/errors/validation',
        title: 'Validation Error',
        status: 400,
        errors: error.errors,
      });
    }

    const message = (error as Error).message;
    if (message.includes('invalid_grant') || message.includes('expired')) {
      return res.status(401).json({
        type: 'https://afrixplore.io/errors/invalid-otp',
        title: 'Invalid or Expired OTP',
        status: 401,
        detail: 'The verification code is incorrect or has expired.',
      });
    }

    return res.status(500).json({
      type: 'https://afrixplore.io/errors/verification-failed',
      title: 'Verification Failed',
      status: 500,
    });
  }
});

// POST /auth/token/refresh
router.post('/token/refresh', async (req: Request, res: Response) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token required' });
  }

  try {
    const response = await fetch(
      `https://${config.scoutTenantId}.ciamlogin.com/${config.scoutTenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.scoutClientId,
          grant_type: 'refresh_token',
          refresh_token,
          scope: 'openid profile offline_access',
        }),
      }
    );

    const data = await response.json();
    return res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
    });
  } catch {
    return res.status(401).json({ error: 'Token refresh failed' });
  }
});

export { router as authRouter };
export default router;

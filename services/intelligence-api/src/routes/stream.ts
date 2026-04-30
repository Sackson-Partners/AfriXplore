import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '@afrixplore/validation';

const router = Router();

const WebhookBodySchema = z.object({
  webhook_url: z.string().url('webhook_url must be a valid HTTPS URL').refine(
    (url) => url.startsWith('https://'),
    'webhook_url must use HTTPS'
  ),
  dpi_threshold: z.coerce.number().int().min(0).max(100).default(70),
  minerals: z.union([z.array(z.string().max(50)), z.literal('all')]).default('all'),
});

router.get('/negotiate', async (req: Request, res: Response) => {
  const subscriberId   = req.headers['x-subscriber-id'] as string;
  const subscriberTier = req.headers['x-subscriber-tier'] as string;

  if (!['professional', 'enterprise', 'government_dfi'].includes(subscriberTier)) {
    return res.status(403).json({
      type: 'https://afrixplore.io/errors/upgrade-required',
      title: 'Professional Tier Required',
      status: 403,
      detail: 'Real-time streams require Professional tier or above.',
      upgrade_url: 'https://platform.afrixplore.io/upgrade',
    });
  }

  return res.json({
    hub_url: process.env.AZURE_SIGNALR_URL,
    hub_name: 'dashboard-hub',
    access_token: await generateSignalRToken(subscriberId),
    subscriber_id: subscriberId,
    tier: subscriberTier,
  });
});

async function generateSignalRToken(userId: string): Promise<string> {
  return `${userId}-${Date.now()}`;
}

router.post('/webhook', validate(WebhookBodySchema, 'body'), async (req: Request, res: Response) => {
  const subscriberId = req.headers['x-subscriber-id'] as string;
  const { webhook_url, dpi_threshold, minerals } = req.body as z.infer<typeof WebhookBodySchema>;

  try {
    const testResponse = await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'webhook.test',
        timestamp: new Date().toISOString(),
        message: 'AfriXplore webhook verification',
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!testResponse.ok) {
      return res.status(400).json({
        type: 'https://afrixplore.io/errors/webhook-unreachable',
        title: 'Webhook Unreachable',
        status: 400,
        detail: `Webhook returned HTTP ${testResponse.status}`,
      });
    }
  } catch {
    return res.status(400).json({
      type: 'https://afrixplore.io/errors/webhook-unreachable',
      title: 'Webhook Unreachable',
      status: 400,
      detail: 'Could not reach webhook URL within 5 seconds',
    });
  }

  const { db } = await import('../db/client');
  await db.query(
    `UPDATE subscribers
     SET webhook_url = $1, dpi_alert_threshold = $2, updated_at = NOW()
     WHERE id = $3`,
    [webhook_url, dpi_threshold, subscriberId]
  );

  return res.json({
    status: 'configured',
    webhook_url,
    dpi_threshold,
    minerals,
    test_sent: true,
  });
});

export { router as streamRouter };

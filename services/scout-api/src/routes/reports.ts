import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { ServiceBusClient } from '@azure/service-bus';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────

const CreateReportSchema = z.object({
  mineral_type: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  working_type: z
    .enum(['alluvial', 'open_pit', 'shallow_shaft', 'deep_shaft', 'tunnel', 'surface_pick', 'unknown'])
    .optional(),
  depth_estimate_m: z.number().positive().optional(),
  volume_estimate: z.string().optional(),
  notes: z.string().optional(),
  photo_uris: z.array(z.string()).max(5).optional(),
  audio_uri: z.string().optional(),
  country: z.string().length(2),
  district: z.string().optional(),
  device_id: z.string().optional(),
  mine_id: z.string().uuid().optional(),
  offline_created_at: z.string().datetime().optional(),
});

const StatusUpdateSchema = z.object({
  status: z.enum(['under_review', 'validated', 'rejected', 'escalated']),
});

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
  mineral_type: z.string().optional(),
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function problem(res: Response, status: number, title: string, detail?: string) {
  return res.status(status).json({
    type: `https://afrixplore.io/errors/${status === 404 ? 'not-found' : status === 403 ? 'forbidden' : 'validation'}`,
    title,
    status,
    ...(detail ? { detail } : {}),
  });
}

// ─── POST /api/v1/reports ─────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  let body: z.infer<typeof CreateReportSchema>;
  try {
    body = CreateReportSchema.parse(req.body);
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

  const reportId = uuidv4();

  const result = await db.query(
    `INSERT INTO reports (
      id, scout_id, location, mineral_type, working_type,
      depth_estimate_m, volume_estimate, notes,
      photo_uris, audio_uri, country, district,
      device_id, mine_id, location_source,
      status, source, offline_created_at, created_at, updated_at
    ) VALUES (
      $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326),
      $5, $6, $7, $8, $9,
      $10, $11, $12, $13,
      $14, $15, 'gps',
      'pending', 'app', $16, NOW(), NOW()
    )
    RETURNING id, status, created_at, offline_created_at`,
    [
      reportId,
      userId,
      body.longitude,
      body.latitude,
      body.mineral_type,
      body.working_type ?? null,
      body.depth_estimate_m ?? null,
      body.volume_estimate ?? null,
      body.notes ?? null,
      body.photo_uris ?? null,
      body.audio_uri ?? null,
      body.country,
      body.district ?? null,
      body.device_id ?? null,
      body.mine_id ?? null,
      body.offline_created_at ?? null,
    ]
  );

  const row = result.rows[0];

  // Best-effort Service Bus publish — AI pipeline can re-derive from DB on failure
  const sbConn = process.env.SERVICE_BUS_CONNECTION_STRING;
  if (sbConn) {
    const sbClient = new ServiceBusClient(sbConn);
    const sender = sbClient.createSender('reports-ingested');
    sender
      .sendMessages({ body: { reportId, scoutId: userId, mineralType: body.mineral_type, source: 'app' } })
      .then(() => sender.close().then(() => sbClient.close()))
      .catch((err) => process.stdout.write(
        JSON.stringify({ level: 'error', service: 'scout-api', ts: new Date().toISOString(), msg: 'Service Bus publish failed', topic: 'reports-ingested', reportId, err: (err as Error).message }) + '\n'
      ));
  }

  return res.status(201).json({ id: row.id, status: row.status, created_at: row.created_at });
});

// ─── GET /api/v1/reports/stats ────────────────────────────────────────────────
// Must be declared before /:id to avoid 'stats' being treated as a UUID param
router.get('/stats', async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  const result = await db.query(
    `SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'validated') AS validated,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
      COALESCE(SUM(reward_usd) FILTER (WHERE reward_paid = true), 0) AS total_earned_usd,
      COALESCE(SUM(reward_usd) FILTER (WHERE reward_paid = false AND status = 'validated'), 0) AS pending_payout_usd
    FROM reports WHERE scout_id = $1`,
    [userId]
  );

  return res.json(result.rows[0]);
});

// ─── GET /api/v1/reports ──────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  let query: z.infer<typeof ListQuerySchema>;
  try {
    query = ListQuerySchema.parse(req.query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        type: 'https://afrixplore.io/errors/validation',
        title: 'Validation Error',
        status: 400,
        errors: (error as z.ZodError).errors,
      });
    }
    throw error;
  }

  const { page, page_size, status, mineral_type } = query;
  const offset = (page - 1) * page_size;

  const conditions: string[] = ['scout_id = $1'];
  const values: unknown[] = [userId];
  let paramIdx = 2;

  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    values.push(status);
  }
  if (mineral_type) {
    conditions.push(`mineral_type = $${paramIdx++}`);
    values.push(mineral_type);
  }

  const where = conditions.join(' AND ');

  const [dataResult, countResult] = await Promise.all([
    db.query(
      `SELECT
        id, mineral_type, working_type, depth_estimate_m, volume_estimate,
        country, district, notes, status, sync_status,
        reward_usd, reward_paid, source,
        photo_uris, audio_uri, confidence_score,
        validated_at, created_at, updated_at
      FROM reports
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...values, page_size, offset]
    ),
    db.query(`SELECT COUNT(*) AS total FROM reports WHERE ${where}`, values),
  ]);

  const total = parseInt(countResult.rows[0].total, 10);

  return res.json({
    data: dataResult.rows,
    total,
    page,
    page_size,
    has_next: offset + dataResult.rows.length < total,
  });
});

// ─── GET /api/v1/reports/:id ──────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { id } = req.params;

  const result = await db.query(
    `SELECT
      id, scout_id, mineral_type, working_type, depth_estimate_m, volume_estimate,
      country, district, notes, status, sync_status, device_id,
      reward_usd, reward_paid, source,
      photo_uris, audio_uri, confidence_score,
      mine_id, validated_by, validated_at, created_at, updated_at
    FROM reports WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return problem(res, 404, 'Report Not Found', 'No report found with the given id');
  }

  const report = result.rows[0];
  if (report.scout_id !== userId) {
    return problem(res, 403, 'Forbidden', 'You do not have access to this report');
  }

  return res.json(report);
});

// ─── PATCH /api/v1/reports/:id/status ────────────────────────────────────────
router.patch('/:id/status', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { id } = req.params;

  let body: z.infer<typeof StatusUpdateSchema>;
  try {
    body = StatusUpdateSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        type: 'https://afrixplore.io/errors/validation',
        title: 'Validation Error',
        status: 400,
        errors: (error as z.ZodError).errors,
      });
    }
    throw error;
  }

  // Verify report exists and fetch ownership + current status
  const existing = await db.query('SELECT id, scout_id, status, reward_usd FROM reports WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    return problem(res, 404, 'Report Not Found', 'No report found with the given id');
  }

  // Scouts cannot change the status of their own reports — prevents self-validation.
  // Only admin/validator roles (issued outside CIAM) may drive status transitions.
  const SCOUT_BLOCKED_STATUSES = ['under_review', 'validated', 'rejected', 'escalated'];
  if (
    SCOUT_BLOCKED_STATUSES.includes(body.status) &&
    existing.rows[0].scout_id === userId
  ) {
    return problem(res, 403, 'Forbidden', 'Scouts cannot change the status of their own reports');
  }

  // Enforce valid status transitions — prevents e.g. rejected → validated
  const currentStatus: string = existing.rows[0].status;
  const VALID_TRANSITIONS: Record<string, string[]> = {
    pending:      ['under_review', 'rejected'],
    under_review: ['validated', 'rejected', 'escalated'],
    escalated:    ['validated', 'rejected', 'under_review'],
    validated:    [],
    rejected:     [],
  };
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(body.status)) {
    return problem(res, 409, 'Invalid Status Transition',
      `Cannot transition from '${currentStatus}' to '${body.status}'`);
  }

  const isValidated = body.status === 'validated';
  const isRejected = body.status === 'rejected';

  // C7: Look up finder fee from reward_rules (falls back to 'default' row = $2.50)
  let rewardUsd: number | null = existing.rows[0].reward_usd;
  if (isValidated && (rewardUsd === null || rewardUsd === undefined)) {
    const reportRow = await db.query(`SELECT mineral_type FROM reports WHERE id = $1`, [id]);
    const mineralType = reportRow.rows[0]?.mineral_type ?? 'other';
    const ruleRow = await db.query(
      `SELECT finder_fee_usd FROM reward_rules WHERE mineral_type = $1
       UNION ALL
       SELECT finder_fee_usd FROM reward_rules WHERE mineral_type = 'default'
       LIMIT 1`,
      [mineralType]
    );
    rewardUsd = parseFloat(ruleRow.rows[0]?.finder_fee_usd ?? '2.50');
  }

  // Build update query
  let updateSql: string;
  let updateValues: unknown[];

  if (isValidated) {
    updateSql = `
      UPDATE reports
      SET status = $1,
          validated_by = $2,
          validated_at = NOW(),
          reward_usd = COALESCE(reward_usd, $3),
          updated_at = NOW()
      WHERE id = $4
      RETURNING id, status, validated_by, validated_at, reward_usd, updated_at
    `;
    updateValues = [body.status, userId, rewardUsd ?? 2.50, id];
  } else {
    updateSql = `
      UPDATE reports
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, status, updated_at
    `;
    updateValues = [body.status, id];
  }

  const updateResult = await db.query(updateSql, updateValues);
  const updatedRow = updateResult.rows[0];

  // If validated or rejected, update scout counters, quality_score, and badge level (C2, C3)
  if (isValidated || isRejected) {
    const effectiveReward = isValidated ? (updatedRow.reward_usd ?? rewardUsd ?? 2.50) : 0;

    // C3: quality_score: +1.0 on validation, −0.5 on rejection (floor 0)
    // C2: badge_level thresholds: 10 → silver, 50 → gold, 200 → platinum
    await db.query(
      `UPDATE scouts SET
        validated_report_count = validated_report_count + $1,
        pending_earnings_usd = pending_earnings_usd + $2,
        quality_score = GREATEST(0, quality_score + $3),
        badge_level = CASE
          WHEN (validated_report_count + $1) >= 200 THEN 'platinum'
          WHEN (validated_report_count + $1) >= 50  THEN 'gold'
          WHEN (validated_report_count + $1) >= 10  THEN 'silver'
          ELSE badge_level
        END
      WHERE id = (SELECT scout_id FROM reports WHERE id = $4)`,
      [
        isValidated ? 1 : 0,
        effectiveReward,
        isValidated ? 1.0 : -0.5,
        id,
      ]
    );

    // Payment trigger — only for validated reports. Must be awaited.
    const sbConn = isValidated ? process.env.SERVICE_BUS_CONNECTION_STRING : undefined;
    if (sbConn) {
      const scoutResult = await db.query(
        `SELECT scout_id FROM reports WHERE id = $1`,
        [id]
      );
      const scoutId = scoutResult.rows[0]?.scout_id;
      const effectiveRewardSb = updatedRow.reward_usd ?? 2.50;

      const sbClient = new ServiceBusClient(sbConn);
      const sender = sbClient.createSender('payment-triggered');
      try {
        await sender.sendMessages({
          body: {
            type: 'finder_fee',
            scoutId,
            reportId: id,
            amountUsd: effectiveRewardSb,
            reason: 'report_validated',
          },
          contentType: 'application/json',
        });
      } catch (err) {
        process.stdout.write(
          JSON.stringify({ level: 'error', service: 'scout-api', ts: new Date().toISOString(), msg: 'Payment trigger publish failed', reportId: id, scoutId, err: (err as Error).message }) + '\n'
        );
        return res.status(503).json({
          type: 'https://afrixplore.io/errors/service-unavailable',
          title: 'Service Unavailable',
          status: 503,
          detail: 'Payment trigger could not be queued. Please retry.',
        });
      } finally {
        await sender.close().catch(() => {});
        await sbClient.close().catch(() => {});
      }
    }
  }

  return res.json(updatedRow);
});

export { router as reportRouter };

export default router;

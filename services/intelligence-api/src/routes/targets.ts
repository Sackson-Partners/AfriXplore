import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate, BboxSchema } from '@afrixplore/validation';
import { db } from '../db/client';

const router = Router();

const TargetsQuerySchema = z.object({
  mineral: z.string().max(100).optional(),
  confidence_level: z.enum(['low', 'medium', 'high', 'very_high']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  bbox: BboxSchema.optional(),
});

router.get('/', validate(TargetsQuerySchema, 'query'), async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { mineral, confidence_level, limit, bbox } = req.query as unknown as z.infer<typeof TargetsQuerySchema>;

  let query = `
    SELECT
      t.id, t.target_type, t.confidence_level, t.dominant_mineral,
      t.estimated_grade, t.estimated_tonnage, t.licence_status,
      t.dpi_score, t.created_at,
      ST_Y(t.location::geometry) as latitude,
      ST_X(t.location::geometry) as longitude,
      ac.report_count, ac.scout_count, ac.trend
    FROM targets t
    JOIN anomaly_clusters ac ON ac.id = t.cluster_id
    WHERE (t.assigned_to IS NULL OR t.assigned_to = (
      SELECT id FROM subscribers WHERE entra_object_id = $1
    ))
  `;

  const params: (string | number | null)[] = [userId];
  let idx = 2;

  if (mineral) {
    query += ` AND t.dominant_mineral ILIKE $${idx}`;
    params.push(`%${mineral}%`);
    idx++;
  }

  if (confidence_level) {
    query += ` AND t.confidence_level = $${idx}`;
    params.push(confidence_level);
    idx++;
  }

  if (bbox) {
    const [minLon, minLat, maxLon, maxLat] = (bbox as string).split(',').map(Number);
    query += ` AND ST_Within(t.location::geometry, ST_MakeEnvelope($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, 4326))`;
    params.push(minLon, minLat, maxLon, maxLat);
    idx += 4;
  }

  query += ` ORDER BY t.dpi_score DESC LIMIT $${idx}`;
  params.push(limit);

  const result = await db.query(query, params);
  return res.json({ data: result.rows, count: result.rows.length });
});

export { router as targetsRouter };

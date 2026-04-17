import { Router, Request, Response } from 'express';
import { db } from '../db/client';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { mineral, confidence_level, limit = 50 } = req.query;

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

  const params: any[] = [userId];
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

  query += ` ORDER BY t.dpi_score DESC LIMIT $${idx}`;
  params.push(Math.min(Number(limit), 200));

  const result = await db.query(query, params);
  return res.json({ data: result.rows, count: result.rows.length });
});

export { router as targetsRouter };

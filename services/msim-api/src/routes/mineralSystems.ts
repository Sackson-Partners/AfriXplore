import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate, BboxSchema } from '@afrixplore/validation';
import { db } from '../db/client';

const router = Router();

const MineralSystemsQuerySchema = z.object({
  type: z.string().max(100).optional(),
  bbox: BboxSchema.optional(),
});

router.get('/', validate(MineralSystemsQuerySchema, 'query'), async (req: Request, res: Response) => {
  const { type, bbox } = req.query as unknown as z.infer<typeof MineralSystemsQuerySchema>;

  let query = `SELECT id, name, type, age_ma, prospectivity_score, known_deposits, ST_AsGeoJSON(boundary) as boundary_geojson FROM mineral_systems WHERE 1=1`;
  const params: (string | number)[] = [];
  let idx = 1;

  if (type) {
    query += ` AND type ILIKE $${idx}`;
    params.push(`%${type}%`);
    idx++;
  }

  if (bbox) {
    const [minLon, minLat, maxLon, maxLat] = (bbox as string).split(',').map(Number);
    query += ` AND ST_Intersects(boundary::geometry, ST_MakeEnvelope($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, 4326))`;
    params.push(minLon, minLat, maxLon, maxLat);
    idx += 4;
  }

  const result = await db.query(query, params);
  return res.json({ data: result.rows, count: result.rows.length });
});

export { router as mineralSystemsRouter };

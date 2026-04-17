import { Router, Request, Response } from 'express';
import { db } from '../db/client';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { bbox, commodity, limit = 200 } = req.query;

  let query = `
    SELECT id, name, country, region, primary_commodity, secondary_commodities,
      ST_Y(location::geometry) as latitude,
      ST_X(location::geometry) as longitude,
      operation_start_year, operation_end_year, is_active
    FROM historical_mines WHERE 1=1
  `;

  const params: any[] = [];
  let idx = 1;

  if (bbox) {
    const [minLon, minLat, maxLon, maxLat] = (bbox as string).split(',').map(Number);
    query += ` AND ST_Within(location::geometry, ST_MakeEnvelope($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, 4326))`;
    params.push(minLon, minLat, maxLon, maxLat);
    idx += 4;
  }

  if (commodity) {
    query += ` AND primary_commodity ILIKE $${idx}`;
    params.push(`%${commodity}%`);
    idx++;
  }

  query += ` ORDER BY name LIMIT $${idx}`;
  params.push(Math.min(Number(limit), 1000));

  const result = await db.query(query, params);
  return res.json({ data: result.rows, count: result.rows.length });
});

export { router as minesRouter };

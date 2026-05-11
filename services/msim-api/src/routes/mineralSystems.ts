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

// GET /api/v1/mineral-systems/:id/clusters
// Returns anomaly clusters whose centroid falls within the mineral system boundary.
// Used by the platform-web map overlay.
router.get('/:id/clusters', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Verify mineral system exists
  const msResult = await db.query(
    `SELECT id, name FROM mineral_systems WHERE id = $1`,
    [id]
  );
  if (msResult.rows.length === 0) {
    return res.status(404).json({
      type: 'https://afrixplore.io/errors/not-found',
      title: 'Mineral System Not Found',
      status: 404,
    });
  }

  const clustersResult = await db.query(
    `SELECT
      ac.id,
      ac.dominant_mineral,
      ac.report_count,
      ac.dpi_score,
      ac.dispatch_priority,
      ac.radius_km,
      ac.cluster_key,
      ac.last_updated,
      ST_AsGeoJSON(ac.centroid) AS centroid_geojson,
      ST_AsGeoJSON(ac.convex_hull) AS hull_geojson
    FROM anomaly_clusters ac
    JOIN mineral_systems ms ON ms.id = $1
    WHERE ST_Within(ac.centroid::geometry, ms.boundary::geometry)
    ORDER BY ac.dpi_score DESC`,
    [id]
  );

  return res.json({
    mineral_system_id: id,
    mineral_system_name: msResult.rows[0].name,
    data: clustersResult.rows,
    count: clustersResult.rows.length,
  });
});

export { router as mineralSystemsRouter };

import { Router, Request, Response } from 'express';
import { db } from '../db/client';

const router = Router();

// GET /api/v1/export/clusters?country=ZM&format=geojson
router.get('/clusters', async (req: Request, res: Response) => {
  const { country, mineral, format = 'json' } = req.query;

  try {
    let query = `
      SELECT
        id,
        ST_AsGeoJSON(centroid)::json AS centroid_geojson,
        ST_AsGeoJSON(bounding_box)::json AS bbox_geojson,
        dominant_mineral,
        report_count,
        dpi_score,
        country,
        dispatch_priority,
        status,
        last_updated
      FROM anomaly_clusters
      WHERE status != 'closed'
    `;
    const params: (string | undefined)[] = [];

    if (country) {
      params.push(country as string);
      query += ` AND country = $${params.length}`;
    }
    if (mineral) {
      params.push(mineral as string);
      query += ` AND dominant_mineral ILIKE $${params.length}`;
    }

    query += ' ORDER BY dpi_score DESC NULLS LAST LIMIT 5000';

    const result = await db.query(query, params);

    if (format === 'geojson') {
      return res.json({
        type: 'FeatureCollection',
        features: result.rows.map((r) => ({
          type: 'Feature',
          geometry: r.centroid_geojson,
          properties: {
            id: r.id,
            dominant_mineral: r.dominant_mineral,
            report_count: r.report_count,
            dpi_score: r.dpi_score,
            country: r.country,
            dispatch_priority: r.dispatch_priority,
            status: r.status,
            last_updated: r.last_updated,
          },
        })),
      });
    }

    return res.json({ data: result.rows, count: result.rows.length });
  } catch (err) {
    process.stderr.write(JSON.stringify({ level: 'error', service: 'intelligence-api', ts: new Date().toISOString(), msg: 'Export error', error: String(err) }) + '\n');
    return res.status(500).json({ error: 'Export failed' });
  }
});

export { router as exportRouter };
export default router;

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client';

const router = Router();

/**
 * @openapi
 * /api/v1/clusters:
 *   get:
 *     summary: List anomaly clusters
 *     description: Returns paginated mineral anomaly clusters filtered by subscriber's licensed territories and DPI threshold.
 *     tags: [Clusters]
 *     parameters:
 *       - in: query
 *         name: min_dpi
 *         schema: { type: integer, default: 0, minimum: 0, maximum: 100 }
 *         description: Minimum Deposit Potential Index score
 *       - in: query
 *         name: mineral
 *         schema: { type: string }
 *         example: gold
 *       - in: query
 *         name: country
 *         schema: { type: string }
 *         example: GH
 *       - in: query
 *         name: bbox
 *         schema: { type: string }
 *         description: "Bounding box: west,south,east,north"
 *         example: "-3.5,4.5,1.0,11.5"
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: Pagination cursor (ISO timestamp of last item)
 *     responses:
 *       200:
 *         description: Cluster list with next_cursor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AnomalyCluster'
 *                 next_cursor:
 *                   type: string
 *                   nullable: true
 *       401:
 *         $ref: '#/components/schemas/Error'
 */
router.get('/', async (req: Request, res: Response) => {
  const subscriberId   = req.headers['x-subscriber-id'] as string;
  const subscriberTier = req.headers['x-subscriber-tier'] as string;
  const territories    = req.headers['x-licensed-territories'] as string;

  const schema = z.object({
    min_dpi:       z.coerce.number().min(0).max(100).default(0),
    mineral:       z.string().optional(),
    status:        z.string().optional(),
    country:       z.string().optional(),
    bbox:          z.string().optional(),
    cursor:        z.string().optional(),
    limit:         z.coerce.number().min(1).max(100).default(50),
    data_lag_days: z.coerce.number().default(0),
  });

  try {
    const params = schema.parse(req.query);

    let spatialFilter = '';
    const queryParams: any[] = [subscriberId, params.min_dpi];
    let paramIdx = 3;

    if (params.bbox) {
      const [minLon, minLat, maxLon, maxLat] = params.bbox.split(',').map(Number);
      spatialFilter += ` AND ST_Within(
        ac.centroid::geometry,
        ST_MakeEnvelope($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, 4326)
      )`;
      queryParams.push(minLon, minLat, maxLon, maxLat);
      paramIdx += 4;
    }

    if (params.mineral) {
      spatialFilter += ` AND ac.dominant_mineral = $${paramIdx}`;
      queryParams.push(params.mineral);
      paramIdx++;
    }

    if (params.status) {
      spatialFilter += ` AND ac.status = $${paramIdx}`;
      queryParams.push(params.status);
      paramIdx++;
    }

    if (params.country) {
      spatialFilter += ` AND ac.country = $${paramIdx}`;
      queryParams.push(params.country);
      paramIdx++;
    }

    if (params.data_lag_days > 0) {
      spatialFilter += ` AND ac.last_updated < NOW() - ($${paramIdx} * INTERVAL '1 day')`;
      queryParams.push(Math.floor(params.data_lag_days));
      paramIdx++;
    }

    const territoryFilter = territories
      ? `AND ST_Within(
           ac.centroid::geometry,
           (SELECT ST_Union(licensed_territories::geometry) FROM subscribers WHERE id = $1)
         )`
      : '';

    if (params.cursor) {
      spatialFilter += ` AND ac.last_updated < $${paramIdx}`;
      queryParams.push(params.cursor);
      paramIdx++;
    }

    queryParams.push(params.limit);

    const result = await db.query(
      `SELECT
        ac.id,
        ac.status,
        ac.dpi_score,
        ac.dominant_mineral,
        ac.report_count,
        ac.scout_count,
        ac.trend,
        ac.country,
        ac.district,
        ac.first_seen,
        ac.last_updated,
        ac.radius_km,
        ST_Y(ac.centroid::geometry) AS latitude,
        ST_X(ac.centroid::geometry) AS longitude,
        CASE WHEN $2::numeric = 0 THEN
          round(ST_Y(ac.centroid::geometry)::numeric, 1)
        ELSE
          ST_Y(ac.centroid::geometry)
        END AS display_latitude,
        CASE WHEN $2::numeric = 0 THEN
          round(ST_X(ac.centroid::geometry)::numeric, 1)
        ELSE
          ST_X(ac.centroid::geometry)
        END AS display_longitude,
        ac.mineral_diversity
       FROM anomaly_clusters ac
       WHERE ac.dpi_score >= $2
         ${territoryFilter}
         ${spatialFilter}
       ORDER BY ac.last_updated DESC
       LIMIT $${paramIdx - 1}`,
      queryParams
    );

    return res.json({
      data: result.rows,
      count: result.rows.length,
      tier: subscriberTier,
      next_cursor:
        result.rows.length === params.limit
          ? result.rows[result.rows.length - 1]?.last_updated
          : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        type: 'https://afrixplore.io/errors/validation',
        title: 'Invalid query parameters',
        status: 400,
        errors: error.issues,
      });
    }
    throw error;
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await db.query(
    `SELECT
      ac.*,
      ST_Y(ac.centroid::geometry)  AS latitude,
      ST_X(ac.centroid::geometry)  AS longitude,
      ST_AsGeoJSON(ac.convex_hull) AS hull_geojson,
      (
        SELECT json_agg(r_summary ORDER BY r_summary.created_at DESC)
        FROM (
          SELECT r.id, r.mineral_type, r.working_type, r.status, r.created_at, r.ai_confidence
          FROM reports r
          WHERE r.cluster_id = ac.id
          ORDER BY r.created_at DESC
          LIMIT 10
        ) r_summary
      ) AS recent_reports,
      (
        SELECT json_agg(fv_summary ORDER BY fv_summary.visit_date DESC)
        FROM (
          SELECT fv.id, fv.visit_date, fv.outcome, fv.pxrf_results, fv.staking_initiated
          FROM field_visits fv
          WHERE fv.cluster_id = ac.id
          ORDER BY fv.visit_date DESC
          LIMIT 5
        ) fv_summary
      ) AS field_visits
     FROM anomaly_clusters ac
     WHERE ac.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      type: 'https://afrixplore.io/errors/not-found',
      title: 'Cluster Not Found',
      status: 404,
      detail: `Cluster ${id} not found`,
    });
  }

  return res.json(result.rows[0]);
});

router.get('/:id/geojson', async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await db.query(
    `SELECT
      json_build_object(
        'type', 'FeatureCollection',
        'features', json_agg(
          json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(r.location)::json,
            'properties', json_build_object(
              'id', r.id,
              'mineral_type', r.mineral_type,
              'status', r.status,
              'ai_confidence', r.ai_confidence,
              'created_at', r.created_at
            )
          )
        )
      ) AS geojson
     FROM reports r
     WHERE r.cluster_id = $1
       AND r.status = 'validated'`,
    [id]
  );

  res.setHeader('Content-Type', 'application/geo+json');
  res.setHeader('Content-Disposition', `attachment; filename="cluster-${id}-reports.geojson"`);
  return res.json(result.rows[0]?.geojson || { type: 'FeatureCollection', features: [] });
});

export { router as clustersRouter };

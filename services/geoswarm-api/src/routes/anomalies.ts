import { Router, Request, Response, NextFunction } from 'express';
import { ServiceBusClient } from '@azure/service-bus';
import { getPool } from '@ain/database';
import { requireAuth } from '@ain/auth';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

// GET /anomalies — list with pagination
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200);
    const offset = parseInt(String(req.query.offset ?? '0'), 10);

    try {
      const pool = getPool();
      const [dataResult, countResult] = await Promise.all([
        pool.query(
          `SELECT * FROM geoswarm_anomalies ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
        pool.query(`SELECT COUNT(*) AS total FROM geoswarm_anomalies`),
      ]);
      res.status(200).json({
        data: dataResult.rows,
        total: parseInt(countResult.rows[0]?.total ?? '0', 10),
        limit,
        offset,
      });
    } catch (dbErr) {
      const pg = dbErr as { code?: string };
      if (pg.code === '42P01') {
        res.status(200).json({ data: [], total: 0, limit, offset });
      } else {
        throw dbErr;
      }
    }
  } catch (err) {
    next(err);
  }
});

// GET /anomalies/:id — single anomaly
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`SELECT * FROM geoswarm_anomalies WHERE id = $1`, [req.params.id]);
    if (!result.rows.length) {
      next(createError(404, 'Not Found', `Anomaly ${req.params.id} not found`));
      return;
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    const pg = err as { code?: string };
    if (pg.code === '42P01') {
      next(createError(404, 'Not Found', `Anomaly ${req.params.id} not found`));
    } else {
      next(err);
    }
  }
});

// POST /anomalies — create a new anomaly and trigger convergence recomputation
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      survey_id,
      mine_id,
      anomaly_type,
      confidence_pct,
      severity,
      location_geojson,
      description,
      metadata,
    } = req.body as {
      survey_id?: string;
      mine_id?: string;
      anomaly_type: string;
      confidence_pct: number;
      severity?: string;
      location_geojson?: object;
      description?: string;
      metadata?: object;
    };

    if (!anomaly_type || confidence_pct == null) {
      next(createError(400, 'Bad Request', 'anomaly_type and confidence_pct are required'));
      return;
    }

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO geoswarm_anomalies
         (survey_id, mine_id, anomaly_type, confidence_pct, severity,
          location, description, metadata)
       VALUES ($1, $2, $3, $4, $5,
               CASE WHEN $6::text IS NOT NULL
                    THEN ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)
                    ELSE NULL END,
               $7, $8)
       RETURNING *`,
      [
        survey_id ?? null,
        mine_id ?? null,
        anomaly_type,
        confidence_pct,
        severity ?? 'medium',
        location_geojson ? JSON.stringify(location_geojson) : null,
        description ?? null,
        metadata ? JSON.stringify(metadata) : null,
      ],
    );

    const anomaly = result.rows[0];

    // Publish event so convergence-engine recomputes the score
    const sbConn = process.env.SERVICE_BUS_CONNECTION_STRING;
    if (sbConn && mine_id) {
      try {
        const sbClient = new ServiceBusClient(sbConn);
        const sender = sbClient.createSender('anomaly-detected');
        await sender.sendMessages({
          body: {
            anomaly_id: anomaly.id,
            mine_id,
            survey_id: survey_id ?? null,
            anomaly_type,
            confidence_pct,
            severity: severity ?? 'medium',
            timestamp: new Date().toISOString(),
          },
          contentType: 'application/json',
        });
        await sender.close();
        await sbClient.close();
      } catch (sbErr) {
        // Non-fatal — anomaly is already saved
        process.stderr.write(
          JSON.stringify({ level: 'warn', service: 'geoswarm-api', msg: 'Service Bus publish failed', error: String(sbErr) }) + '\n',
        );
      }
    }

    res.status(201).json(anomaly);
  } catch (err) {
    next(err);
  }
});

export default router;

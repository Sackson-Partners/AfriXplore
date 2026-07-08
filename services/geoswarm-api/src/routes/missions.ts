import { Router, Request, Response, NextFunction } from 'express';
import { getPool } from '@ain/database';
import { requireAuth } from '@ain/auth';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

// GET /missions — list flight missions with pagination
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200);
    const offset = parseInt(String(req.query.offset ?? '0'), 10);
    const status = req.query.status as string | undefined;

    try {
      const pool = getPool();

      const whereClause = status ? `WHERE status = $3` : '';
      const params = status ? [limit, offset, status] : [limit, offset];

      const [dataResult, countResult] = await Promise.all([
        pool.query(
          `SELECT
             fm.*,
             so.project_name,
             so.area_km2,
             so.sensor_types
           FROM geoswarm_flight_missions fm
           LEFT JOIN geoswarm_survey_orders so ON fm.survey_order_id = so.id
           ${whereClause}
           ORDER BY fm.mission_date DESC, fm.created_at DESC
           LIMIT $1 OFFSET $2`,
          params
        ),
        pool.query(
          `SELECT COUNT(*) AS total FROM geoswarm_flight_missions ${whereClause}`,
          status ? [status] : []
        ),
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

// GET /missions/:id — single mission
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT
         fm.*,
         so.project_name,
         so.area_km2,
         so.sensor_types,
         so.contact_email
       FROM geoswarm_flight_missions fm
       LEFT JOIN geoswarm_survey_orders so ON fm.survey_order_id = so.id
       WHERE fm.id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) {
      next(createError(404, 'Not Found', `Mission ${req.params.id} not found`));
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    const pg = err as { code?: string };
    if (pg.code === '42P01') {
      next(createError(404, 'Not Found', `Mission ${req.params.id} not found`));
    } else {
      next(err);
    }
  }
});

// POST /missions — create a new flight mission
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      survey_order_id,
      mission_date,
      pilot_name,
      aircraft_id,
      flight_path_geojson,
      altitude_m,
      weather_conditions,
      notes,
    } = req.body as {
      survey_order_id: string;
      mission_date: string;
      pilot_name?: string;
      aircraft_id?: string;
      flight_path_geojson?: object;
      altitude_m?: number;
      weather_conditions?: string;
      notes?: string;
    };

    if (!survey_order_id || !mission_date) {
      next(createError(400, 'Bad Request', 'survey_order_id and mission_date are required'));
      return;
    }

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO geoswarm_flight_missions
         (survey_order_id, mission_date, pilot_name, aircraft_id,
          flight_path, altitude_m, weather_conditions, notes, status)
       VALUES ($1, $2, $3, $4,
               CASE WHEN $5::text IS NOT NULL
                    THEN ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)
                    ELSE NULL END,
               $6, $7, $8, 'scheduled')
       RETURNING *`,
      [
        survey_order_id,
        mission_date,
        pilot_name ?? null,
        aircraft_id ?? null,
        flight_path_geojson ? JSON.stringify(flight_path_geojson) : null,
        altitude_m ?? null,
        weather_conditions ?? null,
        notes ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /missions/:id — update mission status or details
router.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, weather_conditions, notes } = req.body as {
      status?: string;
      weather_conditions?: string;
      notes?: string;
    };

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (weather_conditions !== undefined) {
      updates.push(`weather_conditions = $${paramIndex++}`);
      values.push(weather_conditions);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }

    if (updates.length === 0) {
      next(createError(400, 'Bad Request', 'No fields to update'));
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const pool = getPool();
    const result = await pool.query(
      `UPDATE geoswarm_flight_missions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (!result.rows.length) {
      next(createError(404, 'Not Found', `Mission ${req.params.id} not found`));
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /missions/stats/summary — mission statistics
router.get('/stats/summary', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled,
        COUNT(*) FILTER (WHERE status = 'in_flight') AS in_flight,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
        COUNT(*) AS total
      FROM geoswarm_flight_missions
    `);

    res.status(200).json(result.rows[0] ?? { scheduled: 0, in_flight: 0, completed: 0, cancelled: 0, total: 0 });
  } catch (err) {
    const pg = err as { code?: string };
    if (pg.code === '42P01') {
      res.status(200).json({ scheduled: 0, in_flight: 0, completed: 0, cancelled: 0, total: 0 });
    } else {
      next(err);
    }
  }
});

export default router;

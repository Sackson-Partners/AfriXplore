import { Router, Request, Response, NextFunction } from 'express';
import { getPool } from '@ain/database';
import { requireAuth } from '@ain/auth';

const router = Router();

// GET /analytics/dashboard — main dashboard KPIs
router.get('/dashboard', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM geoswarm_survey_orders WHERE status != 'cancelled') AS active_surveys,
        (SELECT COUNT(*) FROM geoswarm_flight_missions WHERE status IN ('scheduled', 'in_flight')) AS active_missions,
        (SELECT COUNT(*) FROM geoswarm_anomalies) AS anomalies_detected,
        (SELECT COUNT(*) FROM scouts WHERE status = 'active') AS active_scouts,
        (SELECT COUNT(*) FROM scout_reports WHERE status IN ('pending', 'under_review')) AS pending_reports,
        (SELECT SUM(area_km2)::numeric FROM geoswarm_survey_orders WHERE status = 'completed') AS area_surveyed_km2
    `);

    res.status(200).json(result.rows[0] ?? {
      active_surveys: 0,
      active_missions: 0,
      anomalies_detected: 0,
      active_scouts: 0,
      pending_reports: 0,
      area_surveyed_km2: 0,
    });
  } catch (err) {
    const pg = err as { code?: string };
    if (pg.code === '42P01') {
      res.status(200).json({
        active_surveys: 0,
        active_missions: 0,
        anomalies_detected: 0,
        active_scouts: 0,
        pending_reports: 0,
        area_surveyed_km2: 0,
      });
    } else {
      next(err);
    }
  }
});

// GET /analytics/anomalies/by-type — anomalies grouped by type
router.get('/anomalies/by-type', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        anomaly_type,
        COUNT(*)::int AS count,
        AVG(confidence_pct)::numeric(5,2) AS avg_confidence
      FROM geoswarm_anomalies
      GROUP BY anomaly_type
      ORDER BY count DESC
    `);

    res.status(200).json({ data: result.rows });
  } catch (err) {
    const pg = err as { code?: string };
    if (pg.code === '42P01') {
      res.status(200).json({ data: [] });
    } else {
      next(err);
    }
  }
});

// GET /analytics/missions/timeline — missions over time
router.get('/missions/timeline', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        DATE_TRUNC('month', mission_date)::date AS month,
        COUNT(*)::int AS mission_count,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
      FROM geoswarm_flight_missions
      WHERE mission_date >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month DESC
    `);

    res.status(200).json({ data: result.rows });
  } catch (err) {
    const pg = err as { code?: string };
    if (pg.code === '42P01') {
      res.status(200).json({ data: [] });
    } else {
      next(err);
    }
  }
});

// GET /analytics/scouts/by-country — scout distribution by country
router.get('/scouts/by-country', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        country,
        COUNT(*)::int AS scout_count,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_count,
        SUM(points_earned)::int AS total_points,
        (SELECT COUNT(*) FROM scout_reports sr WHERE sr.scout_id = scouts.id)::int AS reports_submitted
      FROM scouts
      GROUP BY country
      ORDER BY scout_count DESC
    `);

    res.status(200).json({ data: result.rows });
  } catch (err) {
    const pg = err as { code?: string };
    if (pg.code === '42P01') {
      res.status(200).json({ data: [] });
    } else {
      next(err);
    }
  }
});

// GET /analytics/reports/status — report status breakdown
router.get('/reports/status', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        status,
        COUNT(*)::int AS count,
        AVG(confidence_score)::numeric(5,2) AS avg_confidence
      FROM scout_reports
      GROUP BY status
      ORDER BY count DESC
    `);

    res.status(200).json({ data: result.rows });
  } catch (err) {
    const pg = err as { code?: string };
    if (pg.code === '42P01') {
      res.status(200).json({ data: [] });
    } else {
      next(err);
    }
  }
});

export default router;

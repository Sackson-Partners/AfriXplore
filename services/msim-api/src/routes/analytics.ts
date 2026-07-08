import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '@ain/auth';
import { getPool } from '@ain/database';

const router = Router();

/**
 * GET /analytics/overview
 * Top-level counts for the MSIM dataset.
 */
router.get('/overview', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)               FROM msim_regions)             AS total_regions,
        (SELECT COUNT(*)               FROM msim_mining_companies)    AS total_companies,
        (SELECT COUNT(*)               FROM msim_concessions)         AS total_concessions,
        (SELECT COUNT(*)               FROM msim_mining_records)      AS total_records,
        (SELECT COUNT(*)               FROM msim_mineral_extractions) AS total_extractions,
        (SELECT COALESCE(SUM(quantity_mt), 0)
         FROM msim_mining_records
         WHERE record_type = 'production')                             AS total_quantity_mt,
        (SELECT COUNT(DISTINCT country) FROM msim_concessions)         AS countries_covered,
        (SELECT MIN(year_extracted)    FROM msim_mining_records)       AS earliest_year,
        (SELECT MAX(year_extracted)    FROM msim_mining_records)       AS latest_year
    `);

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /analytics/production-by-mineral
 * Total production in metric tonnes grouped by canonical mineral name.
 */
router.get('/production-by-mineral', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        e.mineral_name,
        COUNT(DISTINCT e.record_id)       AS record_count,
        COALESCE(SUM(e.quantity_mt), 0)   AS total_quantity_mt,
        MIN(r.year_extracted)             AS earliest_year,
        MAX(r.year_extracted)             AS latest_year
      FROM msim_mineral_extractions e
      JOIN msim_mining_records r ON r.id = e.record_id
      GROUP BY e.mineral_name
      ORDER BY total_quantity_mt DESC
    `);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /analytics/production-by-year
 * Annual production totals across all minerals.
 */
router.get('/production-by-year', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        r.year_extracted                  AS year,
        COUNT(DISTINCT r.id)              AS record_count,
        COALESCE(SUM(r.quantity_mt), 0)   AS total_quantity_mt,
        COUNT(DISTINCT r.mine_id)         AS mines_active
      FROM msim_mining_records r
      WHERE r.year_extracted IS NOT NULL
        AND r.record_type = 'production'
      GROUP BY r.year_extracted
      ORDER BY r.year_extracted
    `);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /analytics/production-by-country
 * Production totals grouped by country (via mine lookup).
 */
router.get('/production-by-country', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        hm.country,
        COUNT(DISTINCT r.id)              AS record_count,
        COALESCE(SUM(r.quantity_mt), 0)   AS total_quantity_mt,
        COUNT(DISTINCT r.mine_id)         AS mine_count,
        MIN(r.year_extracted)             AS earliest_year,
        MAX(r.year_extracted)             AS latest_year
      FROM msim_mining_records r
      JOIN historical_mines hm ON hm.id = r.mine_id
      WHERE r.record_type = 'production'
      GROUP BY hm.country
      ORDER BY total_quantity_mt DESC
    `);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /analytics/company-output
 * Total recorded output per colonial mining company.
 */
router.get('/company-output', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        mc.id,
        mc.name,
        mc.country_of_origin,
        mc.known_minerals,
        COUNT(DISTINCT r.id)              AS record_count,
        COALESCE(SUM(r.quantity_mt), 0)   AS total_quantity_mt,
        MIN(r.year_extracted)             AS earliest_year,
        MAX(r.year_extracted)             AS latest_year
      FROM msim_mining_companies mc
      LEFT JOIN msim_mining_records r ON r.company_id = mc.id AND r.record_type = 'production'
      GROUP BY mc.id, mc.name, mc.country_of_origin, mc.known_minerals
      ORDER BY total_quantity_mt DESC
    `);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /analytics/kpis
 * Aggregate KPI stats for the platform dashboard.
 */
router.get('/kpis', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM historical_mines)                              AS mines_digitised,
        (SELECT COUNT(*) FROM msim_targets WHERE target_status = 'identified') AS drill_targets,
        (SELECT ROUND(AVG(dpi_score)::numeric, 1) FROM historical_mines WHERE dpi_score > 0) AS avg_dpi,
        (SELECT COUNT(DISTINCT country) FROM historical_mines)              AS countries,
        (SELECT COUNT(*) FROM historical_mines WHERE geoswarm_surveyed = TRUE) AS anomalies_active,
        (SELECT COUNT(*) FROM archive_documents WHERE status = 'indexed')   AS documents_indexed
    `);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /analytics/discovery-rate
 * Monthly mine digitisation rate for area chart.
 */
router.get('/discovery-rate', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COUNT(*) AS count
      FROM historical_mines
      WHERE created_at >= NOW() - INTERVAL '24 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at)
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /analytics/dpi-distribution
 * Histogram of DPI scores in buckets of 10.
 */
router.get('/dpi-distribution', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        CONCAT(bucket * 10, '-', bucket * 10 + 10) AS range,
        COUNT(*) AS count
      FROM (
        SELECT FLOOR(LEAST(dpi_score, 99.9) / 10)::int AS bucket
        FROM historical_mines
        WHERE dpi_score IS NOT NULL AND dpi_score > 0
      ) sub
      GROUP BY bucket
      ORDER BY bucket
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /analytics/country-league
 * Per-country stats table with average DPI, mine count, coverage.
 */
router.get('/country-league', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        country,
        COUNT(*) AS mine_count,
        ROUND(AVG(dpi_score)::numeric, 1) AS avg_dpi,
        COUNT(*) FILTER (WHERE dpi_score >= 70) AS high_potential,
        COUNT(*) FILTER (WHERE geoswarm_surveyed = TRUE) AS surveyed
      FROM historical_mines
      GROUP BY country
      HAVING COUNT(*) >= 1
      ORDER BY avg_dpi DESC NULLS LAST
      LIMIT 30
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;

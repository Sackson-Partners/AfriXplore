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

export default router;

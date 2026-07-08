import { Router, Request, Response, NextFunction } from 'express';
import { getPool } from '@ain/database';
import { requireAuth } from '@ain/auth';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

// GET /scouts — list scouts with pagination and filters
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200);
    const offset = parseInt(String(req.query.offset ?? '0'), 10);
    const country = req.query.country as string | undefined;
    const status = req.query.status as string | undefined;
    const kyc_status = req.query.kyc_status as string | undefined;

    try {
      const pool = getPool();

      const whereClauses: string[] = [];
      const params: unknown[] = [limit, offset];
      let paramIndex = 3;

      if (country) {
        whereClauses.push(`country = $${paramIndex++}`);
        params.push(country);
      }
      if (status) {
        whereClauses.push(`status = $${paramIndex++}`);
        params.push(status);
      }
      if (kyc_status) {
        whereClauses.push(`kyc_status = $${paramIndex++}`);
        params.push(kyc_status);
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const [dataResult, countResult] = await Promise.all([
        pool.query(
          `SELECT
             id, user_id, country, region, district, status,
             kyc_status, badge_level, points_earned, payouts_usd,
             phone_number, created_at, updated_at
           FROM scouts
           ${whereClause}
           ORDER BY points_earned DESC, created_at DESC
           LIMIT $1 OFFSET $2`,
          params
        ),
        pool.query(
          `SELECT COUNT(*) AS total FROM scouts ${whereClause}`,
          params.slice(2)
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

// GET /scouts/:id — single scout
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM scouts WHERE id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) {
      next(createError(404, 'Not Found', `Scout ${req.params.id} not found`));
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    const pg = err as { code?: string };
    if (pg.code === '42P01') {
      next(createError(404, 'Not Found', `Scout ${req.params.id} not found`));
    } else {
      next(err);
    }
  }
});

// GET /scouts/:id/reports — reports submitted by a scout
router.get('/:id/reports', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
    const offset = parseInt(String(req.query.offset ?? '0'), 10);

    const pool = getPool();
    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT
           sr.*,
           m.name AS mine_name
         FROM scout_reports sr
         LEFT JOIN msim_mines m ON sr.mine_id = m.id
         WHERE sr.scout_id = $1
         ORDER BY sr.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.params.id, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM scout_reports WHERE scout_id = $1`,
        [req.params.id]
      ),
    ]);

    res.status(200).json({
      data: dataResult.rows,
      total: parseInt(countResult.rows[0]?.total ?? '0', 10),
      limit,
      offset,
    });
  } catch (err) {
    const pg = err as { code?: string };
    if (pg.code === '42P01') {
      res.status(200).json({ data: [], total: 0, limit: 20, offset: 0 });
    } else {
      next(err);
    }
  }
});

// PATCH /scouts/:id — update scout status or KYC
router.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, kyc_status, badge_level, payouts_usd } = req.body as {
      status?: string;
      kyc_status?: string;
      badge_level?: string;
      payouts_usd?: number;
    };

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (kyc_status) {
      updates.push(`kyc_status = $${paramIndex++}`);
      values.push(kyc_status);
    }
    if (badge_level) {
      updates.push(`badge_level = $${paramIndex++}`);
      values.push(badge_level);
    }
    if (payouts_usd !== undefined) {
      updates.push(`payouts_usd = $${paramIndex++}`);
      values.push(payouts_usd);
    }

    if (updates.length === 0) {
      next(createError(400, 'Bad Request', 'No fields to update'));
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const pool = getPool();
    const result = await pool.query(
      `UPDATE scouts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (!result.rows.length) {
      next(createError(404, 'Not Found', `Scout ${req.params.id} not found`));
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /scouts/stats/leaderboard — top scouts by points
router.get('/stats/leaderboard', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '10'), 10), 50);

    const pool = getPool();
    const result = await pool.query(
      `SELECT
         id, country, district, badge_level, points_earned, payouts_usd,
         (SELECT COUNT(*) FROM scout_reports WHERE scout_id = scouts.id) AS reports_count
       FROM scouts
       WHERE status = 'active'
       ORDER BY points_earned DESC, created_at ASC
       LIMIT $1`,
      [limit]
    );

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

// GET /scouts/stats/summary — scout statistics
router.get('/stats/summary', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') AS active,
        COUNT(*) FILTER (WHERE status = 'inactive') AS inactive,
        COUNT(*) FILTER (WHERE kyc_status = 'verified') AS kyc_verified,
        COUNT(*) FILTER (WHERE kyc_status = 'pending') AS kyc_pending,
        SUM(points_earned)::int AS total_points,
        SUM(payouts_usd)::numeric AS total_payouts_usd,
        COUNT(*) AS total
      FROM scouts
    `);

    res.status(200).json(result.rows[0] ?? {
      active: 0,
      inactive: 0,
      kyc_verified: 0,
      kyc_pending: 0,
      total_points: 0,
      total_payouts_usd: 0,
      total: 0,
    });
  } catch (err) {
    const pg = err as { code?: string };
    if (pg.code === '42P01') {
      res.status(200).json({
        active: 0,
        inactive: 0,
        kyc_verified: 0,
        kyc_pending: 0,
        total_points: 0,
        total_payouts_usd: 0,
        total: 0,
      });
    } else {
      next(err);
    }
  }
});

export default router;

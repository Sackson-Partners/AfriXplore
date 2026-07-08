import { Router, Request, Response, NextFunction } from 'express';
import { getPool } from '@ain/database';
import { requireAuth } from '@ain/auth';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

// GET /reports — list interpretation reports
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200);
    const offset = parseInt(String(req.query.offset ?? '0'), 10);

    try {
      const pool = getPool();
      const [dataResult, countResult] = await Promise.all([
        pool.query(
          `SELECT * FROM geoswarm_interpretation_reports ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
        pool.query(`SELECT COUNT(*) AS total FROM geoswarm_interpretation_reports`),
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

// GET /reports/:id — single report
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`SELECT * FROM geoswarm_interpretation_reports WHERE id = $1`, [req.params.id]);
    if (!result.rows.length) {
      next(createError(404, 'Not Found', `Report ${req.params.id} not found`));
      return;
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    const pg = err as { code?: string };
    if (pg.code === '42P01') {
      next(createError(404, 'Not Found', `Report ${req.params.id} not found`));
    } else {
      next(err);
    }
  }
});

export default router;

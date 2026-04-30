import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '@ain/auth';
import { getPool } from '@ain/database';
import { z } from 'zod';

const router = Router();

const SearchQuery = z.object({
  q:          z.string().min(1).max(500),
  entityType: z.enum(['region','company','concession','record']).optional(),
  country:    z.string().max(100).optional(),
  page:       z.coerce.number().int().min(1).default(1),
  pageSize:   z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * GET /msim-search?q=...
 * Full-text search across the msim_search_mv materialized view.
 * Returns ranked results with ts_rank.
 */
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = SearchQuery.parse(req.query);
    const pool = getPool();

    const conditions: string[] = [
      `search_vector @@ plainto_tsquery('english', $1)`,
    ];
    const params: unknown[] = [q.q];
    let p = 2;

    if (q.entityType) { conditions.push(`entity_type = $${p++}`); params.push(q.entityType); }
    if (q.country)    { conditions.push(`country ILIKE $${p++}`); params.push(`%${q.country}%`); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const offset = (q.page - 1) * q.pageSize;

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT id, entity_type, title, country, mine_id, concession_id, company_id,
                ts_rank(search_vector, plainto_tsquery('english', $1)) AS rank,
                created_at
         FROM msim_search_mv
         ${where}
         ORDER BY rank DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        [...params, q.pageSize, offset],
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM msim_search_mv ${where}`,
        params,
      ),
    ]);

    res.json({
      query: q.q,
      data: rows.rows,
      total: Number(countRow.rows[0].total),
      page: q.page,
      pageSize: q.pageSize,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /msim-search/refresh-mv
 * Manually trigger a CONCURRENT refresh of the search materialized view.
 * Admin only.
 */
router.post(
  '/refresh-mv',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pool = getPool();
      await pool.query('SELECT refresh_msim_search_mv()');
      res.json({ refreshed: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;

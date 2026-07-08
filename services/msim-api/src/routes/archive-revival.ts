import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '@ain/auth';
import { getPool } from '@ain/database';

const router = Router();

/**
 * GET /archive-revival/jobs
 * List all revival jobs with pagination.
 */
router.get('/jobs', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize ?? 20)));
    const offset = (page - 1) * pageSize;
    const status = req.query.status as string | undefined;

    const whereClause = status ? `WHERE j.status = $3` : '';
    const params: (number | string)[] = [pageSize, offset];
    if (status) params.push(status);

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT j.*, hm.name AS mine_name, hm.country,
                ad.title AS document_title, ad.document_type
         FROM archive_revival_jobs j
         LEFT JOIN historical_mines hm ON hm.id = j.mine_id
         LEFT JOIN archive_documents ad ON ad.id = j.document_id
         ${whereClause}
         ORDER BY j.created_at DESC
         LIMIT $1 OFFSET $2`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) FROM archive_revival_jobs j ${whereClause}`,
        status ? [status] : []
      ),
    ]);

    res.json({
      data: rows.rows,
      total: Number(countRow.rows[0].count),
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /archive-revival/jobs/:id
 * Get a single revival job detail.
 */
router.get('/jobs/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT j.*, hm.name AS mine_name, hm.country,
              ad.title AS document_title, ad.document_type, ad.page_count
       FROM archive_revival_jobs j
       LEFT JOIN historical_mines hm ON hm.id = j.mine_id
       LEFT JOIN archive_documents ad ON ad.id = j.document_id
       WHERE j.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /archive-revival/trigger
 * Trigger a new revival batch job (admin/geologist only).
 */
router.post(
  '/trigger',
  requireAuth,
  requireRole('admin', 'geologist'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pool = getPool();
      const { mine_id, document_id, priority = 5 } = req.body as {
        mine_id?: string;
        document_id?: string;
        priority?: number;
      };

      const result = await pool.query(
        `INSERT INTO archive_revival_jobs (mine_id, document_id, priority, status)
         VALUES ($1, $2, $3, 'queued')
         RETURNING *`,
        [mine_id ?? null, document_id ?? null, priority]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /archive-revival/stats
 * Summary stats for the revival dashboard.
 */
router.get('/stats', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'queued')     AS queued,
        COUNT(*) FILTER (WHERE status = 'processing') AS processing,
        COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
        COUNT(*) FILTER (WHERE status = 'failed')     AS failed,
        COUNT(*) AS total
      FROM archive_revival_jobs
    `);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;

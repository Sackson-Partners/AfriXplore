import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '@ain/auth';
import { getPool } from '@ain/database';

const router = Router();

/**
 * GET /data-room
 * List data room packages.
 */
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(50, Number(req.query.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT p.*, hm.name AS mine_name, hm.country, hm.commodity
         FROM data_room_packages p
         LEFT JOIN historical_mines hm ON hm.id = p.mine_id
         ORDER BY p.created_at DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      ),
      pool.query('SELECT COUNT(*) FROM data_room_packages'),
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
 * POST /data-room
 * Create a new data room package.
 */
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const { title, mine_id, nda_required = true, expires_at, document_ids = [] } = req.body as {
      title: string;
      mine_id?: string;
      nda_required?: boolean;
      expires_at?: string;
      document_ids?: string[];
    };

    const result = await pool.query(
      `INSERT INTO data_room_packages (title, mine_id, nda_required, expires_at, document_ids, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, mine_id ?? null, nda_required, expires_at ?? null, document_ids, req.user?.sub ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /data-room/:id
 * Package detail with documents and access list.
 */
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const [pkg, access] = await Promise.all([
      pool.query(
        `SELECT p.*, hm.name AS mine_name, hm.country, hm.commodity
         FROM data_room_packages p
         LEFT JOIN historical_mines hm ON hm.id = p.mine_id
         WHERE p.id = $1`,
        [req.params.id]
      ),
      pool.query(
        `SELECT * FROM data_room_access WHERE package_id = $1 ORDER BY granted_at DESC`,
        [req.params.id]
      ),
    ]);

    if (!pkg.rows[0]) {
      res.status(404).json({ error: 'Package not found' });
      return;
    }

    // Increment view count
    await pool.query(
      'UPDATE data_room_packages SET view_count = view_count + 1 WHERE id = $1',
      [req.params.id]
    );

    res.json({ ...pkg.rows[0], access_list: access.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /data-room/:id/grant
 * Grant access to a data room package.
 */
router.post('/:id/grant', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const { grantee_email, org_id, expires_at } = req.body as {
      grantee_email: string;
      org_id?: string;
      expires_at?: string;
    };

    const result = await pool.query(
      `INSERT INTO data_room_access (package_id, grantee_email, org_id, granted_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.params.id, grantee_email, org_id ?? null, req.user?.sub ?? null, expires_at ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '@ain/auth';
import { getPool } from '@ain/database';

const router = Router();

const VALID_STAGES = ['prospect', 'nda_signed', 'term_sheet', 'due_diligence', 'closed', 'dead'] as const;

/**
 * GET /deals
 * List all deals (paginated).
 */
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(50, Number(req.query.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const stage = req.query.stage as string | undefined;

    const whereClause = stage ? `WHERE d.stage = $3` : '';
    const params: (number | string)[] = [pageSize, offset];
    if (stage) params.push(stage);

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT d.*, hm.name AS mine_name, hm.country, hm.commodity
         FROM deals d
         LEFT JOIN historical_mines hm ON hm.id = d.mine_id
         ${whereClause}
         ORDER BY d.updated_at DESC
         LIMIT $1 OFFSET $2`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) FROM deals d ${whereClause}`,
        stage ? [stage] : []
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
 * POST /deals
 * Create a new deal.
 */
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const { title, mine_id, deal_type = 'jv', value_usd, equity_percent } = req.body as {
      title: string;
      mine_id?: string;
      deal_type?: string;
      value_usd?: number;
      equity_percent?: number;
    };

    const result = await pool.query(
      `INSERT INTO deals (title, mine_id, deal_type, value_usd, equity_percent, operator_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, mine_id ?? null, deal_type, value_usd ?? null, equity_percent ?? null, req.user?.sub ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /deals/:id
 * Get deal detail.
 */
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT d.*, hm.name AS mine_name, hm.country, hm.commodity
       FROM deals d
       LEFT JOIN historical_mines hm ON hm.id = d.mine_id
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /deals/:id/stage
 * Advance or update the deal stage.
 */
router.patch('/:id/stage', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const { stage } = req.body as { stage: string };

    if (!VALID_STAGES.includes(stage as (typeof VALID_STAGES)[number])) {
      res.status(400).json({ error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` });
      return;
    }

    const result = await pool.query(
      `UPDATE deals SET stage = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [stage, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /deals/:id/notes
 * Append a note to the deal's notes JSONB array.
 */
router.post('/:id/notes', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const { text } = req.body as { text: string };

    const note = {
      id: crypto.randomUUID(),
      text,
      author: req.user?.email ?? req.user?.sub ?? 'unknown',
      created_at: new Date().toISOString(),
    };

    const result = await pool.query(
      `UPDATE deals
       SET notes = notes || $1::jsonb, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify([note]), req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;

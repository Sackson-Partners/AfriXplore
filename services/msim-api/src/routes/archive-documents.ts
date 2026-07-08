import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '@ain/auth';
import { getPool } from '@ain/database';

const router = Router();

/**
 * GET /archive-docs
 * Paginated list of archive documents with optional full-text search.
 */
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));
    const offset = (page - 1) * pageSize;
    const search = req.query.search as string | undefined;
    const docType = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const mineId = req.query.mine_id as string | undefined;

    const conditions: string[] = [];
    const params: (string | number)[] = [pageSize, offset];
    let paramIdx = 3;

    if (search) {
      conditions.push(`(d.title ILIKE $${paramIdx} OR d.author ILIKE $${paramIdx} OR d.ocr_raw_text ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (docType) {
      conditions.push(`d.document_type = $${paramIdx}`);
      params.push(docType);
      paramIdx++;
    }
    if (status) {
      conditions.push(`d.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }
    if (mineId) {
      conditions.push(`d.mine_id = $${paramIdx}`);
      params.push(mineId);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countParams = params.slice(2); // skip pageSize, offset

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT d.*, hm.name AS mine_name, hm.country AS mine_country
         FROM archive_documents d
         LEFT JOIN historical_mines hm ON hm.id = d.mine_id
         ${whereClause}
         ORDER BY d.created_at DESC
         LIMIT $1 OFFSET $2`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) FROM archive_documents d ${whereClause}`,
        countParams
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
 * GET /archive-docs/:id
 * Single document detail.
 */
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT d.*, hm.name AS mine_name, hm.country AS mine_country, hm.commodity
       FROM archive_documents d
       LEFT JOIN historical_mines hm ON hm.id = d.mine_id
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /archive-docs/:id/download
 * Return a (fake dev) SAS URL for downloading the document blob.
 */
router.get('/:id/download', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, title, blob_uri FROM archive_documents WHERE id = $1',
      [req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const doc = result.rows[0] as { id: string; title: string; blob_uri: string | null };
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    // In dev, return a fake SAS URL. In prod, generate a real Azure Blob SAS token.
    const sasUrl = doc.blob_uri
      ? `${doc.blob_uri}?sv=2023-08-03&se=${expiresAt}&sp=r&sig=devfakesig`
      : `https://storage.afrixplore.com/dev/${doc.id}.pdf?sv=2023-08-03&se=${expiresAt}&sp=r&sig=devfakesig`;

    res.json({ sas_url: sasUrl, expires_at: expiresAt });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /archive-docs/stats
 * Summary stats for the vault page header.
 */
router.get('/meta/stats', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'indexed')  AS indexed,
        COUNT(*) FILTER (WHERE status = 'pending')  AS pending,
        COUNT(*) FILTER (WHERE status = 'failed')   AS failed,
        COUNT(DISTINCT document_type) AS type_count,
        COUNT(DISTINCT country) AS countries
      FROM archive_documents
    `);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;

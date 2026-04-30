import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '@ain/auth';
import { getPool } from '@ain/database';
import { z } from 'zod';

const router = Router();

const ListQuery = z.object({
  mineId:       z.string().uuid().optional(),
  concessionId: z.string().uuid().optional(),
  companyId:    z.string().uuid().optional(),
  recordType:   z.enum(['production','survey','incident','inspection','administrative']).optional(),
  yearFrom:     z.coerce.number().int().min(1400).max(2100).optional(),
  yearTo:       z.coerce.number().int().min(1400).max(2100).optional(),
  search:       z.string().max(200).optional(),
  page:         z.coerce.number().int().min(1).default(1),
  pageSize:     z.coerce.number().int().min(1).max(100).default(20),
});

const CreateBody = z.object({
  mineId:          z.string().uuid(),
  concessionId:    z.string().uuid().optional(),
  companyId:       z.string().uuid().optional(),
  title:           z.string().min(1).max(500),
  recordDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recordType:      z.enum(['production','survey','incident','inspection','administrative']).default('production'),
  description:     z.string().optional(),
  quantityMt:      z.number().positive().optional(),
  notes:           z.string().optional(),
  sourceReference: z.string().optional(),
  documentUrl:     z.string().url().optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  metadata:        z.record(z.unknown()).default({}),
});

const UpdateBody = CreateBody.omit({ mineId: true }).partial();

// GET /records
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = ListQuery.parse(req.query);
    const pool = getPool();

    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (q.mineId)       { conditions.push(`r.mine_id = $${p++}`);       params.push(q.mineId); }
    if (q.concessionId) { conditions.push(`r.concession_id = $${p++}`); params.push(q.concessionId); }
    if (q.companyId)    { conditions.push(`r.company_id = $${p++}`);    params.push(q.companyId); }
    if (q.recordType)   { conditions.push(`r.record_type = $${p++}`);   params.push(q.recordType); }
    if (q.yearFrom)     { conditions.push(`r.year_extracted >= $${p++}`); params.push(q.yearFrom); }
    if (q.yearTo)       { conditions.push(`r.year_extracted <= $${p++}`); params.push(q.yearTo); }
    if (q.search) {
      conditions.push(`r.search_vector @@ plainto_tsquery('english', $${p++})`);
      params.push(q.search);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (q.page - 1) * q.pageSize;

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT r.*, hm.name AS mine_name, hm.country AS mine_country
         FROM msim_mining_records r
         JOIN historical_mines hm ON hm.id = r.mine_id
         ${where}
         ORDER BY r.year_extracted DESC NULLS LAST, r.created_at DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        [...params, q.pageSize, offset],
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM msim_mining_records r ${where}`,
        params,
      ),
    ]);

    res.json({
      data: rows.rows,
      total: Number(countRow.rows[0].total),
      page: q.page,
      pageSize: q.pageSize,
    });
  } catch (err) {
    next(err);
  }
});

// GET /records/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const pool = getPool();

    const [rec, exts] = await Promise.all([
      pool.query(
        `SELECT r.*, hm.name AS mine_name, hm.country AS mine_country
         FROM msim_mining_records r
         JOIN historical_mines hm ON hm.id = r.mine_id
         WHERE r.id = $1`,
        [id],
      ),
      pool.query(
        'SELECT * FROM msim_mineral_extractions WHERE record_id = $1 ORDER BY created_at',
        [id],
      ),
    ]);

    if (!rec.rows[0]) { res.status(404).json({ error: 'Record not found' }); return; }

    res.json({ ...rec.rows[0], extractions: exts.rows });
  } catch (err) {
    next(err);
  }
});

// POST /records — analyst+
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'geologist', 'analyst'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = CreateBody.parse(req.body);
      const pool = getPool();

      const result = await pool.query<{ id: string }>(
        `INSERT INTO msim_mining_records
           (mine_id, concession_id, company_id, title, record_date, record_type,
            description, quantity_mt, notes, source_reference, document_url,
            confidence_score, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          body.mineId,
          body.concessionId ?? null,
          body.companyId ?? null,
          body.title,
          body.recordDate ?? null,
          body.recordType,
          body.description ?? null,
          body.quantityMt ?? null,
          body.notes ?? null,
          body.sourceReference ?? null,
          body.documentUrl ?? null,
          body.confidenceScore ?? null,
          JSON.stringify(body.metadata),
        ],
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /records/:id — analyst+
router.patch(
  '/:id',
  requireAuth,
  requireRole('admin', 'geologist', 'analyst'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const body = UpdateBody.parse(req.body);
      const pool = getPool();

      const fields: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      const colMap: Record<string, string> = {
        concessionId: 'concession_id', companyId: 'company_id', title: 'title',
        recordDate: 'record_date', recordType: 'record_type', description: 'description',
        quantityMt: 'quantity_mt', notes: 'notes', sourceReference: 'source_reference',
        documentUrl: 'document_url', confidenceScore: 'confidence_score', metadata: 'metadata',
      };

      for (const [key, col] of Object.entries(colMap)) {
        if (key in body && (body as Record<string, unknown>)[key] !== undefined) {
          const val = (body as Record<string, unknown>)[key];
          fields.push(`${col} = $${p++}`);
          params.push(key === 'metadata' ? JSON.stringify(val) : val);
        }
      }

      if (!fields.length) { res.status(400).json({ error: 'No fields to update' }); return; }

      params.push(id);
      const result = await pool.query(
        `UPDATE msim_mining_records SET ${fields.join(',')} WHERE id = $${p} RETURNING *`,
        params,
      );

      if (!result.rows[0]) { res.status(404).json({ error: 'Record not found' }); return; }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /records/:id — admin only
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const pool = getPool();
      await pool.query('DELETE FROM msim_mining_records WHERE id = $1', [id]);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;

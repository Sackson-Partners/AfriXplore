import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '@ain/auth';
import { getPool } from '@ain/database';
import { z } from 'zod';

const router = Router();

const ListQuery = z.object({
  country:  z.string().max(100).optional(),
  search:   z.string().max(200).optional(),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const CreateBody = z.object({
  name:         z.string().min(1).max(500),
  country:      z.string().min(1).max(100),
  colonialName: z.string().optional(),
  modernName:   z.string().optional(),
  description:  z.string().optional(),
  areaKm2:      z.number().positive().optional(),
  metadata:     z.record(z.unknown()).default({}),
});

const UpdateBody = CreateBody.partial();

// GET /regions
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = ListQuery.parse(req.query);
    const pool = getPool();

    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (q.country) { conditions.push(`country ILIKE $${p++}`); params.push(`%${q.country}%`); }
    if (q.search) {
      conditions.push(`search_vector @@ plainto_tsquery('english', $${p++})`);
      params.push(q.search);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (q.page - 1) * q.pageSize;

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT id, name, country, colonial_name, modern_name, description, area_km2, metadata, created_at, updated_at
         FROM msim_regions ${where}
         ORDER BY country, name
         LIMIT $${p} OFFSET $${p + 1}`,
        [...params, q.pageSize, offset],
      ),
      pool.query(`SELECT COUNT(*) AS total FROM msim_regions ${where}`, params),
    ]);

    res.json({ data: rows.rows, total: Number(countRow.rows[0].total), page: q.page, pageSize: q.pageSize });
  } catch (err) {
    next(err);
  }
});

// GET /regions/:id — includes concession count
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const pool = getPool();

    const [region, concessions] = await Promise.all([
      pool.query(
        `SELECT id, name, country, colonial_name, modern_name, description, area_km2, metadata, created_at, updated_at
         FROM msim_regions WHERE id = $1`,
        [id],
      ),
      pool.query(
        `SELECT id, name, status, granted_year, revoked_year, minerals
         FROM msim_concessions WHERE region_id = $1 ORDER BY granted_year`,
        [id],
      ),
    ]);

    if (!region.rows[0]) { res.status(404).json({ error: 'Region not found' }); return; }

    res.json({ ...region.rows[0], concessions: concessions.rows });
  } catch (err) {
    next(err);
  }
});

// POST /regions
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'geologist'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = CreateBody.parse(req.body);
      const pool = getPool();

      const result = await pool.query(
        `INSERT INTO msim_regions
           (name, country, colonial_name, modern_name, description, area_km2, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          body.name, body.country, body.colonialName ?? null, body.modernName ?? null,
          body.description ?? null, body.areaKm2 ?? null, JSON.stringify(body.metadata),
        ],
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /regions/:id
router.patch(
  '/:id',
  requireAuth,
  requireRole('admin', 'geologist'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const body = UpdateBody.parse(req.body);
      const pool = getPool();

      const colMap: Record<string, string> = {
        name: 'name', country: 'country', colonialName: 'colonial_name',
        modernName: 'modern_name', description: 'description',
        areaKm2: 'area_km2', metadata: 'metadata',
      };

      const fields: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      for (const [key, col] of Object.entries(colMap)) {
        if (key in body && (body as Record<string, unknown>)[key] !== undefined) {
          fields.push(`${col} = $${p++}`);
          const val = (body as Record<string, unknown>)[key];
          params.push(key === 'metadata' ? JSON.stringify(val) : val);
        }
      }

      if (!fields.length) { res.status(400).json({ error: 'No fields to update' }); return; }

      params.push(id);
      const result = await pool.query(
        `UPDATE msim_regions SET ${fields.join(',')} WHERE id = $${p} RETURNING *`,
        params,
      );

      if (!result.rows[0]) { res.status(404).json({ error: 'Region not found' }); return; }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /regions/:id
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      await getPool().query('DELETE FROM msim_regions WHERE id = $1', [id]);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;

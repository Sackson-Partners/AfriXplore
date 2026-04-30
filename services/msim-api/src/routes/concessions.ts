import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '@ain/auth';
import { getPool } from '@ain/database';
import { z } from 'zod';

const router = Router();

const ListQuery = z.object({
  regionId:  z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  country:   z.string().max(100).optional(),
  mineral:   z.string().max(100).optional(),
  status:    z.enum(['active','historical','disputed','surrendered']).optional(),
  search:    z.string().max(200).optional(),
  page:      z.coerce.number().int().min(1).default(1),
  pageSize:  z.coerce.number().int().min(1).max(100).default(20),
});

const CreateBody = z.object({
  name:            z.string().min(1).max(500),
  colonialName:    z.string().optional(),
  regionId:        z.string().uuid().optional(),
  companyId:       z.string().uuid().optional(),
  country:         z.string().min(1).max(100),
  district:        z.string().optional(),
  grantedYear:     z.number().int().min(1400).max(2100).optional(),
  revokedYear:     z.number().int().min(1400).max(2100).optional(),
  areaHa:          z.number().positive().optional(),
  minerals:        z.array(z.string()).default([]),
  status:          z.enum(['active','historical','disputed','surrendered']).default('historical'),
  notes:           z.string().optional(),
  sourceReference: z.string().optional(),
  metadata:        z.record(z.unknown()).default({}),
});

const UpdateBody = CreateBody.partial();

// GET /concessions
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = ListQuery.parse(req.query);
    const pool = getPool();

    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (q.regionId)  { conditions.push(`c.region_id = $${p++}`);         params.push(q.regionId); }
    if (q.companyId) { conditions.push(`c.company_id = $${p++}`);        params.push(q.companyId); }
    if (q.country)   { conditions.push(`c.country ILIKE $${p++}`);       params.push(`%${q.country}%`); }
    if (q.mineral)   { conditions.push(`$${p++} = ANY(c.minerals)`);     params.push(q.mineral.toLowerCase()); }
    if (q.status)    { conditions.push(`c.status = $${p++}`);            params.push(q.status); }
    if (q.search) {
      conditions.push(`c.search_vector @@ plainto_tsquery('english', $${p++})`);
      params.push(q.search);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (q.page - 1) * q.pageSize;

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT c.*,
                r.name AS region_name,
                mc.name AS company_name
         FROM msim_concessions c
         LEFT JOIN msim_regions r ON r.id = c.region_id
         LEFT JOIN msim_mining_companies mc ON mc.id = c.company_id
         ${where}
         ORDER BY c.granted_year DESC NULLS LAST, c.name
         LIMIT $${p} OFFSET $${p + 1}`,
        [...params, q.pageSize, offset],
      ),
      pool.query(`SELECT COUNT(*) AS total FROM msim_concessions c ${where}`, params),
    ]);

    res.json({ data: rows.rows, total: Number(countRow.rows[0].total), page: q.page, pageSize: q.pageSize });
  } catch (err) {
    next(err);
  }
});

// GET /concessions/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const pool = getPool();

    const result = await pool.query(
      `SELECT c.*,
              r.name AS region_name,
              mc.name AS company_name
       FROM msim_concessions c
       LEFT JOIN msim_regions r ON r.id = c.region_id
       LEFT JOIN msim_mining_companies mc ON mc.id = c.company_id
       WHERE c.id = $1`,
      [id],
    );

    if (!result.rows[0]) { res.status(404).json({ error: 'Concession not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /concessions
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'geologist'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = CreateBody.parse(req.body);
      const pool = getPool();

      const result = await pool.query(
        `INSERT INTO msim_concessions
           (name, colonial_name, region_id, company_id, country, district,
            granted_year, revoked_year, area_ha, minerals, status,
            notes, source_reference, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          body.name, body.colonialName ?? null, body.regionId ?? null, body.companyId ?? null,
          body.country, body.district ?? null, body.grantedYear ?? null, body.revokedYear ?? null,
          body.areaHa ?? null, body.minerals, body.status,
          body.notes ?? null, body.sourceReference ?? null, JSON.stringify(body.metadata),
        ],
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /concessions/:id
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
        name: 'name', colonialName: 'colonial_name', regionId: 'region_id',
        companyId: 'company_id', country: 'country', district: 'district',
        grantedYear: 'granted_year', revokedYear: 'revoked_year', areaHa: 'area_ha',
        minerals: 'minerals', status: 'status', notes: 'notes',
        sourceReference: 'source_reference', metadata: 'metadata',
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
        `UPDATE msim_concessions SET ${fields.join(',')} WHERE id = $${p} RETURNING *`,
        params,
      );

      if (!result.rows[0]) { res.status(404).json({ error: 'Concession not found' }); return; }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /concessions/:id
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      await getPool().query('DELETE FROM msim_concessions WHERE id = $1', [id]);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;

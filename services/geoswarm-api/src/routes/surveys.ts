import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPool } from '@ain/database';
import { requireAuth } from '@ain/auth';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

const SENSOR_TYPES = ['aeromagnetics', 'gravity', 'hyperspectral'] as const;

const QuoteSchema = z.object({
  area_km2: z.number().positive(),
  sensor_types: z.array(z.enum(SENSOR_TYPES)).min(1),
});

const OrderSchema = z.object({
  area_km2: z.number().positive(),
  sensor_types: z.array(z.enum(SENSOR_TYPES)).min(1),
  project_name: z.string().min(1).max(200),
  contact_email: z.string().email(),
  notes: z.string().optional(),
});

function calculateQuote(area_km2: number, sensor_types: string[]) {
  const base_price_usd = area_km2 * 450 + sensor_types.length * 8000;
  const mobilization_usd = 12000;
  const total_usd = base_price_usd + mobilization_usd;
  const turnaround_days = 14 + Math.floor(area_km2 / 100);
  return { area_km2, sensor_types, base_price_usd, mobilization_usd, total_usd, turnaround_days };
}

// POST /surveys/quote — calculate a survey quote
router.post('/quote', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const body = QuoteSchema.parse(req.body);
    const quote = calculateQuote(body.area_km2, body.sensor_types);
    res.status(200).json(quote);
  } catch (err) {
    next(err);
  }
});

// POST /surveys/orders — create a survey order
router.post('/orders', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = OrderSchema.parse(req.body);
    const quote = calculateQuote(body.area_km2, body.sensor_types);

    try {
      const pool = getPool();
      const result = await pool.query(
        `INSERT INTO survey_orders
           (project_name, contact_email, area_km2, sensor_types, base_price_usd, mobilization_usd, total_usd, turnaround_days, notes, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
         RETURNING *`,
        [
          body.project_name,
          body.contact_email,
          body.area_km2,
          body.sensor_types,
          quote.base_price_usd,
          quote.mobilization_usd,
          quote.total_usd,
          quote.turnaround_days,
          body.notes ?? null,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (dbErr) {
      const pg = dbErr as { code?: string };
      if (pg.code === '42P01') {
        // Table doesn't exist — return a mock order
        res.status(201).json({
          id: `mock-${Date.now()}`,
          project_name: body.project_name,
          contact_email: body.contact_email,
          ...quote,
          status: 'pending',
          created_at: new Date().toISOString(),
          _mock: true,
        });
      } else {
        throw dbErr;
      }
    }
  } catch (err) {
    next(err);
  }
});

// GET /surveys/orders — list orders
router.get('/orders', requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM survey_orders ORDER BY created_at DESC LIMIT 100`
    );
    res.status(200).json({ data: result.rows, total: result.rowCount ?? result.rows.length });
  } catch (err) {
    const pg = err as { code?: string };
    if (pg.code === '42P01') {
      res.status(200).json({ data: [], total: 0 });
    } else {
      next(err);
    }
  }
});

// GET /surveys/orders/:id — single order
router.get('/orders/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(`SELECT * FROM survey_orders WHERE id = $1`, [req.params.id]);
    if (!result.rows.length) {
      next(createError(404, 'Not Found', `Survey order ${req.params.id} not found`));
      return;
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    const pg = err as { code?: string };
    if (pg.code === '42P01') {
      next(createError(404, 'Not Found', `Survey order ${req.params.id} not found`));
    } else {
      next(err);
    }
  }
});

export default router;

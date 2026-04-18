import { Router, Request, Response } from 'express';
import { db } from '../db/client';

const router = Router();

router.get('/history', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { limit = 20, cursor } = req.query;

  let query = `
    SELECT id, type, amount_usd, provider, status, initiated_at, completed_at
    FROM payments
    WHERE scout_id = $1
  `;
  const params: any[] = [userId];

  if (cursor) {
    query += ` AND initiated_at < $2`;
    params.push(cursor);
  }

  query += ` ORDER BY initiated_at DESC LIMIT $${params.length + 1}`;
  params.push(Math.min(Number(limit), 100));

  const result = await db.query(query, params);
  return res.json({ data: result.rows, count: result.rows.length });
});

export { router as paymentsRouter };

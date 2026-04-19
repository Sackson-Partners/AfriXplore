import { Router, Request, Response } from 'express';
import { db } from '../db/client';

const router = Router();

/**
 * @openapi
 * /api/v1/payments/history:
 *   get:
 *     summary: Scout payment history
 *     description: Returns paginated list of finder-fee payments for the authenticated scout.
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: ISO timestamp of last item (for cursor pagination)
 *     responses:
 *       200:
 *         description: Payment list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Payment'
 *                 next_cursor:
 *                   type: string
 *                   nullable: true
 *       401:
 *         $ref: '#/components/schemas/Error'
 */
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

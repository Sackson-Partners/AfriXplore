import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '@afrixplore/validation';
import { db } from '../db/client';

const router = Router();

const PaymentHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime({ message: 'cursor must be an ISO 8601 timestamp' }).optional(),
});

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
router.get('/history', validate(PaymentHistoryQuerySchema, 'query'), async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { limit, cursor } = req.query as unknown as z.infer<typeof PaymentHistoryQuerySchema>;

  let query = `
    SELECT id, type, amount_usd, provider, status, initiated_at, completed_at
    FROM payments
    WHERE scout_id = $1
  `;
  const params: (string | number)[] = [userId];

  if (cursor) {
    query += ` AND initiated_at < $2`;
    params.push(cursor);
  }

  query += ` ORDER BY initiated_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await db.query(query, params);
  return res.json({ data: result.rows, count: result.rows.length });
});

export { router as paymentsRouter };

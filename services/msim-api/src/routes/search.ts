import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '@ain/auth';
import { z } from 'zod';
import { searchMines } from '../services/search.service.js';

const router = Router();

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  top: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /search?q=gold+south+africa
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { q, top } = SearchQuerySchema.parse(req.query);
    const result = await searchMines(q, top);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

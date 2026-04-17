import { Router } from 'express';
import { db } from '../db/client';

const router = Router();

router.get('/', (_, res) => {
  res.json({ status: 'ok', service: 'intelligence-api', timestamp: new Date().toISOString() });
});

router.get('/ready', async (_, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ready', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'not_ready', database: 'disconnected' });
  }
});

export { router as healthRouter };

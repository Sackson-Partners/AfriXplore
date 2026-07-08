import { Router, Request, Response } from 'express';
import { getPool } from '@ain/database';

const router = Router();

// GET /health — simple liveness
router.get('/', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', service: 'geoswarm-api', timestamp: new Date().toISOString() });
});

// GET /health/live — liveness probe
router.get('/live', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /health/ready — readiness probe (checks DB connectivity)
router.get('/ready', async (_req: Request, res: Response): Promise<void> => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    const e = err as Record<string, unknown>;
    res.status(503).json({
      status: 'unavailable',
      database: 'disconnected',
      detail: e?.message ?? String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { getPool } from '@ain/database';
import * as os from 'os';

const router = Router();

// GET /health/live — liveness probe (always 200 if process is running)
router.get('/live', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /health/ready — readiness probe (checks DB connectivity)
router.get('/ready', async (_req: Request, res: Response): Promise<void> => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'unavailable',
      database: 'disconnected',
      detail: String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health/metrics — process metrics for monitoring
router.get('/metrics', (_req: Request, res: Response): void => {
  const mem = process.memoryUsage();
  res.status(200).json({
    uptime_seconds: process.uptime(),
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
    },
    cpu_count: os.cpus().length,
    node_version: process.version,
    timestamp: new Date().toISOString(),
  });
});

export default router;

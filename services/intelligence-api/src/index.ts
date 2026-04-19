import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { clustersRouter } from './routes/clusters';
import { targetsRouter } from './routes/targets';
import { exportRouter } from './routes/export';
import { streamRouter } from './routes/stream';
import { db } from './db/client';
import { authMiddleware } from './middleware/auth';
import { generalLimiter, exportLimiter } from './middleware/rateLimiter';

const SERVICE_NAME = 'intelligence-api';
process.env.SERVICE_NAME = SERVICE_NAME;

// Inline structured logger (no external dep needed — outputs JSON for Azure Monitor)
const log = {
  info:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'info',  service: SERVICE_NAME, ts: new Date().toISOString(), msg, ...extra }) + '\n'),
  error: (msg: string, extra?: object) => process.stderr.write(JSON.stringify({ level: 'error', service: SERVICE_NAME, ts: new Date().toISOString(), msg, ...extra }) + '\n'),
};

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || 'https://platform.afrixplore.io' }));
app.use(compression());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', service: 'intelligence-api', ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', detail: String(err) });
  }
});

app.use('/api/v1', authMiddleware, generalLimiter);
app.use('/api/v1/clusters',  clustersRouter);
app.use('/api/v1/targets',   targetsRouter);
app.use('/api/v1/export',    exportLimiter, exportRouter);
app.use('/api/v1/stream',    streamRouter);

app.listen(PORT, () => {
  log.info(`AfriXplore Intelligence API on port ${PORT}`);
});

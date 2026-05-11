import { initTelemetry } from '@afrixplore/telemetry';
initTelemetry('intelligence-api');

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger';
import { clustersRouter } from './routes/clusters';
import { targetsRouter } from './routes/targets';
import { exportRouter } from './routes/export';
import { streamRouter } from './routes/stream';
import { webhookRouter } from './routes/webhook';
import { db } from './db/client';
import { authMiddleware } from './middleware/auth';
import { subscriberMiddleware } from './middleware/subscriber';
import { mineralAssessedConsumer } from './consumers/mineralAssessedConsumer';
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
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) || 'https://platform.afrixplore.io' }));
app.use(compression());

// Stripe webhook must receive raw body — mount before express.json()
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRouter);

app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', service: 'intelligence-api', ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', detail: String(err) });
  }
});

// Swagger UI — dev and staging only; JSON spec always available
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'AfriXplore Intelligence API Docs',
    swaggerOptions: { persistAuthorization: true },
  }));
  app.get('/api/v1/docs.json', (_req, res) => res.json(swaggerSpec));
}

app.use('/api/v1', authMiddleware, subscriberMiddleware, generalLimiter);
app.use('/api/v1/clusters',  clustersRouter);
app.use('/api/v1/targets',   targetsRouter);
app.use('/api/v1/export',    exportLimiter, exportRouter);
app.use('/api/v1/stream',    streamRouter);

const server = app.listen(PORT, () => {
  log.info(`AfriXplore Intelligence API on port ${PORT}`);
});

// Start DPI scoring consumer (only when SERVICE_BUS_CONNECTION_STRING is set)
if (process.env.SERVICE_BUS_CONNECTION_STRING) {
  mineralAssessedConsumer.start().catch((err) => {
    log.error('Failed to start MineralAssessedConsumer', { error: String(err) });
  });

  const gracefulShutdown = async () => {
    await mineralAssessedConsumer.stop();
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT',  gracefulShutdown);
}

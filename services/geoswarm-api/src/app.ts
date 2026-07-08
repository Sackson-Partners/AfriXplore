import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import healthRouter from './routes/health.js';
import surveysRouter from './routes/surveys.js';
import anomaliesRouter from './routes/anomalies.js';
import reportsRouter from './routes/reports.js';
import missionsRouter from './routes/missions.js';
import scoutsRouter from './routes/scouts.js';
import analyticsRouter from './routes/analytics.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp(): express.Application {
  const app = express();

  // Trust Azure Container Apps / load-balancer proxy
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://localhost:3001,http://localhost:3004').split(','),
      credentials: true,
    })
  );

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Body parsing & compression
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));

  // Request logging (skip in test)
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // Routes
  app.use('/health', healthRouter);
  app.use('/surveys', surveysRouter);
  app.use('/anomalies', anomaliesRouter);
  app.use('/reports', reportsRouter);
  app.use('/missions', missionsRouter);
  app.use('/scouts', scoutsRouter);
  app.use('/analytics', analyticsRouter);

  // 404 + error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

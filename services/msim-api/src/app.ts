import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import healthRouter from './routes/health.js';
import minesRouter from './routes/mines.js';
import exportRouter from './routes/export.js';
import searchRouter from './routes/search.js';
import systemsRouter from './routes/systems.js';
import targetsRouter from './routes/targets.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp(): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(','),
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
  app.use('/mines', minesRouter);
  app.use('/export', exportRouter);
  app.use('/search', searchRouter);
  app.use('/systems', systemsRouter);
  app.use('/targets', targetsRouter);

  // 404 + error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

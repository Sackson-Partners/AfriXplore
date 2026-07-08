import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import {
  initializeSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  sentryUserContextMiddleware,
} from '@ain/monitoring';

import healthRouter from './routes/health.js';
import minesRouter from './routes/mines.js';
import exportRouter from './routes/export.js';
import searchRouter from './routes/search.js';
import systemsRouter from './routes/systems.js';
import targetsRouter from './routes/targets.js';
import recordsRouter from './routes/records.js';
import concessionsRouter from './routes/concessions.js';
import regionsRouter from './routes/regions.js';
import documentsRouter from './routes/documents.js';
import msimSearchRouter from './routes/msim-search.js';
import analyticsRouter from './routes/analytics.js';
import archiveRevivalRouter from './routes/archive-revival.js';
import archiveDocsRouter from './routes/archive-documents.js';
import dataRoomRouter from './routes/data-room.js';
import dealsRouter from './routes/deals.js';
import convergenceRouter from './routes/convergence.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import {
  createCSRFProtection,
  csrfErrorHandler,
  createTimeoutMiddleware,
  TIMEOUT_PRESETS,
  createRouteBasedTimeoutResolver
} from '@ain/security';

export function createApp(): express.Application {
  const app = express();

  // Initialize Sentry (must be first)
  if (process.env.SENTRY_DSN) {
    initializeSentry({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      release: process.env.SENTRY_RELEASE,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    });

    // Sentry request handler must be the first middleware
    app.use(sentryRequestHandler());
    // TracingHandler creates a trace for every incoming request
    app.use(sentryTracingHandler());
  }

  // Trust Azure Container Apps / load-balancer proxy (fixes express-rate-limit X-Forwarded-For warning)
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://localhost:3001').split(','),
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
  app.use(cookieParser());

  // Request timeout middleware
  app.use(createTimeoutMiddleware({
    getTimeout: createRouteBasedTimeoutResolver({
      '/convergence': TIMEOUT_PRESETS.LONG,
      '/analytics': TIMEOUT_PRESETS.MEDIUM,
      '/export': TIMEOUT_PRESETS.MEDIUM,
      '/msim-search': TIMEOUT_PRESETS.MEDIUM,
      '/archive-revival': TIMEOUT_PRESETS.LONG,
    })
  }));

  // CSRF protection (skip in test and development for easier testing)
  if (process.env.NODE_ENV === 'production') {
    app.use(createCSRFProtection({
      cookie: {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 3600000, // 1 hour
      }
    }));

    // Endpoint to get CSRF token
    app.get('/csrf-token', (req, res) => {
      res.json({ csrfToken: req.csrfToken() });
    });
  }

  // Request logging (skip in test)
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // Sentry user context middleware (after auth, before routes)
  if (process.env.SENTRY_DSN) {
    app.use(sentryUserContextMiddleware);
  }

  // Routes
  app.use('/health', healthRouter);
  app.use('/mines', minesRouter);
  app.use('/export', exportRouter);
  app.use('/search', searchRouter);
  app.use('/systems', systemsRouter);
  app.use('/targets', targetsRouter);
  // MSIM Phase 1
  app.use('/records', recordsRouter);
  app.use('/concessions', concessionsRouter);
  app.use('/regions', regionsRouter);
  app.use('/documents', documentsRouter);
  app.use('/msim-search', msimSearchRouter);
  app.use('/analytics', analyticsRouter);
  // MSIM Phase 2
  app.use('/archive-revival', archiveRevivalRouter);
  app.use('/archive-docs', archiveDocsRouter);
  app.use('/data-room', dataRoomRouter);
  app.use('/deals', dealsRouter);
  // MSIM-GeoSwarm Integration (Phase 5)
  app.use('/convergence', convergenceRouter);

  // 404 + error handling
  app.use(notFoundHandler);

  // CSRF error handler (must come before general error handler)
  if (process.env.NODE_ENV === 'production') {
    app.use(csrfErrorHandler);
  }

  // Sentry error handler (must come before other error handlers)
  if (process.env.SENTRY_DSN) {
    app.use(sentryErrorHandler());
  }

  app.use(errorHandler);

  return app;
}

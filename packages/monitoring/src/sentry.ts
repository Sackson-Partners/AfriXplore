/**
 * Sentry Error Tracking Integration
 * Real-time error monitoring and performance tracking
 */

import * as Sentry from '@sentry/node';
import type { Express, Request, Response, NextFunction } from 'express';

export interface SentryConfig {
  dsn: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
  beforeSend?: (event: Sentry.Event) => Sentry.Event | null;
}

/**
 * Initialize Sentry for Node.js backend
 */
export function initializeSentry(config: SentryConfig): void {
  if (!config.dsn) {
    console.warn('[Sentry] DSN not provided, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment || process.env.NODE_ENV || 'development',
    release: config.release || process.env.SENTRY_RELEASE || 'unknown',

    // Performance Monitoring
    tracesSampleRate: config.tracesSampleRate ?? (
      process.env.NODE_ENV === 'production' ? 0.1 : 1.0
    ),

    // Profiling
    profilesSampleRate: config.profilesSampleRate ?? (
      process.env.NODE_ENV === 'production' ? 0.1 : 1.0
    ),

    // Integrations
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: undefined as any }),
      new Sentry.Integrations.Postgres(),
    ],

    // Before send hook
    beforeSend: config.beforeSend || ((event) => {
      // Filter out health check errors
      if (event.request?.url?.includes('/health')) {
        return null;
      }
      return event;
    }),

    // Error filtering
    ignoreErrors: [
      // Browser errors that shouldn't be tracked on server
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      // Common bot/crawler errors
      'Request aborted',
      'socket hang up',
    ],
  });

  console.log('[Sentry] Initialized for', config.environment);
}

/**
 * Express middleware for Sentry request handling
 */
export function sentryRequestHandler(): any {
  return Sentry.Handlers.requestHandler({
    user: ['id', 'email', 'username'],
    ip: true,
    transaction: 'methodPath', // Use method + path as transaction name
  });
}

/**
 * Express middleware for Sentry tracing
 */
export function sentryTracingHandler(): any {
  return Sentry.Handlers.tracingHandler();
}

/**
 * Express error handler middleware (must be after all routes)
 */
export function sentryErrorHandler(): any {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error: Error) {
      // Capture 4xx and 5xx errors
      return true;
    },
  });
}

/**
 * Capture exception manually
 */
export function captureException(error: Error, context?: Record<string, any>): string {
  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture message manually
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
): string {
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(user: {
  id: string;
  email?: string;
  username?: string;
  [key: string]: any;
}): void {
  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Set custom context tags
 */
export function setTags(tags: Record<string, string>): void {
  Sentry.setTags(tags);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, any>;
}): void {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Start a new transaction for performance monitoring
 */
export function startTransaction(options: {
  name: string;
  op: string;
  description?: string;
  tags?: Record<string, string>;
}): Sentry.Transaction {
  return Sentry.startTransaction({
    name: options.name,
    op: options.op,
    description: options.description,
    tags: options.tags,
  });
}

/**
 * Flush Sentry events (useful before process exit)
 */
export async function flush(timeout = 2000): Promise<boolean> {
  return Sentry.flush(timeout);
}

/**
 * Close Sentry client
 */
export async function close(timeout = 2000): Promise<boolean> {
  return Sentry.close(timeout);
}

/**
 * Express middleware to set user context from JWT
 */
export function sentryUserContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // @ts-ignore - user is added by auth middleware
  const user = req.user;

  if (user) {
    setUser({
      id: user.id || user.sub,
      email: user.email,
      username: user.name || user.username,
    });
  }

  next();
}

/**
 * Wrap async function with Sentry error capture
 */
export function wrapWithSentry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operationName: string
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const transaction = startTransaction({
      name: operationName,
      op: 'function',
    });

    try {
      const result = await fn(...args);
      transaction.setStatus('ok');
      return result;
    } catch (error) {
      transaction.setStatus('internal_error');
      captureException(error as Error, {
        operation: operationName,
        arguments: args,
      });
      throw error;
    } finally {
      transaction.finish();
    }
  }) as T;
}

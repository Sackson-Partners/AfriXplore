/**
 * Request Timeout Middleware
 * Prevents resource exhaustion from long-running requests
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

export interface TimeoutOptions {
  /**
   * Default timeout in milliseconds
   * Default: 30000 (30 seconds)
   */
  timeout?: number;
  /**
   * Custom timeout resolver based on request
   * Allows per-route timeout configuration
   */
  getTimeout?: (req: Request) => number;
  /**
   * Custom error handler
   */
  onTimeout?: (req: Request, res: Response) => void;
}

/**
 * Create request timeout middleware
 *
 * @example
 * ```typescript
 * import { createTimeoutMiddleware } from '@ain/security/timeout';
 *
 * // Global timeout
 * app.use(createTimeoutMiddleware({ timeout: 30000 }));
 *
 * // Per-route timeout
 * app.use(createTimeoutMiddleware({
 *   getTimeout: (req) => {
 *     if (req.path.startsWith('/analytics')) return 60000; // 60s for analytics
 *     if (req.path.startsWith('/convergence')) return 120000; // 2min for convergence
 *     return 30000; // 30s default
 *   }
 * }));
 * ```
 */
export function createTimeoutMiddleware(options: TimeoutOptions = {}): RequestHandler {
  const {
    timeout: defaultTimeout = 30000,
    getTimeout,
    onTimeout,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const timeoutMs = getTimeout ? getTimeout(req) : defaultTimeout;

    // Skip timeout for health checks
    if (req.path.startsWith('/health')) {
      return next();
    }

    const timer = setTimeout(() => {
      if (res.headersSent) {
        return; // Response already sent
      }

      if (onTimeout) {
        onTimeout(req, res);
      } else {
        res.status(408).json({
          type: 'https://ain-platform.com/errors/request-timeout',
          title: 'Request Timeout',
          status: 408,
          detail: `Request exceeded timeout of ${timeoutMs}ms`,
          instance: req.path,
        });
      }

      // Destroy the socket to force connection closure
      req.socket.destroy();
    }, timeoutMs);

    // Clear timeout when response finishes
    res.on('finish', () => {
      clearTimeout(timer);
    });

    // Clear timeout when connection closes
    req.on('close', () => {
      clearTimeout(timer);
    });

    next();
  };
}

/**
 * Predefined timeout configurations for common routes
 */
export const TIMEOUT_PRESETS = {
  /**
   * Short timeout for simple CRUD operations (10s)
   */
  SHORT: 10000,
  /**
   * Default timeout for standard API requests (30s)
   */
  DEFAULT: 30000,
  /**
   * Medium timeout for analytics and searches (60s)
   */
  MEDIUM: 60000,
  /**
   * Long timeout for heavy computations (2min)
   */
  LONG: 120000,
  /**
   * Extended timeout for batch operations (5min)
   */
  EXTENDED: 300000,
} as const;

/**
 * Timeout resolver based on route patterns
 */
export function createRouteBasedTimeoutResolver(
  routeTimeouts: Record<string, number>
): (req: Request) => number {
  return (req: Request): number => {
    // Check for exact match
    if (routeTimeouts[req.path]) {
      return routeTimeouts[req.path];
    }

    // Check for prefix match
    for (const [pattern, timeout] of Object.entries(routeTimeouts)) {
      if (req.path.startsWith(pattern)) {
        return timeout;
      }
    }

    // Default timeout
    return TIMEOUT_PRESETS.DEFAULT;
  };
}

/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */

import csrf from 'csurf';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

export interface CSRFOptions {
  /**
   * Cookie options for CSRF token storage
   */
  cookie?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
  };
  /**
   * Custom token value function
   */
  value?: (req: Request) => string | undefined;
  /**
   * Custom ignored methods (default: ['GET', 'HEAD', 'OPTIONS'])
   */
  ignoreMethods?: string[];
}

/**
 * Create CSRF protection middleware
 *
 * @example
 * ```typescript
 * import cookieParser from 'cookie-parser';
 * import { createCSRFProtection } from '@ain/security/csrf';
 *
 * app.use(cookieParser());
 * app.use(createCSRFProtection({ cookie: { httpOnly: true, secure: true }}));
 *
 * // Send token to client
 * app.get('/api/csrf-token', (req, res) => {
 *   res.json({ csrfToken: req.csrfToken() });
 * });
 *
 * // Validate on state-changing operations
 * app.post('/api/mines', (req, res) => {
 *   // Token automatically validated by middleware
 *   // ...
 * });
 * ```
 */
export function createCSRFProtection(options: CSRFOptions = {}): RequestHandler {
  const {
    cookie = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 3600000, // 1 hour
    },
    ignoreMethods = ['GET', 'HEAD', 'OPTIONS'],
  } = options;

  return csrf({
    cookie,
    ignoreMethods,
    value: options.value as ((req: any) => string) | undefined,
  });
}

/**
 * CSRF error handler middleware
 * Returns structured error response for CSRF token validation failures
 */
export function csrfErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err.code === 'EBADCSRFTOKEN') {
    res.status(403).json({
      type: 'https://ain-platform.com/errors/csrf-token-invalid',
      title: 'CSRF Token Invalid',
      status: 403,
      detail: 'CSRF token validation failed. Please refresh the page and try again.',
      instance: req.path,
    });
  } else {
    next(err);
  }
}

/**
 * Express type augmentation for csrfToken() method
 */
declare global {
  namespace Express {
    interface Request {
      csrfToken(): string;
    }
  }
}

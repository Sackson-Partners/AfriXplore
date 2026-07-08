import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 10 * 60 * 1000);

/**
 * Rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    // Get client identifier (IP address or user ID)
    const identifier = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const key = `${identifier}:${req.path}`;

    const now = Date.now();
    const record = store[key];

    if (!record || record.resetTime < now) {
      // New window or expired
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    if (record.count >= maxRequests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', record.resetTime.toString());

      return res.status(429).json({
        error: 'Rate limit exceeded',
        message,
        retryAfter,
      });
    }

    // Increment counter
    record.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - record.count).toString());
    res.setHeader('X-RateLimit-Reset', record.resetTime.toString());

    // If skip successful requests, decrement on success
    if (skipSuccessfulRequests) {
      const originalSend = res.send;
      res.send = function (data) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          record.count--;
        }
        return originalSend.call(this, data);
      };
    }

    next();
  };
}

/**
 * Preset rate limiters
 */
export const rateLimiters = {
  // General API calls: 100 requests per 15 minutes
  api: rateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
  }),

  // Search: 30 requests per minute
  search: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 30,
  }),

  // Convergence scoring: 10 requests per minute (expensive operation)
  convergenceScore: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: 'Convergence scoring rate limit exceeded. This is a resource-intensive operation.',
  }),

  // Authentication: 5 attempts per 15 minutes
  auth: rateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again later.',
    skipSuccessfulRequests: true,
  }),

  // File uploads: 20 per hour
  upload: rateLimit({
    windowMs: 60 * 60 * 1000,
    maxRequests: 20,
    message: 'Upload limit exceeded. Please wait before uploading more files.',
  }),
};

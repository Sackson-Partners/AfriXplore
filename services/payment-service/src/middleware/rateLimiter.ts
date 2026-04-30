import rateLimit from 'express-rate-limit';

const rateLimitMessage = (retryAfter: string, detail?: string) => ({
  type: 'https://afrixplore.io/errors/rate-limited',
  status: 429,
  title: 'Too Many Requests',
  detail: detail || `Rate limit exceeded. Please retry after ${retryAfter}.`,
  retryAfter,
});

// Payment endpoints — strict (financial operations)
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage('1 hour', 'Too many payment attempts. Please retry after 1 hour.'),
});

// Mobile money — per-hour limit per IP
export const mobileMoneyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage('1 hour', 'Mobile money limit reached. Please retry after 1 hour.'),
});

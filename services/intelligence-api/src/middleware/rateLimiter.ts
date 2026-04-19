import rateLimit from 'express-rate-limit';

const rateLimitMessage = (retryAfter: string) => ({
  type: 'https://afrixplore.io/errors/rate-limited',
  status: 429,
  title: 'Too Many Requests',
  detail: `Rate limit exceeded. Please retry after ${retryAfter}.`,
  retryAfter,
});

// General API limit — all authenticated routes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: rateLimitMessage('15 minutes'),
});

// Export endpoint — potentially expensive, stricter limit
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage('1 hour'),
});

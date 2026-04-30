import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: {
    type: 'https://afrixplore.io/errors/rate-limited',
    status: 429,
    title: 'Too Many Requests',
    detail: 'Rate limit exceeded. Please retry after 15 minutes.',
    retryAfter: '15 minutes',
  },
});

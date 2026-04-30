import rateLimit from 'express-rate-limit';

const rateLimitMessage = (retryAfter: string, detail?: string) => ({
  type: 'https://afrixplore.io/errors/rate-limited',
  status: 429,
  title: 'Too Many Requests',
  detail: detail || `Rate limit exceeded. Please retry after ${retryAfter}.`,
  retryAfter,
});

// Auth endpoints — strict limit to prevent brute force / OTP abuse
// Note: route already tracks OTP attempts in DB — this is an additional layer
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage('15 minutes', 'Too many authentication attempts. Please retry after 15 minutes.'),
});

// File upload limit — prevent storage abuse
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage('1 hour', 'Maximum 20 uploads per hour reached.'),
});

// USSD — high limit, Africa's Talking can burst during peak hours
export const ussdLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage('1 minute'),
});

// General scout routes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: rateLimitMessage('15 minutes'),
});

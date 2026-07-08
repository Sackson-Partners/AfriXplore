/**
 * Authentication Middleware for Metrics Endpoint
 * Protects /health/metrics from unauthorized access
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Authenticate metrics endpoint access
 * Supports two authentication methods:
 * 1. API key in Authorization header
 * 2. Internal IP whitelist
 */
export function authenticateMetrics(req: Request, res: Response, next: NextFunction): void {
  // Skip authentication in development
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return next();
  }

  // Method 1: API Key Authentication
  const authHeader = req.headers.authorization;
  const metricsApiKey = process.env.METRICS_API_KEY;

  if (authHeader && metricsApiKey) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === metricsApiKey) {
      return next();
    }
  }

  // Method 2: Internal IP Whitelist
  const clientIp = (req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const allowedIps = (process.env.METRICS_ALLOWED_IPS || '127.0.0.1,::1').split(',');

  if (allowedIps.includes(clientIp)) {
    return next();
  }

  // Also allow Azure internal IPs (common private IP ranges)
  const isInternalAzureIp =
    clientIp.startsWith('10.') ||
    clientIp.startsWith('172.16.') ||
    clientIp.startsWith('172.17.') ||
    clientIp.startsWith('172.18.') ||
    clientIp.startsWith('172.19.') ||
    clientIp.startsWith('172.20.') ||
    clientIp.startsWith('172.21.') ||
    clientIp.startsWith('172.22.') ||
    clientIp.startsWith('172.23.') ||
    clientIp.startsWith('172.24.') ||
    clientIp.startsWith('172.25.') ||
    clientIp.startsWith('172.26.') ||
    clientIp.startsWith('172.27.') ||
    clientIp.startsWith('172.28.') ||
    clientIp.startsWith('172.29.') ||
    clientIp.startsWith('172.30.') ||
    clientIp.startsWith('172.31.') ||
    clientIp.startsWith('192.168.');

  if (isInternalAzureIp) {
    return next();
  }

  // Unauthorized
  res.status(403).json({
    type: 'https://ain-platform.com/errors/forbidden',
    title: 'Forbidden',
    status: 403,
    detail: 'Access to metrics endpoint requires authentication',
    instance: req.path,
  });
}

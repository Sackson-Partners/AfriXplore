import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = crypto.randomUUID();

  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    const entry = JSON.stringify({
      level,
      service: 'scout-api',
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      userId: (req as any).userId,
      timestamp: new Date().toISOString(),
    });
    (level === 'error' ? process.stderr : process.stdout).write(entry + '\n');
  });

  next();
}

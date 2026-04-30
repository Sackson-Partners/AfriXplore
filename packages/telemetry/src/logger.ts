/**
 * AfriXplore — Structured Logger
 * JSON stdout logger compatible with Azure Container Apps Log Analytics.
 * Fields are automatically indexed by Azure Monitor.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configuredLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function write(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[configuredLevel]) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.SERVICE_NAME || 'afrixplore',
    environment: process.env.NODE_ENV || 'development',
    msg,
    ...extra,
  };
  const out = level === 'error' ? process.stderr : process.stdout;
  out.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  debug: (msg: string, extra?: Record<string, unknown>) => write('debug', msg, extra),
  info:  (msg: string, extra?: Record<string, unknown>) => write('info',  msg, extra),
  warn:  (msg: string, extra?: Record<string, unknown>) => write('warn',  msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => write('error', msg, extra),
};

/**
 * Express request logging middleware.
 * Replaces console.log in requestLogger — outputs structured JSON per request.
 * Attaches x-request-id to req and res for correlation.
 */
export function requestLoggerMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();

    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);

    res.on('finish', () => {
      const level: LogLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      write(level, `${req.method} ${req.path} ${res.statusCode}`, {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: Date.now() - start,
        userId: req.userId,
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      });
    });

    next();
  };
}

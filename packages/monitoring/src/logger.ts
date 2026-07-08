import { Request } from 'express';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogContext {
  correlationId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private serviceName: string;
  private minLevel: LogLevel;

  constructor(serviceName: string, minLevel: LogLevel = LogLevel.INFO) {
    this.serviceName = serviceName;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: Error): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        service: this.serviceName,
        ...context,
      },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return JSON.stringify(entry);
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatLog(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatLog(LogLevel.INFO, message, context));
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatLog(LogLevel.WARN, message, context));
    }
  }

  error(message: string, error?: Error, context?: LogContext) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatLog(LogLevel.ERROR, message, context, error));
    }
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    const childLogger = new Logger(this.serviceName, this.minLevel);
    const originalFormat = childLogger.formatLog.bind(childLogger);

    childLogger.formatLog = (level, message, context, error) => {
      return originalFormat(level, message, { ...additionalContext, ...context }, error);
    };

    return childLogger;
  }
}

/**
 * Extract correlation ID from request headers
 */
export function getCorrelationId(req: Request): string {
  return (req.headers['x-correlation-id'] as string) ||
         (req.headers['x-request-id'] as string) ||
         `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create logger instance
 */
export function createLogger(serviceName: string): Logger {
  const level = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
  return new Logger(serviceName, level);
}

/**
 * Request logging middleware
 */
export function requestLogger(logger: Logger) {
  return (req: Request, res: any, next: any) => {
    const correlationId = getCorrelationId(req);
    const startTime = Date.now();

    // Attach correlation ID to request
    (req as any).correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    // Create request-scoped logger
    const requestLogger = logger.child({
      correlationId,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    (req as any).logger = requestLogger;

    // Log request
    requestLogger.info('Incoming request', {
      method: req.method,
      path: req.path,
      query: req.query,
      userAgent: req.headers['user-agent'],
    });

    // Log response
    const originalSend = res.send;
    res.send = function (data: any) {
      const duration = Date.now() - startTime;

      requestLogger.info('Request completed', {
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });

      return originalSend.call(this, data);
    };

    next();
  };
}

export { Logger };

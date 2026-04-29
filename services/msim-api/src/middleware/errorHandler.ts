import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  type?: string;
  detail?: string;
}

// Duck-type check for ZodError (avoids ESM module identity issues)
function isZodError(err: unknown): err is { name: string; errors: Array<{ path: (string | number)[]; message: string }> } {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as Error).name === 'ZodError' &&
    Array.isArray((err as { errors?: unknown }).errors)
  );
}

export function createError(statusCode: number, title: string, detail?: string): AppError {
  const err: AppError = new Error(title);
  err.statusCode = statusCode;
  err.detail = detail;
  return err;
}

// RFC 7807 global error handler
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle Zod validation errors as 422 (duck-typed to avoid ESM module identity issues)
  if (isZodError(err)) {
    res.status(422).json({
      type: 'https://ain.example.com/errors/422',
      title: 'Validation Error',
      status: 422,
      detail: err.errors.map((e) => `${e.path.join('.') || 'value'}: ${e.message}`).join('; '),
    });
    return;
  }

  const status = err.statusCode ?? 500;
  const title = status === 500 ? 'Internal Server Error' : err.message;

  res.status(status).json({
    type: err.type ?? `https://ain.example.com/errors/${status}`,
    title,
    status,
    detail: err.detail ?? (status === 500 ? 'An unexpected error occurred' : err.message),
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    type: 'https://ain.example.com/errors/not-found',
    title: 'Not Found',
    status: 404,
    detail: 'The requested resource was not found',
  });
}

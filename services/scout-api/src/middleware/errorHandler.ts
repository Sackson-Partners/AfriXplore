import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  process.stderr.write(JSON.stringify({ level: 'error', service: 'scout-api', ts: new Date().toISOString(), msg: 'Unhandled error', error: err.message }) + '\n');

  return res.status(500).json({
    type: 'https://afrixplore.io/errors/internal',
    title: 'Internal Server Error',
    status: 500,
    detail: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
    instance: req.path,
  });
}

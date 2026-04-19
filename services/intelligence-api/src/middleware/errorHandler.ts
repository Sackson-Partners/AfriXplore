import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  process.stderr.write(JSON.stringify({ level: 'error', service: 'intelligence-api', ts: new Date().toISOString(), msg: 'Unhandled error', error: err.message, stack: err.stack }) + '\n');
  res.status(500).json({
    type: 'https://afrixplore.io/errors/internal',
    title: 'Internal Server Error',
    status: 500,
    detail: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
}

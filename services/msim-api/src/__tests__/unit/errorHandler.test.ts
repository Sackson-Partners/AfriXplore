import { describe, it, expect, vi } from 'vitest';
import { createError, errorHandler, notFoundHandler } from '../../middleware/errorHandler.js';
import type { Request, Response, NextFunction } from 'express';

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function mockReq(path = '/test') {
  return { path } as unknown as Request;
}

describe('createError', () => {
  it('creates an error with status and detail', () => {
    const err = createError(404, 'Not found', 'Resource missing');
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.detail).toBe('Resource missing');
  });

  it('creates a 500 error without detail', () => {
    const err = createError(500, 'Internal error');
    expect(err.statusCode).toBe(500);
    expect(err.detail).toBeUndefined();
  });
});

describe('errorHandler', () => {
  it('returns RFC 7807 JSON with the error status', () => {
    const res = mockRes();
    const err = createError(422, 'Validation failed', 'name is required');
    errorHandler(err, mockReq(), res, vi.fn() as unknown as NextFunction);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 422, title: 'Validation failed' })
    );
  });

  it('returns 500 with generic message for unknown errors', () => {
    const res = mockRes();
    const err = new Error('Something exploded');
    errorHandler(err, mockReq(), res, vi.fn() as unknown as NextFunction);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500, title: 'Internal Server Error' })
    );
  });
});

describe('notFoundHandler', () => {
  it('returns 404 RFC 7807 response', () => {
    const res = mockRes();
    notFoundHandler(mockReq('/unknown'), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 404, title: 'Not Found' })
    );
  });
});

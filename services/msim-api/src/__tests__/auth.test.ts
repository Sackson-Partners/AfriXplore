/**
 * Unit tests for msim-api authMiddleware.
 *
 * Uses the standard Entra tenant endpoint (login.microsoftonline.com),
 * same pattern as intelligence-api. Behaviours tested:
 *  - Missing token → 401 unauthorized
 *  - Invalid/expired token → 401 invalid-token
 *  - Valid token → sets req.userId + req.userRole, calls next()
 *  - Missing role claim → defaults to 'subscriber'
 *  - Startup guard → process.exit(1) when DEV_BYPASS_AUTH=true in production
 */

import type { Request, Response, NextFunction } from 'express';

jest.mock('jwks-rsa', () => {
  return jest.fn(() => ({
    getSigningKey: (_kid: string, cb: (err: Error | null, key?: { getPublicKey: () => string }) => void) => {
      cb(null, { getPublicKey: () => 'fake-msim-public-key' });
    },
  }));
});

jest.mock('jsonwebtoken');
import jwt from 'jsonwebtoken';
const mockVerify = jwt.verify as jest.Mock;

import { authMiddleware } from '../middleware/auth';

function makeReqResMock(authHeader?: string) {
  const req = { headers: {} } as Request;
  if (authHeader) req.headers.authorization = authHeader;

  const res = {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn().mockReturnThis(),
  } as unknown as Response;

  const next: NextFunction = jest.fn();
  return { req, res, next };
}

describe('msim-api startup guard', () => {
  const originalExit = process.exit;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    (process.exit as any) = jest.fn();
  });

  afterEach(() => {
    process.exit = originalExit;
    process.env.NODE_ENV = originalEnv;
    delete process.env.DEV_BYPASS_AUTH;
    jest.resetModules();
  });

  it('calls process.exit(1) when DEV_BYPASS_AUTH=true in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEV_BYPASS_AUTH = 'true';
    jest.isolateModules(() => {
      require('../middleware/auth');
    });
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('does NOT call process.exit when DEV_BYPASS_AUTH=true in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_BYPASS_AUTH = 'true';
    jest.isolateModules(() => {
      require('../middleware/auth');
    });
    expect(process.exit).not.toHaveBeenCalled();
  });
});

describe('msim-api authMiddleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when Authorization header is absent', () => {
    const { req, res, next } = makeReqResMock();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect((res.json as jest.Mock).mock.calls[0][0]).toMatchObject({
      type: 'https://afrixplore.io/errors/unauthorized',
      status: 401,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with invalid-token when jwt.verify fails', () => {
    mockVerify.mockImplementation((_token, _key, _opts, callback: Function) => {
      callback(new Error('jwt expired'));
    });

    const { req, res, next } = makeReqResMock('Bearer expired.token.here');
    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect((res.json as jest.Mock).mock.calls[0][0]).toMatchObject({
      type: 'https://afrixplore.io/errors/invalid-token',
      status: 401,
      detail: 'jwt expired',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and sets req.userId + req.userRole on a valid token', () => {
    const decodedPayload = { sub: 'user-msim-123', role: 'subscriber' };
    mockVerify.mockImplementation((_token, _key, _opts, callback: Function) => {
      callback(null, decodedPayload);
    });

    const { req, res, next } = makeReqResMock('Bearer valid.msim.token');
    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).userId).toBe('user-msim-123');
    expect((req as any).userRole).toBe('subscriber');
    expect((req as any).user).toEqual(decodedPayload);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('defaults userRole to "subscriber" when role claim is absent', () => {
    mockVerify.mockImplementation((_token, _key, _opts, callback: Function) => {
      callback(null, { sub: 'user-msim-456' });
    });

    const { req, res, next } = makeReqResMock('Bearer valid.msim.token');
    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).userRole).toBe('subscriber');
  });
});

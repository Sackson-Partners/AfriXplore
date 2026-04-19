/**
 * Unit tests for intelligence-api authMiddleware (Week 1 fix verification).
 *
 * The middleware must:
 *  - Reject requests with no Authorization header (401 unauthorized)
 *  - Reject requests with an invalid/expired JWT (401 invalid-token)
 *  - Accept valid tokens: set req.user, req.userId, req.userRole, call next()
 *  - Default userRole to 'subscriber' when the claim is absent
 */

import type { Request, Response, NextFunction } from 'express';

// Mock jwks-rsa before importing the middleware so the module-level client
// is constructed with the mock instead of making real network calls.
jest.mock('jwks-rsa', () => {
  return jest.fn(() => ({
    getSigningKey: (_kid: string, cb: (err: Error | null, key?: { getPublicKey: () => string }) => void) => {
      cb(null, { getPublicKey: () => 'fake-public-key' });
    },
  }));
});

jest.mock('jsonwebtoken');
import jwt from 'jsonwebtoken';
const mockVerify = jwt.verify as jest.Mock;

// Import after mocks are in place.
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

describe('intelligence-api authMiddleware', () => {
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

  it('returns 401 when the Bearer token is missing (only "Bearer" present)', () => {
    const { req, res, next } = makeReqResMock('Bearer ');
    // split(' ')[1] is empty string — treated as falsy
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
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
    const decodedPayload = { sub: 'user-123', role: 'admin' };
    mockVerify.mockImplementation((_token, _key, _opts, callback: Function) => {
      callback(null, decodedPayload);
    });

    const { req, res, next } = makeReqResMock('Bearer valid.token.here');
    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).userId).toBe('user-123');
    expect((req as any).userRole).toBe('admin');
    expect((req as any).user).toEqual(decodedPayload);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('defaults userRole to "subscriber" when role claim is absent', () => {
    mockVerify.mockImplementation((_token, _key, _opts, callback: Function) => {
      callback(null, { sub: 'user-456' });
    });

    const { req, res, next } = makeReqResMock('Bearer valid.token.here');
    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).userRole).toBe('subscriber');
  });
});

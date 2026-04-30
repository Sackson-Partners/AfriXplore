/**
 * Unit tests for scout-api authMiddleware (Week 1 fix verification).
 *
 * Scout auth uses Azure AD CIAM (*.ciamlogin.com) rather than the standard
 * Entra tenant endpoint used by intelligence-api. Behaviours tested:
 *  - Missing token → 401 unauthorized
 *  - Invalid/expired token → 401 invalid-token
 *  - Valid token → sets req.scoutId (not req.userId), calls next()
 */

import type { Request, Response, NextFunction } from 'express';

jest.mock('jwks-rsa', () => {
  return jest.fn(() => ({
    getSigningKey: (_kid: string, cb: (err: Error | null, key?: { getPublicKey: () => string }) => void) => {
      cb(null, { getPublicKey: () => 'fake-ciam-public-key' });
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

describe('scout-api authMiddleware', () => {
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
      callback(new Error('invalid signature'));
    });

    const { req, res, next } = makeReqResMock('Bearer bad.token.here');
    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect((res.json as jest.Mock).mock.calls[0][0]).toMatchObject({
      type: 'https://afrixplore.io/errors/invalid-token',
      detail: 'invalid signature',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and sets req.scoutId on a valid token', () => {
    const decodedPayload = { sub: 'scout-abc-123' };
    mockVerify.mockImplementation((_token, _key, _opts, callback: Function) => {
      callback(null, decodedPayload);
    });

    const { req, res, next } = makeReqResMock('Bearer valid.scout.token');
    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).scoutId).toBe('scout-abc-123');
    expect((req as any).user).toEqual(decodedPayload);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('does NOT set req.userId (scout-api uses scoutId, not userId)', () => {
    mockVerify.mockImplementation((_token, _key, _opts, callback: Function) => {
      callback(null, { sub: 'scout-xyz' });
    });

    const { req, res, next } = makeReqResMock('Bearer valid.scout.token');
    authMiddleware(req, res, next);

    expect((req as any).userId).toBeUndefined();
    expect((req as any).scoutId).toBe('scout-xyz');
  });
});

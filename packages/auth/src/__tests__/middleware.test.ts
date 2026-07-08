import { Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole, requireTier } from '../middleware';
import { DecodedToken } from '../types';

// Mock @ain/config feature flags
jest.mock('@ain/config', () => ({
  featureFlags: {
    bypassAuth: jest.fn(() => false),
  },
}));

// Mock verify module
jest.mock('../verify', () => ({
  verifyToken: jest.fn(),
  InvalidTokenError: class InvalidTokenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'InvalidTokenError';
    }
  },
  TokenExpiredError: class TokenExpiredError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TokenExpiredError';
    }
  },
}));

import { verifyToken, InvalidTokenError, TokenExpiredError } from '../verify';
import { featureFlags } from '@ain/config';

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockBypassAuth = featureFlags.bypassAuth as jest.MockedFunction<typeof featureFlags.bypassAuth>;

describe('requireAuth middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      headers: {},
    };
    res = {
      status: statusMock,
    };
    next = jest.fn();

    jest.clearAllMocks();
    mockBypassAuth.mockReturnValue(false);
  });

  it('should bypass auth when feature flag is enabled', () => {
    mockBypassAuth.mockReturnValue(true);

    requireAuth(req as Request, res as Response, next);

    expect(req.user).toEqual({ sub: 'dev', roles: ['admin'], email: 'dev@local' });
    expect(next).toHaveBeenCalledWith();
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header is missing', () => {
    requireAuth(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      type: 'https://ain.example.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Authorization header is required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should set req.user and call next when token is valid', async () => {
    const mockToken: DecodedToken = {
      sub: 'user-123',
      roles: ['subscriber'],
      email: 'user@example.com',
      extension_tier: 'pro',
      extension_subscription_active: true,
    };

    req.headers = { authorization: 'Bearer valid-token' };
    mockVerifyToken.mockResolvedValue(mockToken);

    requireAuth(req as Request, res as Response, next);

    // Wait for promise to resolve
    await new Promise(process.nextTick);

    expect(mockVerifyToken).toHaveBeenCalledWith('Bearer valid-token');
    expect(req.user).toEqual(mockToken);
    expect(next).toHaveBeenCalledWith();
  });

  it('should return 401 when token is expired', async () => {
    req.headers = { authorization: 'Bearer expired-token' };
    mockVerifyToken.mockRejectedValue(new TokenExpiredError('Token expired'));

    requireAuth(req as Request, res as Response, next);

    await new Promise(process.nextTick);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      type: 'https://ain.example.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Token has expired',
    });
  });

  it('should return 401 when token is invalid', async () => {
    req.headers = { authorization: 'Bearer invalid-token' };
    mockVerifyToken.mockRejectedValue(new InvalidTokenError('Invalid signature'));

    requireAuth(req as Request, res as Response, next);

    await new Promise(process.nextTick);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      type: 'https://ain.example.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Invalid signature',
    });
  });

  it('should return 401 for generic authentication errors', async () => {
    req.headers = { authorization: 'Bearer token' };
    mockVerifyToken.mockRejectedValue(new Error('Network error'));

    requireAuth(req as Request, res as Response, next);

    await new Promise(process.nextTick);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      type: 'https://ain.example.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Authentication failed',
    });
  });
});

describe('requireRole middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      user: {
        sub: 'user-123',
        roles: ['subscriber'],
        email: 'user@example.com',
      } as DecodedToken,
    };
    res = {
      status: statusMock,
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  it('should call next when user has required role', () => {
    const middleware = requireRole('subscriber');
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('should call next when user has one of multiple required roles', () => {
    const middleware = requireRole('admin', 'subscriber');
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should return 403 when user lacks required role', () => {
    const middleware = requireRole('admin');
    middleware(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({
      type: 'https://ain.example.com/errors/forbidden',
      title: 'Forbidden',
      status: 403,
      detail: 'Requires one of roles: admin',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when user has no roles', () => {
    req.user = { sub: 'user-123', roles: [], email: 'user@example.com' } as DecodedToken;
    const middleware = requireRole('subscriber');
    middleware(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('should return 403 when req.user is undefined', () => {
    req.user = undefined;
    const middleware = requireRole('subscriber');
    middleware(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(403);
  });
});

describe('requireTier middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      user: {
        sub: 'user-123',
        roles: ['subscriber'],
        email: 'user@example.com',
        extension_tier: 'pro',
      } as DecodedToken,
    };
    res = {
      status: statusMock,
    };
    next = jest.fn();

    jest.clearAllMocks();
    mockBypassAuth.mockReturnValue(false);
  });

  it('should bypass tier check when auth bypass is enabled', () => {
    mockBypassAuth.mockReturnValue(true);
    const middleware = requireTier('enterprise');
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('should call next when user has required tier', () => {
    const middleware = requireTier('pro');
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next when user has one of multiple required tiers', () => {
    const middleware = requireTier('pro', 'enterprise');
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should return 403 when user lacks required tier', () => {
    const middleware = requireTier('enterprise');
    middleware(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({
      type: 'https://ain.example.com/errors/forbidden',
      title: 'Forbidden',
      status: 403,
      detail: 'Requires subscription tier: enterprise',
    });
  });

  it('should return 403 when user has no tier', () => {
    req.user = { sub: 'user-123', roles: ['subscriber'], email: 'user@example.com' } as DecodedToken;
    const middleware = requireTier('pro');
    middleware(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(403);
  });
});

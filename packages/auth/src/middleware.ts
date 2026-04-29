import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './verify.js';
import { DecodedToken, InvalidTokenError, TokenExpiredError } from './types.js';

// Extend Express Request to carry the decoded token
declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
    }
  }
}

function unauthorized(res: Response, detail: string): void {
  res.status(401).json({
    type: 'https://ain.example.com/errors/unauthorized',
    title: 'Unauthorized',
    status: 401,
    detail,
  });
}

function forbidden(res: Response, detail: string): void {
  res.status(403).json({
    type: 'https://ain.example.com/errors/forbidden',
    title: 'Forbidden',
    status: 403,
    detail,
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    unauthorized(res, 'Authorization header is required');
    return;
  }

  verifyToken(authHeader)
    .then((decoded) => {
      req.user = decoded;
      next();
    })
    .catch((err) => {
      if (err instanceof TokenExpiredError) {
        unauthorized(res, 'Token has expired');
      } else if (err instanceof InvalidTokenError) {
        unauthorized(res, err.message);
      } else {
        unauthorized(res, 'Authentication failed');
      }
    });
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRoles = req.user?.roles ?? [];
    const hasRole = roles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      forbidden(res, `Requires one of roles: ${roles.join(', ')}`);
      return;
    }
    next();
  };
}

export function requireTier(...tiers: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const tier = req.user?.extension_tier;
    if (!tier || !tiers.includes(tier)) {
      forbidden(res, `Requires subscription tier: ${tiers.join(' or ')}`);
      return;
    }
    next();
  };
}

export function requireActiveSubscription(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.extension_subscription_active) {
    forbidden(res, 'An active subscription is required');
    return;
  }
  next();
}

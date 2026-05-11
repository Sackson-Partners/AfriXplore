import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

const jwksClient = jwksRsa({
  jwksUri: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxAge: 600000,
});

function getSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  jwksClient.getSigningKey(header.kid!, (err, key) => {
    if (err) return callback(err);
    callback(null, key?.getPublicKey());
  });
}

// Startup guard — kills the process immediately if bypass is enabled in production.
// This runs once at module import time, before any request is served.
if (process.env.DEV_BYPASS_AUTH === 'true' && process.env.NODE_ENV === 'production') {
  process.stderr.write(JSON.stringify({ level: 'error', service: 'msim-api', ts: new Date().toISOString(), msg: 'FATAL: DEV_BYPASS_AUTH=true is set in a production environment. Refusing to start.' }) + '\n');
  process.exit(1);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Dev bypass — only active when DEV_BYPASS_AUTH=true (blocked in production above)
  if (process.env.DEV_BYPASS_AUTH === 'true') {
    (req as any).user = { sub: 'dev-subscriber', role: 'subscriber' };
    (req as any).userId = 'dev-subscriber';
    (req as any).userRole = 'subscriber';
    return next();
  }

  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ type: 'https://afrixplore.io/errors/unauthorized', status: 401 });
  }

  jwt.verify(token, getSigningKey, {
    audience: process.env.ENTRA_CLIENT_ID,
    issuer: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0`,
    algorithms: ['RS256'],
  }, (err: jwt.VerifyErrors | null, decoded: string | jwt.JwtPayload | undefined) => {
    if (err) return res.status(401).json({ type: 'https://afrixplore.io/errors/invalid-token', status: 401, detail: err.message });
    (req as any).user = decoded;
    (req as any).userId = (decoded as any).sub;
    (req as any).userRole = (decoded as any).role || 'subscriber';
    next();
  });
}

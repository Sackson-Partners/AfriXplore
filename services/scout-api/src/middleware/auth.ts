import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

const jwksClient = jwksRsa({
  jwksUri: `https://${process.env.ENTRA_SCOUT_TENANT_ID}.ciamlogin.com/${process.env.ENTRA_SCOUT_TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxAge: 600000,
});

function getSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  jwksClient.getSigningKey(header.kid!, (err, key) => {
    if (err) return callback(err);
    callback(null, key?.getPublicKey());
  });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ type: 'https://afrixplore.io/errors/unauthorized', status: 401 });
  }

  jwt.verify(token, getSigningKey, {
    audience: process.env.ENTRA_SCOUT_CLIENT_ID,
    issuer: `https://${process.env.ENTRA_SCOUT_TENANT_ID}.ciamlogin.com/${process.env.ENTRA_SCOUT_TENANT_ID}/v2.0`,
    algorithms: ['RS256'],
  }, (err: jwt.VerifyErrors | null, decoded: string | jwt.JwtPayload | undefined) => {
    if (err) return res.status(401).json({ type: 'https://afrixplore.io/errors/invalid-token', status: 401, detail: err.message });
    (req as any).user = decoded;
    (req as any).scoutId = (decoded as any).sub;
    next();
  });
}

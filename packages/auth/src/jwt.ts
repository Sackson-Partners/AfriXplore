import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

export function createJwksClient(tenantId: string) {
  return jwksRsa({
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    cache: true,
    cacheMaxAge: 600000,
    rateLimit: true,
  });
}

export async function verifyToken(
  token: string,
  tenantId: string,
  clientId: string
): Promise<jwt.JwtPayload> {
  const client = createJwksClient(tenantId);

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      (header, callback) => {
        client.getSigningKey(header.kid!, (err, key) => {
          if (err) return callback(err);
          callback(null, key?.getPublicKey());
        });
      },
      {
        audience: clientId,
        issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded as jwt.JwtPayload);
      }
    );
  });
}

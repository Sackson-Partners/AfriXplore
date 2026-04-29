import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { DecodedToken, InvalidTokenError, TokenExpiredError } from './types.js';

const JWKS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let client: jwksClient.JwksClient | null = null;

function getJwksClient(): jwksClient.JwksClient {
  if (client) return client;

  const tenantId = process.env.AZURE_ENTRA_TENANT_ID;
  if (!tenantId) throw new InvalidTokenError('AZURE_ENTRA_TENANT_ID not configured');

  client = jwksClient({
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    cache: true,
    cacheMaxEntries: 10,
    cacheMaxAge: JWKS_CACHE_TTL_MS,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
  });

  return client;
}

async function getSigningKey(header: jwt.JwtHeader): Promise<string> {
  if (!header.kid) throw new InvalidTokenError('Missing kid in token header');
  const key = await getJwksClient().getSigningKey(header.kid);
  return key.getPublicKey();
}

export async function verifyToken(bearerToken: string): Promise<DecodedToken> {
  const token = bearerToken.startsWith('Bearer ') ? bearerToken.slice(7) : bearerToken;

  const clientId = process.env.AZURE_ENTRA_CLIENT_ID;
  const tenantId = process.env.AZURE_ENTRA_TENANT_ID;
  if (!clientId || !tenantId) {
    throw new InvalidTokenError('Entra credentials not configured');
  }

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      (header, callback) => {
        getSigningKey(header)
          .then((key) => callback(null, key))
          .catch((err) => callback(err as Error));
      },
      {
        audience: clientId,
        issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            reject(new TokenExpiredError());
          } else {
            reject(new InvalidTokenError(err.message));
          }
          return;
        }
        resolve(decoded as DecodedToken);
      }
    );
  });
}

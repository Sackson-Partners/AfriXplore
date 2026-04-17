import jwksRsa, { JwksClient } from 'jwks-rsa';
import jwt from 'jsonwebtoken';

// ─── TENANT CONFIGURATION ────────────────────────────────────────────────────
export interface EntraConfig {
  scoutTenantId: string;
  platformTenantId: string;
  scoutClientId: string;
  platformClientId: string;
  platformClientSecret: string;
}

export interface DecodedToken {
  sub: string;
  oid: string;
  phone_number?: string;
  email?: string;
  role: 'scout' | 'geologist' | 'subscriber' | 'admin';
  licensed_territories?: string[];
  scout_status?: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

// ─── JWKS CLIENTS (one per tenant) ──────────────────────────────────────────
const jwksClients = new Map<string, JwksClient>();

function getJwksClient(tenantId: string): JwksClient {
  if (!jwksClients.has(tenantId)) {
    jwksClients.set(
      tenantId,
      jwksRsa({
        jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
        cache: true,
        cacheMaxEntries: 10,
        cacheMaxAge: 600_000,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      })
    );
  }
  return jwksClients.get(tenantId)!;
}

// ─── TOKEN VERIFICATION ──────────────────────────────────────────────────────
export async function verifyToken(
  token: string,
  tenantId: string,
  clientId: string
): Promise<DecodedToken> {
  return new Promise((resolve, reject) => {
    const client = getJwksClient(tenantId);

    function getKey(
      header: jwt.JwtHeader,
      callback: jwt.SigningKeyCallback
    ) {
      client.getSigningKey(header.kid!, (err, key) => {
        if (err) return callback(err);
        callback(null, key?.getPublicKey());
      });
    }

    jwt.verify(
      token,
      getKey,
      {
        audience: clientId,
        issuer: [
          `https://login.microsoftonline.com/${tenantId}/v2.0`,
          `https://${tenantId}.ciamlogin.com/${tenantId}/v2.0`,
        ],
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded as DecodedToken);
      }
    );
  });
}

// ─── SCOUT PHONE OTP FLOW ────────────────────────────────────────────────────
export interface OTPInitiateResult {
  continuationToken: string;
  codeLength: number;
  allowedResendInterval: number;
}

export async function initiatePhoneOTP(
  phoneNumber: string,
  scoutTenantId: string,
  scoutClientId: string
): Promise<OTPInitiateResult> {
  const response = await fetch(
    `https://${scoutTenantId}.ciamlogin.com/${scoutTenantId}/oauth2/v2.0/initiate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: scoutClientId,
        challenge_type: 'oob',
        username: phoneNumber,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OTP initiation failed: ${error.error_description}`);
  }

  const data = await response.json();
  return {
    continuationToken: data.continuation_token,
    codeLength: data.code_length || 6,
    allowedResendInterval: data.interval || 60,
  };
}

export interface OTPChallengeResult {
  continuationToken: string;
  bindingMethod: string;
}

export async function challengePhoneOTP(
  continuationToken: string,
  scoutTenantId: string,
  scoutClientId: string
): Promise<OTPChallengeResult> {
  const response = await fetch(
    `https://${scoutTenantId}.ciamlogin.com/${scoutTenantId}/oauth2/v2.0/challenge`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: scoutClientId,
        challenge_type: 'oob',
        continuation_token: continuationToken,
      }),
    }
  );

  const data = await response.json();
  return {
    continuationToken: data.continuation_token,
    bindingMethod: data.binding_method,
  };
}

export interface OTPTokenResult {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
  isNewUser: boolean;
}

export async function verifyPhoneOTP(
  otp: string,
  continuationToken: string,
  scoutTenantId: string,
  scoutClientId: string
): Promise<OTPTokenResult> {
  const response = await fetch(
    `https://${scoutTenantId}.ciamlogin.com/${scoutTenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: scoutClientId,
        continuation_token: continuationToken,
        grant_type: 'continuation_token',
        oob: otp,
        scope: `openid profile offline_access api://${scoutClientId}/scout.access`,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OTP verification failed: ${error.error_description}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    expiresIn: data.expires_in,
    isNewUser: data.is_new_user || false,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  tenantId: string,
  clientId: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'openid profile offline_access',
      }),
    }
  );

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

// ─── MIDDLEWARE FACTORY ───────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';

export function createAuthMiddleware(config: EntraConfig) {
  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        type: 'https://afrixplore.io/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Missing Bearer token',
        instance: req.path,
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      let decoded: DecodedToken;
      let tenantUsed: string;

      try {
        decoded = await verifyToken(token, config.scoutTenantId, config.scoutClientId);
        tenantUsed = 'scout';
      } catch {
        decoded = await verifyToken(token, config.platformTenantId, config.platformClientId);
        tenantUsed = 'platform';
      }

      (req as any).user = decoded;
      (req as any).userId = decoded.sub;
      (req as any).userRole = decoded.role || (tenantUsed === 'scout' ? 'scout' : 'subscriber');
      (req as any).licensedTerritories = decoded.licensed_territories || [];
      (req as any).tenantType = tenantUsed;

      next();
    } catch (err) {
      return res.status(401).json({
        type: 'https://afrixplore.io/errors/invalid-token',
        title: 'Invalid Token',
        status: 401,
        detail: (err as Error).message,
        instance: req.path,
      });
    }
  };
}

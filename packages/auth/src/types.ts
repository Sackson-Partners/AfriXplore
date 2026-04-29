/** Decoded and verified Microsoft Entra External ID JWT payload */
export interface DecodedToken {
  /** Object ID (unique user identifier in Entra) */
  oid: string;
  /** Tenant ID */
  tid: string;
  /** User Principal Name or email */
  upn?: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  /** App roles assigned in Entra (e.g. 'admin', 'geologist') */
  roles?: string[];
  /** Custom subscription tier claim (set via token issuance policy) */
  extension_tier?: string;
  /** Custom active subscription claim */
  extension_subscription_active?: boolean;
  /** Standard JWT claims */
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  sub: string;
}

export class TokenExpiredError extends Error {
  constructor() {
    super('Token has expired');
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends Error {
  constructor(detail?: string) {
    super(detail ? `Invalid token: ${detail}` : 'Invalid token');
    this.name = 'InvalidTokenError';
  }
}

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
export declare class TokenExpiredError extends Error {
    constructor();
}
export declare class InvalidTokenError extends Error {
    constructor(detail?: string);
}
//# sourceMappingURL=types.d.ts.map
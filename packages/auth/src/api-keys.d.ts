import { Pool } from 'pg';
export interface APIKey {
    id: string;
    user_id: string;
    name: string;
    key_hash: string;
    last_used_at?: Date;
    expires_at?: Date;
    created_at: Date;
    revoked_at?: Date;
}
/**
 * Generate a new API key
 */
export declare function generateAPIKey(): string;
/**
 * Hash an API key for storage
 */
export declare function hashAPIKey(key: string): string;
/**
 * Create a new API key for a user
 */
export declare function createAPIKey(pool: Pool, userId: string, name: string, expiresInDays?: number): Promise<{
    key: string;
    id: string;
}>;
/**
 * Verify an API key and return user information
 */
export declare function verifyAPIKey(pool: Pool, key: string): Promise<{
    valid: boolean;
    userId?: string;
    keyId?: string;
}>;
/**
 * Revoke an API key
 */
export declare function revokeAPIKey(pool: Pool, keyId: string, userId: string): Promise<boolean>;
/**
 * List API keys for a user
 */
export declare function listAPIKeys(pool: Pool, userId: string): Promise<APIKey[]>;
/**
 * Rotate an API key (revoke old, create new)
 */
export declare function rotateAPIKey(pool: Pool, oldKeyId: string, userId: string, name: string, expiresInDays?: number): Promise<{
    key: string;
    id: string;
} | null>;
/**
 * Clean up expired API keys
 */
export declare function cleanupExpiredKeys(pool: Pool): Promise<number>;
//# sourceMappingURL=api-keys.d.ts.map
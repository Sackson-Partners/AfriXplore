import { randomBytes, createHash } from 'crypto';
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
export function generateAPIKey(): string {
  // Format: ain_live_<32-char-random-string>
  const randomPart = randomBytes(24).toString('base64url');
  return `ain_live_${randomPart}`;
}

/**
 * Hash an API key for storage
 */
export function hashAPIKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Create a new API key for a user
 */
export async function createAPIKey(
  pool: Pool,
  userId: string,
  name: string,
  expiresInDays?: number
): Promise<{ key: string; id: string }> {
  const key = generateAPIKey();
  const keyHash = hashAPIKey(key);

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const result = await pool.query(
    `INSERT INTO api_keys (user_id, name, key_hash, expires_at, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING id`,
    [userId, name, keyHash, expiresAt]
  );

  return {
    key, // Return raw key only once
    id: result.rows[0].id,
  };
}

/**
 * Verify an API key and return user information
 */
export async function verifyAPIKey(
  pool: Pool,
  key: string
): Promise<{ valid: boolean; userId?: string; keyId?: string }> {
  const keyHash = hashAPIKey(key);

  const result = await pool.query(
    `SELECT id, user_id, expires_at, revoked_at
    FROM api_keys
    WHERE key_hash = $1`,
    [keyHash]
  );

  if (result.rows.length === 0) {
    return { valid: false };
  }

  const apiKey = result.rows[0];

  // Check if revoked
  if (apiKey.revoked_at) {
    return { valid: false };
  }

  // Check if expired
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return { valid: false };
  }

  // Update last_used_at
  await pool.query(
    `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
    [apiKey.id]
  );

  return {
    valid: true,
    userId: apiKey.user_id,
    keyId: apiKey.id,
  };
}

/**
 * Revoke an API key
 */
export async function revokeAPIKey(pool: Pool, keyId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE api_keys
    SET revoked_at = NOW()
    WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
    RETURNING id`,
    [keyId, userId]
  );

  return result.rows.length > 0;
}

/**
 * List API keys for a user
 */
export async function listAPIKeys(pool: Pool, userId: string): Promise<APIKey[]> {
  const result = await pool.query(
    `SELECT id, user_id, name, last_used_at, expires_at, created_at, revoked_at
    FROM api_keys
    WHERE user_id = $1
    ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Rotate an API key (revoke old, create new)
 */
export async function rotateAPIKey(
  pool: Pool,
  oldKeyId: string,
  userId: string,
  name: string,
  expiresInDays?: number
): Promise<{ key: string; id: string } | null> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Revoke old key
    const revokeResult = await client.query(
      `UPDATE api_keys SET revoked_at = NOW()
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
      RETURNING id`,
      [oldKeyId, userId]
    );

    if (revokeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    // Create new key
    const key = generateAPIKey();
    const keyHash = hashAPIKey(key);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const createResult = await client.query(
      `INSERT INTO api_keys (user_id, name, key_hash, expires_at, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id`,
      [userId, name, keyHash, expiresAt]
    );

    await client.query('COMMIT');

    return {
      key,
      id: createResult.rows[0].id,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Clean up expired API keys
 */
export async function cleanupExpiredKeys(pool: Pool): Promise<number> {
  const result = await pool.query(
    `UPDATE api_keys
    SET revoked_at = NOW()
    WHERE expires_at < NOW() AND revoked_at IS NULL
    RETURNING id`
  );

  return result.rows.length;
}

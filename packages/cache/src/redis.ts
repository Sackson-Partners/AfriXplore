/**
 * Redis Cache Client
 * Provides caching capabilities with TTL support
 */

import { Redis, type RedisOptions } from 'ioredis';

export interface CacheConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  tls?: boolean;
  keyPrefix?: string;
  retryStrategy?: (times: number) => number | null;
}

let redisClient: Redis | null = null;

/**
 * Initialize Redis client
 */
export function initializeRedis(config?: CacheConfig): Redis {
  if (redisClient) {
    return redisClient;
  }

  const options: RedisOptions = {
    host: config?.host || process.env.REDIS_HOST || 'localhost',
    port: config?.port || parseInt(process.env.REDIS_PORT || '6379', 10),
    password: config?.password || process.env.REDIS_PASSWORD,
    db: config?.db || parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: config?.keyPrefix || 'ain:',
    retryStrategy:
      config?.retryStrategy ||
      ((times) => {
        if (times > 3) {
          console.error('[Redis] Maximum retry attempts reached');
          return null;
        }
        const delay = Math.min(times * 200, 2000);
        return delay;
      }),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  };

  // TLS configuration for Azure Redis
  if (config?.tls || process.env.REDIS_TLS === 'true') {
    options.tls = {
      rejectUnauthorized: true,
    };
  }

  redisClient = new Redis(options);

  redisClient.on('connect', () => {
    console.log('[Redis] Connected');
  });

  redisClient.on('ready', () => {
    console.log('[Redis] Ready');
  });

  redisClient.on('error', (error: Error) => {
    console.error('[Redis] Error:', error);
  });

  redisClient.on('close', () => {
    console.log('[Redis] Connection closed');
  });

  redisClient.on('reconnecting', () => {
    console.log('[Redis] Reconnecting...');
  });

  return redisClient;
}

/**
 * Get Redis client (throws if not initialized)
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initializeRedis() first.');
  }
  return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] Disconnected');
  }
}

/**
 * Cache TTL presets (in seconds)
 */
export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 900, // 15 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const;

/**
 * Get value from cache
 */
export async function get<T = any>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    const value = await client.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    console.error('[Redis] Get error:', error);
    return null;
  }
}

/**
 * Set value in cache with TTL
 */
export async function set(key: string, value: any, ttl: number = CACHE_TTL.MEDIUM): Promise<boolean> {
  try {
    const client = getRedisClient();
    const serialized = JSON.stringify(value);

    await client.setex(key, ttl, serialized);
    return true;
  } catch (error) {
    console.error('[Redis] Set error:', error);
    return false;
  }
}

/**
 * Delete key from cache
 */
export async function del(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.del(key);
    return true;
  } catch (error) {
    console.error('[Redis] Delete error:', error);
    return false;
  }
}

/**
 * Delete multiple keys matching pattern
 */
export async function delPattern(pattern: string): Promise<number> {
  try {
    const client = getRedisClient();
    const keys = await client.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    await client.del(...keys);
    return keys.length;
  } catch (error) {
    console.error('[Redis] Delete pattern error:', error);
    return 0;
  }
}

/**
 * Check if key exists
 */
export async function exists(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    console.error('[Redis] Exists error:', error);
    return false;
  }
}

/**
 * Increment counter
 */
export async function incr(key: string, ttl?: number): Promise<number> {
  try {
    const client = getRedisClient();
    const value = await client.incr(key);

    if (ttl) {
      await client.expire(key, ttl);
    }

    return value;
  } catch (error) {
    console.error('[Redis] Increment error:', error);
    return 0;
  }
}

/**
 * Get or compute value (cache-aside pattern)
 */
export async function getOrCompute<T>(
  key: string,
  computeFn: () => Promise<T>,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<T> {
  // Try to get from cache
  const cached = await get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Compute value
  const value = await computeFn();

  // Store in cache (fire and forget)
  set(key, value, ttl).catch((error) => {
    console.error('[Redis] Failed to cache value:', error);
  });

  return value;
}

/**
 * Flush entire cache (use with caution!)
 */
export async function flushAll(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.flushdb();
    console.warn('[Redis] Cache flushed');
    return true;
  } catch (error) {
    console.error('[Redis] Flush error:', error);
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getStats(): Promise<{
  keys: number;
  memory: string;
  hits: number;
  misses: number;
}> {
  try {
    const client = getRedisClient();

    const [dbsize, info] = await Promise.all([
      client.dbsize(),
      client.info('stats'),
    ]);

    const statsMatch = info.match(/keyspace_hits:(\d+)\r\nkeyspace_misses:(\d+)/);
    const memoryMatch = info.match(/used_memory_human:(.+)\r\n/);

    return {
      keys: dbsize,
      memory: memoryMatch?.[1] || 'unknown',
      hits: parseInt(statsMatch?.[1] || '0', 10),
      misses: parseInt(statsMatch?.[2] || '0', 10),
    };
  } catch (error) {
    console.error('[Redis] Stats error:', error);
    return { keys: 0, memory: 'unknown', hits: 0, misses: 0 };
  }
}

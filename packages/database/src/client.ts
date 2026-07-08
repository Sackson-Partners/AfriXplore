import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create PostgreSQL connection pool with retry logic
 */
export async function createPool(config?: PoolConfig): Promise<Pool> {
  if (pool) return pool;

  const maxRetries = 3;
  const retryDelayMs = 2000;

  const poolConfig: PoolConfig = {
    connectionString: process.env.AZURE_POSTGRESQL_CONNECTION_STRING,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.NODE_ENV === 'production'
      ? {
          rejectUnauthorized: true,
          ca: process.env.POSTGRES_SSL_CERT || undefined
        }
      : process.env.NODE_ENV === 'development' && process.env.AZURE_POSTGRESQL_CONNECTION_STRING?.includes('azure')
        ? {
            rejectUnauthorized: true,
            ca: process.env.POSTGRES_SSL_CERT || undefined
          }
        : false, // Local PostgreSQL (docker-compose) doesn't need SSL
    ...config,
  };

  pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('[Database] Unexpected error on idle client:', err.message);
  });

  // Test connection with retry logic
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('[Database] Connection pool established successfully');
      return pool;
    } catch (err) {
      const error = err as Error;
      console.error(`[Database] Connection attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt === maxRetries) {
        await pool.end();
        pool = null;
        throw new Error(
          `Database connection failed after ${maxRetries} attempts. ` +
          `Check AZURE_POSTGRESQL_CONNECTION_STRING and SSL configuration. ` +
          `Last error: ${error.message}`
        );
      }

      console.log(`[Database] Retrying in ${retryDelayMs}ms...`);
      await sleep(retryDelayMs);
    }
  }

  // This line should never be reached due to the throw above, but TypeScript needs it
  throw new Error('Unexpected: retry loop completed without success or final throw');
}

/**
 * Get existing pool or create a new one
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call createPool() first.');
  }
  return pool;
}

/**
 * Get pool synchronously (for backwards compatibility)
 * This will throw if the pool hasn't been initialized
 */
export function getPoolSync(): Pool {
  if (!pool) {
    // For backwards compatibility, create synchronously without retry
    pool = new Pool({
      connectionString: process.env.AZURE_POSTGRESQL_CONNECTION_STRING,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.NODE_ENV === 'production'
        ? {
            rejectUnauthorized: true,
            ca: process.env.POSTGRES_SSL_CERT || undefined
          }
        : process.env.NODE_ENV === 'development' && process.env.AZURE_POSTGRESQL_CONNECTION_STRING?.includes('azure')
          ? {
              rejectUnauthorized: true,
              ca: process.env.POSTGRES_SSL_CERT || undefined
            }
          : false,
    });

    pool.on('error', (err) => {
      console.error('[Database] Unexpected error on idle client:', err.message);
    });
  }
  return pool;
}

/**
 * Gracefully close the connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    console.log('[Database] Closing connection pool...');
    try {
      await pool.end();
      console.log('[Database] Connection pool closed successfully');
    } catch (err) {
      console.error('[Database] Error closing pool:', err);
    } finally {
      pool = null;
    }
  }
}

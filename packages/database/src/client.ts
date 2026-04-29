import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

export function createPool(config?: PoolConfig): Pool {
  if (pool) return pool;

  pool = new Pool({
    connectionString: process.env.AZURE_POSTGRESQL_CONNECTION_STRING,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: { rejectUnauthorized: false },
    ...config,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle DB client', err);
  });

  return pool;
}

export function getPool(): Pool {
  if (!pool) return createPool();
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

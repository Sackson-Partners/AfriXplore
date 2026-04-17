import { Pool, PoolConfig } from 'pg';

export function createPool(config?: Partial<PoolConfig>): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ...config,
  });
}

export type { Pool } from 'pg';

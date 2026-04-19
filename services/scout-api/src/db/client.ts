import { Pool } from 'pg';

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

db.on('error', (err) => {
  process.stderr.write(JSON.stringify({ level: 'error', service: 'scout-api', ts: new Date().toISOString(), msg: 'Unexpected error on idle pg client', error: (err as Error).message }) + '\n');
});

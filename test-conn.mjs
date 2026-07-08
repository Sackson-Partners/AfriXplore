import pg from 'pg';
const pool = new pg.default.Pool({
  connectionString: 'postgresql://msimadmin:dxF7IsfgCRR%23Alw9SXKhzqm%40@psql-msim-dev.postgres.database.azure.com:5432/msimdb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
try {
  const r = await pool.query('SELECT current_database(), current_user');
  console.log('OK:', JSON.stringify(r.rows[0]));
} catch(e) {
  console.error('FAIL:', e.message, e.code);
}
await pool.end();

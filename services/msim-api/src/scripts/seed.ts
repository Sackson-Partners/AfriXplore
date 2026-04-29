import * as path from 'path';
import * as url from 'url';
import { createPool, runMigrations } from '@ain/database';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

async function main(): Promise<void> {
  const pool = createPool();
  const migrationsDir = path.join(__dirname, '../../migrations');

  console.log('Running all migrations (including seed data in 010)...');
  await runMigrations(migrationsDir);
  console.log('Seed complete — 3 systems, 10 mines, 5 targets loaded.');

  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

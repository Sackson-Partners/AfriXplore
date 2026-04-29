import * as path from 'path';
import * as url from 'url';
import { createPool, runMigrations } from '@ain/database';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

async function main(): Promise<void> {
  createPool();
  const migrationsDir = path.join(__dirname, '../../migrations');
  await runMigrations(migrationsDir);
  console.log('Migrations complete');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

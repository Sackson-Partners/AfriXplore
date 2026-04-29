import { createPool } from '@ain/database';
import { loadSecrets } from '@ain/config';
import { createApp } from './app.js';

const PORT = parseInt(process.env.MSIM_API_PORT ?? process.env.PORT ?? '3002', 10);

async function start(): Promise<void> {
  // Load secrets from Azure Key Vault (if in production)
  if (process.env.NODE_ENV === 'production') {
    await loadSecrets({
      AZURE_POSTGRESQL_CONNECTION_STRING: 'ain-postgresql-connection-string',
      AZURE_AI_SEARCH_KEY: 'ain-search-key',
      AZURE_STORAGE_ACCOUNT_KEY: 'ain-storage-account-key',
    });
  }

  // Initialize DB pool
  createPool();

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`msim-api listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start msim-api:', err);
  process.exit(1);
});

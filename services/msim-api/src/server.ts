import { Server } from 'http';
import { createPool, closePool } from '@ain/database';
import { loadSecrets, validateFeatureFlagsOnStartup } from '@ain/config';
import { createApp } from './app.js';

const PORT = parseInt(process.env.MSIM_API_PORT ?? process.env.PORT ?? '3002', 10);

let server: Server | null = null;

async function start(): Promise<void> {
  // Validate feature flags (will exit if DEV_BYPASS_AUTH is set in production)
  validateFeatureFlagsOnStartup();

  // Load secrets from Azure Key Vault (if in production)
  if (process.env.NODE_ENV === 'production') {
    await loadSecrets({
      AZURE_POSTGRESQL_CONNECTION_STRING: 'ain-postgresql-connection-string',
      AZURE_AI_SEARCH_KEY: 'ain-search-key',
      AZURE_STORAGE_ACCOUNT_KEY: 'ain-storage-account-key',
    });
  }

  // Initialize DB pool with retry logic
  await createPool();

  const app = createApp();
  server = app.listen(PORT, () => {
    console.log(`msim-api listening on port ${PORT}`);
  });
}

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[${signal}] Graceful shutdown initiated...`);

  if (server) {
    server.close(() => {
      console.log('[Shutdown] HTTP server closed');
    });
  }

  await closePool();

  console.log('[Shutdown] Graceful shutdown complete');
  process.exit(0);
}

// Graceful shutdown on SIGTERM and SIGINT
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  console.error('Failed to start msim-api:', err);
  process.exit(1);
});

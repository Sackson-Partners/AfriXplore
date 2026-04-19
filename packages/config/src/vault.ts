/**
 * AfriXplore — Azure Key Vault client with in-memory cache.
 *
 * Usage:
 *   import { getSecret, loadSecrets } from '@afrixplore/config';
 *
 *   // Single secret
 *   const key = await getSecret('momo-subscription-key');
 *
 *   // Bulk load at startup (fails fast if any are missing)
 *   const secrets = await loadSecrets(['database-url', 'momo-api-key']);
 *
 * Environment:
 *   AZURE_KEY_VAULT_URI  — required in production, e.g. https://kv-afrixplore-staging.vault.azure.net
 *   NODE_ENV             — 'development' enables env-var fallback
 */

import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential, ManagedIdentityCredential } from '@azure/identity';

const VAULT_URI = process.env.AZURE_KEY_VAULT_URI;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedSecret {
  value: string;
  expiresAt: number;
}

const secretCache = new Map<string, CachedSecret>();
let client: SecretClient | null = null;

function getClient(): SecretClient {
  if (!client) {
    if (!VAULT_URI) {
      throw new Error(
        'AZURE_KEY_VAULT_URI is not set. ' +
        'Set it to https://<vault-name>.vault.azure.net before starting the service.'
      );
    }
    // ManagedIdentityCredential when AZURE_CLIENT_ID (MI client ID) is set — Container Apps.
    // DefaultAzureCredential elsewhere — covers local dev (az login, VS Code, env vars).
    const credential = process.env.AZURE_CLIENT_ID
      ? new ManagedIdentityCredential(process.env.AZURE_CLIENT_ID)
      : new DefaultAzureCredential();

    client = new SecretClient(VAULT_URI, credential);
  }
  return client;
}

export async function getSecret(secretName: string): Promise<string> {
  // 1. Cache hit
  const cached = secretCache.get(secretName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // 2. Env-var fallback in development (avoids needing vault access locally)
  if (process.env.NODE_ENV !== 'production') {
    const envKey = secretName.toUpperCase().replace(/-/g, '_');
    const envVal = process.env[envKey];
    if (envVal) {
      return envVal;
    }
  }

  // 3. Fetch from Key Vault
  const secret = await getClient().getSecret(secretName);
  if (!secret.value) {
    throw new Error(`Secret '${secretName}' exists in Key Vault but has no value`);
  }

  secretCache.set(secretName, { value: secret.value, expiresAt: Date.now() + CACHE_TTL_MS });
  return secret.value;
}

/**
 * Load multiple secrets in parallel at service startup.
 * Throws if any secret cannot be loaded — service should not start without its secrets.
 */
export async function loadSecrets(secretNames: string[]): Promise<Record<string, string>> {
  const results = await Promise.allSettled(
    secretNames.map(async (name) => ({ name, value: await getSecret(name) }))
  );

  const failed = results
    .map((r, i) => ({ result: r, name: secretNames[i] }))
    .filter(({ result }) => result.status === 'rejected')
    .map(({ name, result }) => {
      const reason = (result as PromiseRejectedResult).reason as Error;
      return `${name} (${reason.message})`;
    });

  if (failed.length > 0) {
    throw new Error(`Failed to load secrets: ${failed.join(', ')}`);
  }

  return Object.fromEntries(
    (results as PromiseFulfilledResult<{ name: string; value: string }>[])
      .map((r) => [r.value.name, r.value.value])
  );
}

/** Invalidate cache — call after a secret rotation event. */
export function invalidateSecretCache(secretName?: string): void {
  if (secretName) {
    secretCache.delete(secretName);
  } else {
    secretCache.clear();
  }
}

import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

let secretClient: SecretClient | null = null;

function getSecretClient(): SecretClient {
  if (secretClient) return secretClient;

  const vaultUrl = process.env.AZURE_KEY_VAULT_URL;
  if (!vaultUrl) throw new Error('AZURE_KEY_VAULT_URL environment variable is not set');

  secretClient = new SecretClient(vaultUrl, new DefaultAzureCredential());
  return secretClient;
}

/** Fetches a single secret value from Azure Key Vault by name. */
export async function getSecret(name: string): Promise<string> {
  const client = getSecretClient();
  const secret = await client.getSecret(name);
  if (!secret.value) throw new Error(`Secret '${name}' has no value in Key Vault`);
  return secret.value;
}

/**
 * Loads multiple secrets from Key Vault and merges them into process.env.
 * secretMap: { ENV_VAR_NAME: 'keyvault-secret-name' }
 */
export async function loadSecrets(secretMap: Record<string, string>): Promise<void> {
  const entries = Object.entries(secretMap);
  const results = await Promise.allSettled(
    entries.map(async ([envKey, secretName]) => {
      const value = await getSecret(secretName);
      process.env[envKey] = value;
    })
  );

  const failures = results
    .map((r, i) => (r.status === 'rejected' ? entries[i][1] : null))
    .filter(Boolean);

  if (failures.length > 0) {
    throw new Error(`Failed to load secrets from Key Vault: ${failures.join(', ')}`);
  }
}

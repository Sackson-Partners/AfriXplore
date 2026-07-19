"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecret = getSecret;
exports.loadSecrets = loadSecrets;
const keyvault_secrets_1 = require("@azure/keyvault-secrets");
const identity_1 = require("@azure/identity");
let secretClient = null;
function getSecretClient() {
    if (secretClient)
        return secretClient;
    const vaultUrl = process.env.AZURE_KEY_VAULT_URL;
    if (!vaultUrl)
        throw new Error('AZURE_KEY_VAULT_URL environment variable is not set');
    secretClient = new keyvault_secrets_1.SecretClient(vaultUrl, new identity_1.DefaultAzureCredential());
    return secretClient;
}
/** Fetches a single secret value from Azure Key Vault by name. */
async function getSecret(name) {
    const client = getSecretClient();
    const secret = await client.getSecret(name);
    if (!secret.value)
        throw new Error(`Secret '${name}' has no value in Key Vault`);
    return secret.value;
}
/**
 * Loads multiple secrets from Key Vault and merges them into process.env.
 * secretMap: { ENV_VAR_NAME: 'keyvault-secret-name' }
 */
async function loadSecrets(secretMap) {
    const entries = Object.entries(secretMap);
    const results = await Promise.allSettled(entries.map(async ([envKey, secretName]) => {
        const value = await getSecret(secretName);
        process.env[envKey] = value;
    }));
    const failures = results
        .map((r, i) => (r.status === 'rejected' ? entries[i][1] : null))
        .filter(Boolean);
    if (failures.length > 0) {
        throw new Error(`Failed to load secrets from Key Vault: ${failures.join(', ')}`);
    }
}
//# sourceMappingURL=keyvault.js.map
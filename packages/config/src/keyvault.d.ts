/** Fetches a single secret value from Azure Key Vault by name. */
export declare function getSecret(name: string): Promise<string>;
/**
 * Loads multiple secrets from Key Vault and merges them into process.env.
 * secretMap: { ENV_VAR_NAME: 'keyvault-secret-name' }
 */
export declare function loadSecrets(secretMap: Record<string, string>): Promise<void>;
//# sourceMappingURL=keyvault.d.ts.map
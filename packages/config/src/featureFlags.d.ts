/**
 * Feature Flags Module
 *
 * Centralized feature flag management with built-in safety checks.
 * Prevents dangerous flags from being enabled in production.
 */
/**
 * Check if authentication bypass is allowed
 *
 * Security rules:
 * 1. NEVER allow in production (NODE_ENV === 'production')
 * 2. NEVER allow if a real Azure client ID is configured
 * 3. Only allow if explicitly set to 'true' in development
 *
 * This flag should ONLY be used for local development without Azure Entra setup.
 */
declare function bypassAuth(): boolean;
/**
 * Feature flags registry
 */
export declare const featureFlags: {
    /**
     * Check if authentication bypass is allowed
     *
     * @returns true if auth bypass is safe and enabled, false otherwise
     * @throws Error if bypass is attempted in production
     */
    bypassAuth: typeof bypassAuth;
    /**
     * Check if we're in development mode
     */
    isDevelopment(): boolean;
    /**
     * Check if we're in production mode
     */
    isProduction(): boolean;
    /**
     * Check if we're in test mode
     */
    isTest(): boolean;
};
/**
 * Validate feature flags on startup
 * Call this in service entry points to catch misconfigurations early
 */
export declare function validateFeatureFlagsOnStartup(): void;
export {};
//# sourceMappingURL=featureFlags.d.ts.map
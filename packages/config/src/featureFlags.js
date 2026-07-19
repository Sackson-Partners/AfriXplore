"use strict";
/**
 * Feature Flags Module
 *
 * Centralized feature flag management with built-in safety checks.
 * Prevents dangerous flags from being enabled in production.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureFlags = void 0;
exports.validateFeatureFlagsOnStartup = validateFeatureFlagsOnStartup;
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
function bypassAuth() {
    // Rule 1: NEVER allow in production
    if (process.env.NODE_ENV === 'production') {
        if (process.env.DEV_BYPASS_AUTH === 'true') {
            throw new Error('FATAL SECURITY ERROR: DEV_BYPASS_AUTH=true is set in production environment. ' +
                'This is a critical security misconfiguration. Refusing to start.');
        }
        return false;
    }
    // Rule 2: NEVER allow if real Azure client ID is configured
    const clientId = process.env.AZURE_ENTRA_CLIENT_ID || process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID;
    if (clientId) {
        // Check if it's a placeholder or dev value
        const isPlaceholder = clientId.includes('placeholder') ||
            clientId.includes('your-') ||
            clientId.includes('dev-') ||
            clientId.startsWith('00000000') ||
            clientId === 'test';
        if (!isPlaceholder) {
            // Real client ID is set - don't bypass auth even in development
            if (process.env.DEV_BYPASS_AUTH === 'true') {
                console.warn('[FeatureFlags] WARNING: DEV_BYPASS_AUTH=true but a real AZURE_ENTRA_CLIENT_ID is configured. ' +
                    'Ignoring bypass flag for security. Use actual authentication.');
            }
            return false;
        }
    }
    // Rule 3: Only allow if explicitly set to 'true' in development
    return process.env.DEV_BYPASS_AUTH === 'true' || process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true';
}
/**
 * Feature flags registry
 */
exports.featureFlags = {
    /**
     * Check if authentication bypass is allowed
     *
     * @returns true if auth bypass is safe and enabled, false otherwise
     * @throws Error if bypass is attempted in production
     */
    bypassAuth,
    /**
     * Check if we're in development mode
     */
    isDevelopment() {
        return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev';
    },
    /**
     * Check if we're in production mode
     */
    isProduction() {
        return process.env.NODE_ENV === 'production';
    },
    /**
     * Check if we're in test mode
     */
    isTest() {
        return process.env.NODE_ENV === 'test';
    },
};
/**
 * Validate feature flags on startup
 * Call this in service entry points to catch misconfigurations early
 */
function validateFeatureFlagsOnStartup() {
    const env = process.env.NODE_ENV || 'development';
    console.log(`[FeatureFlags] Environment: ${env}`);
    console.log(`[FeatureFlags] Auth bypass allowed: ${exports.featureFlags.bypassAuth()}`);
    // Fatal check: DEV_BYPASS_AUTH in production
    if (env === 'production' && process.env.DEV_BYPASS_AUTH === 'true') {
        console.error('╔═══════════════════════════════════════════════════════════════╗\n' +
            '║ FATAL: DEV_BYPASS_AUTH=true in production                     ║\n' +
            '║                                                               ║\n' +
            '║ This is a critical security misconfiguration.                ║\n' +
            '║ The service will NOT start.                                  ║\n' +
            '║                                                               ║\n' +
            '║ Fix: Remove DEV_BYPASS_AUTH from production environment      ║\n' +
            '╚═══════════════════════════════════════════════════════════════╝');
        process.exit(1);
    }
    // Warning: bypass enabled in non-production
    if (exports.featureFlags.bypassAuth() && env !== 'production') {
        console.warn('⚠️  WARNING: Authentication bypass is ENABLED\n' +
            '   This should ONLY be used for local development.\n' +
            '   DO NOT deploy to staging or production with this flag.\n');
    }
}
//# sourceMappingURL=featureFlags.js.map
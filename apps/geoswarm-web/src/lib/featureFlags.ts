/**
 * Client-side feature flags
 *
 * Mirrors the server-side feature flags but for browser environment
 */

/**
 * Check if auth bypass is allowed (client-side)
 *
 * Rules:
 * 1. Only in development/local environment
 * 2. Only if explicitly enabled
 * 3. Never in production builds
 */
export function canBypassAuth(): boolean {
  // Production check
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
    return false;
  }

  // Check if real client ID is configured
  const clientId = process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID;
  if (clientId && !clientId.includes('placeholder') && !clientId.includes('your-')) {
    // Real client ID exists - don't bypass
    return false;
  }

  // Only allow if explicitly enabled
  return process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true';
}

/**
 * Check if we're in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_APP_ENV === 'development';
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_APP_ENV === 'production';
}

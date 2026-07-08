'use client';

import { useIsAuthenticated } from '@azure/msal-react';
import { canBypassAuth } from '@/lib/featureFlags';

/**
 * Drop-in replacement for MSAL's useIsAuthenticated().
 * Returns true immediately when auth bypass is allowed (local dev only).
 */
export function useAuth(): boolean {
  const msalAuth = useIsAuthenticated();
  return canBypassAuth() || msalAuth;
}

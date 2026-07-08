'use client';

import { useEffect, useState } from 'react';

const DEV_MODE = !process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID;

// Load the MSAL hook only in production to avoid crashes without MsalProvider.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const useIsAuthenticated: () => boolean = DEV_MODE
  ? () => false
  : (require('@azure/msal-react') as { useIsAuthenticated: () => boolean }).useIsAuthenticated;

/**
 * Returns:
 *   null  — still determining auth state (don't redirect yet)
 *   true  — authenticated
 *   false — not authenticated (safe to redirect)
 */
export function useAdminAuth(): boolean | null {
  const msalAuth = useIsAuthenticated();

  // null = not yet checked (avoids redirect on first render before sessionStorage is read)
  const [devAuth, setDevAuth] = useState<boolean | null>(null);

  useEffect(() => {
    if (DEV_MODE) {
      setDevAuth(sessionStorage.getItem('ain_dev_authed') === '1');
    }
  }, []);

  if (!DEV_MODE) return msalAuth;
  return devAuth;
}

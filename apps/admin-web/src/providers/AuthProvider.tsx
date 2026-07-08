'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

const DEV_MODE = !process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID;

function DevAuthProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
  }));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Dynamically import MSAL only when not in dev mode to avoid
// MSAL crashing with empty clientId in dev environments.
let MsalAuthProvider: React.ComponentType<{ children: ReactNode }> | null = null;

if (!DEV_MODE) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MsalProvider } = require('@azure/msal-react') as { MsalProvider: React.ComponentType<{ instance: unknown; children: ReactNode }> };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PublicClientApplication } = require('@azure/msal-browser') as { PublicClientApplication: new (config: unknown) => unknown };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { msalConfig } = require('@/lib/msal-config') as { msalConfig: unknown };

  const msalInstance = new PublicClientApplication(msalConfig);

  MsalAuthProvider = function MsalProvider_({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
      defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
    }));
    return (
      <MsalProvider instance={msalInstance}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MsalProvider>
    );
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (DEV_MODE) return <DevAuthProvider>{children}</DevAuthProvider>;
  const Provider = MsalAuthProvider!;
  return <Provider>{children}</Provider>;
}

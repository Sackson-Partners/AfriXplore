'use client';

import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { msalConfig } from '@/lib/auth/msalConfig';

const msalInstance = new PublicClientApplication(msalConfig);
const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </MsalProvider>
  );
}

'use client'

import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication } from '@azure/msal-browser'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { msalConfig } from '@/lib/auth/msalConfig'

const msalInstance = new PublicClientApplication(msalConfig)

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000, retry: 1 } },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <MsalProvider instance={msalInstance}>{children}</MsalProvider>
    </QueryClientProvider>
  )
}

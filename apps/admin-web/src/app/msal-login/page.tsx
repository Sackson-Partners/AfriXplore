'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This file is only reachable in production (when NEXT_PUBLIC_ENTRA_CLIENT_ID is set).
// It safely imports MSAL hooks inside the component, after MsalProvider is mounted.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useIsAuthenticated, useMsal } = require('@azure/msal-react') as {
  useIsAuthenticated: () => boolean;
  useMsal: () => { instance: { loginRedirect: (req: Record<string, string[]>) => Promise<void> } };
};

export default function MsalLoginPage() {
  const isAuthenticated = useIsAuthenticated();
  const { instance } = useMsal();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      void instance.loginRedirect({ scopes: ['openid', 'profile', 'email'] });
    }
  }, [isAuthenticated, instance, router]);

  return (
    <main className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 text-sm">Redirecting to sign-in…</p>
      </div>
    </main>
  );
}

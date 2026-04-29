'use client';

import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/msal-config';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const isAuthenticated = useIsAuthenticated();
  const { instance } = useMsal();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.push('/dashboard');
  }, [isAuthenticated, router]);

  return (
    <main className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <h1 className="text-2xl font-bold text-white mb-2">AIN Admin</h1>
        <p className="text-gray-400 mb-6 text-sm">Sign in with your Microsoft Entra admin account</p>
        <button
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          onClick={() => { void instance.loginPopup(loginRequest); }}
          className="bg-amber-500 text-gray-900 font-semibold py-2.5 px-8 rounded-lg hover:bg-amber-400 transition-colors w-full"
        >
          Sign in
        </button>
      </div>
    </main>
  );
}

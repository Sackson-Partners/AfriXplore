'use client';

import { useMsal } from '@azure/msal-react';
import { useSearchParams } from 'next/navigation';
import { loginRequest } from '@/lib/auth/msalConfig';
import { Suspense } from 'react';

function LoginContent() {
  const { instance } = useMsal();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/';

  const handleLogin = async () => {
    await instance.loginRedirect({
      ...loginRequest,
      state: returnTo,
    });
  };

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1.5rem',
        padding: '2rem',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>AfriXplore Admin Portal</h1>
      <p style={{ color: '#888', textAlign: 'center', maxWidth: 320 }}>
        Sign in with your AfriXplore organisation account to continue.
      </p>
      <button
        onClick={handleLogin}
        style={{
          padding: '0.75rem 2rem',
          background: '#0070f3',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: '1rem',
          cursor: 'pointer',
        }}
      >
        Sign in with Microsoft
      </button>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const DEV_MODE = !process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID;
const DEV_PASSWORD = 'ain-admin-2026';

export default function HomePage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!DEV_MODE) {
    // Redirect to msal-login page which safely imports MSAL hooks
    if (typeof window !== 'undefined') router.replace('/msal-login');
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === DEV_PASSWORD) {
      sessionStorage.setItem('ain_dev_authed', '1');
      router.push('/dashboard');
    } else {
      setError('Incorrect password.');
    }
  }

  return (
    <main className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center max-w-sm px-6 w-full">
        <h1 className="text-2xl font-bold text-white mb-1">AIN Admin</h1>
        <p className="text-amber-400 text-xs mb-6 uppercase tracking-wider">Dev mode</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            placeholder="Dev password"
            className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="bg-amber-500 text-gray-900 font-semibold py-2.5 px-8 rounded-lg hover:bg-amber-400 transition-colors w-full"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}

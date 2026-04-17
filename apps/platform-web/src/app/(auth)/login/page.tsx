'use client';

import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/auth/msalConfig';

export default function LoginPage() {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginRedirect(loginRequest);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">AfriXplore</h1>
          <p className="text-gray-400">Intelligence Platform</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          <h2 className="text-xl font-semibold text-white mb-2">Sign in</h2>
          <p className="text-gray-400 text-sm mb-6">
            Access your mineral intelligence dashboard
          </p>
          <button
            onClick={handleLogin}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
          >
            Sign in with Microsoft
          </button>
        </div>
      </div>
    </div>
  );
}

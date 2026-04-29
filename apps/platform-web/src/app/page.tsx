'use client';

import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/msal-config';
import Link from 'next/link';

export default function HomePage() {
  const isAuthenticated = useIsAuthenticated();
  const { instance } = useMsal();

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="text-3xl font-bold text-white mb-3">AIN MSIM Platform</h1>
          <p className="text-gray-400 mb-8">
            Historical mine intelligence and mineral systems mapping for Africa
          </p>
          <button
            onClick={() => instance.loginPopup(loginRequest)}
            className="bg-amber-500 text-gray-900 font-semibold py-3 px-8 rounded-lg hover:bg-amber-400 transition-colors"
          >
            Sign in to explore
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">AIN MSIM Platform</h1>
        <div className="flex items-center gap-4">
          <Link href="/map" className="text-sm text-gray-600 hover:text-gray-900">Map</Link>
          <Link href="/mines" className="text-sm text-gray-600 hover:text-gray-900">Mines</Link>
          <Link href="/export" className="text-sm text-gray-600 hover:text-gray-900">Export</Link>
          <button
            onClick={() => instance.logoutPopup()}
            className="text-sm text-gray-400 hover:text-gray-900"
          >
            Sign out
          </button>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to MSIM</h2>
        <p className="text-gray-500 mb-8">Explore historical mines, mineral systems, and drill targets across Africa.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { href: '/map', label: 'Interactive Map', desc: 'Visualise mines and mineral systems on a Mapbox map', color: 'bg-blue-50 border-blue-200' },
            { href: '/mines', label: 'Mine Browser', desc: 'Search and filter 10,000+ historical mine records', color: 'bg-amber-50 border-amber-200' },
            { href: '/export', label: 'Data Export', desc: 'Download GeoJSON or CSV for your licensed territories', color: 'bg-green-50 border-green-200' },
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`border rounded-xl p-6 hover:shadow-md transition-shadow ${card.color}`}
            >
              <h3 className="font-semibold text-gray-900 mb-1">{card.label}</h3>
              <p className="text-sm text-gray-600">{card.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

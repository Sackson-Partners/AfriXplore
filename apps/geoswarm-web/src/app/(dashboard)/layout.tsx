'use client';

import { useEffect } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/msal-config';
import { Sidebar } from '@/components/Sidebar';
import { canBypassAuth } from '@/lib/featureFlags';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const { instance } = useMsal();

  useEffect(() => {
    if (!canBypassAuth() && !isAuthenticated) {
      instance.loginRedirect(loginRequest);
    }
  }, [isAuthenticated, instance]);

  if (!canBypassAuth() && !isAuthenticated) {
    return (
      <div className="flex h-screen bg-geo-obsidian items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="w-2 h-2 rounded-full bg-drone-primary animate-pulse" />
          <p className="text-geo-mist text-sm">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-geo-obsidian overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 ml-16">
        {/* Top bar */}
        <header className="h-14 border-b border-geo-steel bg-geo-slate/80 flex items-center px-6 flex-shrink-0">
          <p className="text-xs font-semibold tracking-widest text-geo-mist uppercase">GeoSwarm Platform</p>
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-scan-green font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-scan-green animate-pulse" />
              Systems Online
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

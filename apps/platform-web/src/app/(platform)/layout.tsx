'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileSidebar } from '@/components/navigation/MobileSidebar';
import { TopBar } from '@/components/navigation/TopBar';
import { useTokenSync } from '@/lib/api-client';
import { ConvergenceAlerts } from '@/components/ConvergenceAlerts';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function TokenSync() {
  useTokenSync();
  return null;
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-geo-obsidian overflow-hidden">
        <TokenSync />
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        {/* Mobile sidebar */}
        <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0 lg:ml-16">
          <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
          <main className="flex-1 overflow-hidden">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
        <ConvergenceAlerts />
      </div>
    </ErrorBoundary>
  );
}

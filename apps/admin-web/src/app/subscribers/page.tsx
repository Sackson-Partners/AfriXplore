'use client';

import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';

export default function SubscribersPage() {
  const isAuthenticated = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated === false) router.push('/');
  }, [isAuthenticated, router]);

  if (isAuthenticated !== true) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-geo-obsidian min-h-screen">
        <h2 className="text-2xl font-bold text-geo-white mb-6">Subscribers</h2>
        <div className="bg-geo-slate rounded-xl border border-geo-steel p-8 text-center text-geo-mist text-sm">
          Subscriber management coming soon.
        </div>
      </main>
    </div>
  );
}

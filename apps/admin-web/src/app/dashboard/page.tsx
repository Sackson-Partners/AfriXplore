'use client';

import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';

interface AnalyticsOverview {
  total_regions: string | number;
  total_companies: string | number;
  total_concessions: string | number;
  total_records: string | number;
  total_extractions: string | number;
  total_quantity_mt: string | number | null;
}

async function fetchOverview(): Promise<AnalyticsOverview> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_MSIM_API_URL}/analytics/overview`);
  if (!res.ok) throw new Error('Failed to fetch overview');
  return res.json() as Promise<AnalyticsOverview>;
}

export default function DashboardPage() {
  const isAuthenticated = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated === false) router.push('/');
  }, [isAuthenticated, router]);

  const { data } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: fetchOverview,
    enabled: isAuthenticated === true,
  });

  if (isAuthenticated !== true) return null;

  const stats = [
    { label: 'Regions', value: data ? String(data.total_regions) : '—' },
    { label: 'Mining Records', value: data ? String(data.total_records) : '—' },
    { label: 'Concessions', value: data ? String(data.total_concessions) : '—' },
    { label: 'Companies', value: data ? String(data.total_companies) : '—' },
  ];

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-geo-obsidian min-h-screen">
        <h2 className="text-2xl font-bold text-geo-white mb-6">Dashboard</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-geo-slate rounded-xl border border-geo-steel p-5">
              <p className="text-xs text-geo-mist mb-1 uppercase tracking-wider">{s.label}</p>
              <p className="text-3xl font-bold text-geo-white">{s.value}</p>
            </div>
          ))}
        </div>
        {data && (
          <div className="bg-geo-slate rounded-xl border border-geo-steel p-6 mb-4">
            <h3 className="font-semibold text-geo-white mb-3">Production Summary</h3>
            <div className="flex gap-8">
              <div>
                <p className="text-xs text-geo-mist uppercase tracking-wider mb-1">Total Extractions</p>
                <p className="text-2xl font-bold text-geo-white">{data.total_extractions}</p>
              </div>
              <div>
                <p className="text-xs text-geo-mist uppercase tracking-wider mb-1">Total Quantity (Mt)</p>
                <p className="text-2xl font-bold text-geo-white">
                  {data.total_quantity_mt != null ? Number(data.total_quantity_mt).toLocaleString() : '—'}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="bg-geo-slate rounded-xl border border-geo-steel p-6">
          <h3 className="font-semibold text-geo-white mb-3">Quick Links</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {[
              { href: '/regions', label: 'Manage Regions' },
              { href: '/records', label: 'Mining Records' },
              { href: '/concessions', label: 'Concessions' },
              { href: '/ingestion', label: 'Ingest Documents' },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3 py-1.5 bg-amber-900/20 text-amber-400 border border-amber-700/40 rounded-lg hover:bg-amber-900/30 transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useIsAuthenticated } from '@azure/msal-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';

interface AnalyticsOverview {
  totalRegions: number;
  totalCompanies: number;
  totalConcessions: number;
  totalRecords: number;
  totalExtractions: number;
  totalQuantityMt: number | null;
}

async function fetchOverview(): Promise<AnalyticsOverview> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_MSIM_API_URL}/analytics/overview`);
  if (!res.ok) throw new Error('Failed to fetch overview');
  return res.json() as Promise<AnalyticsOverview>;
}

export default function DashboardPage() {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  const { data } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: fetchOverview,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  const stats = [
    { label: 'Regions', value: data ? String(data.totalRegions) : '—' },
    { label: 'Mining Records', value: data ? String(data.totalRecords) : '—' },
    { label: 'Concessions', value: data ? String(data.totalConcessions) : '—' },
    { label: 'Companies', value: data ? String(data.totalCompanies) : '—' },
  ];

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-gray-50 min-h-screen">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">{s.label}</p>
              <p className="text-3xl font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>
        {data && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">Production Summary</h3>
            <div className="flex gap-8">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Extractions</p>
                <p className="text-2xl font-bold text-gray-900">{data.totalExtractions}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Quantity (Mt)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.totalQuantityMt != null ? data.totalQuantityMt.toFixed(1) : '—'}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Quick Links</h3>
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
                className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
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

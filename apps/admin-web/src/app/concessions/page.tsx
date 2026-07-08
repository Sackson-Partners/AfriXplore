'use client';

import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';

interface Concession {
  id: string;
  name: string;
  country: string;
  status: string;
  minerals: string[] | null;
  area_km2: number | null;
  grant_date: string | null;
  expiry_date: string | null;
  region_name: string | null;
  company_name: string | null;
}

interface ConcessionsResponse {
  data: Concession[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

async function fetchConcessions(page: number, search?: string): Promise<ConcessionsResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (search) params.set('search', search);
  const res = await fetch(`${process.env.NEXT_PUBLIC_MSIM_API_URL}/concessions?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json() as Promise<ConcessionsResponse>;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-signal-low/20 text-signal-low',
  expired: 'bg-signal-critical/20 text-signal-critical',
  suspended: 'bg-yellow-900/30 text-yellow-400',
  pending: 'bg-blue-900/30 text-blue-400',
  cancelled: 'bg-geo-graphite text-geo-mist',
};

export default function ConcessionsPage() {
  const isAuthenticated = useAdminAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isAuthenticated === false) router.push('/');
  }, [isAuthenticated, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-concessions', page, search],
    queryFn: () => fetchConcessions(page, search || undefined),
    enabled: isAuthenticated === true,
  });

  if (isAuthenticated !== true) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-geo-obsidian min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-geo-white">Concessions</h2>
        </div>

        <input
          type="text"
          placeholder="Search by name or country…"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-sm border border-geo-steel rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-geo-graphite text-geo-cloud placeholder-geo-mist"
        />

        {isLoading && <p className="text-geo-mist">Loading…</p>}
        {error && <p className="text-signal-critical text-sm">Failed to load concessions.</p>}

        {data && (
          <>
            <p className="text-sm text-geo-mist mb-3">{data.total} concessions</p>
            <div className="bg-geo-slate rounded-xl border border-geo-steel overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-geo-graphite border-b border-geo-steel">
                  <tr>
                    {['Name', 'Country', 'Status', 'Minerals', 'Region', 'Company', 'Area (km²)'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-geo-mist uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-geo-steel/30">
                  {data.data.map((c) => (
                    <tr key={c.id} className="hover:bg-geo-graphite/50">
                      <td className="px-4 py-3 font-medium text-geo-white">{c.name}</td>
                      <td className="px-4 py-3 text-geo-cloud">{c.country}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] ?? 'bg-geo-graphite text-geo-mist'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(c.minerals ?? []).slice(0, 3).map((m) => (
                            <span key={m} className="bg-amber-900/30 text-amber-400 text-xs px-2 py-0.5 rounded-full">{m}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-geo-mist text-xs">{c.region_name ?? '—'}</td>
                      <td className="px-4 py-3 text-geo-mist text-xs">{c.company_name ?? '—'}</td>
                      <td className="px-4 py-3 text-geo-cloud font-mono text-xs">
                        {c.area_km2 != null ? Number(c.area_km2).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="text-sm px-3 py-1 border border-geo-steel rounded bg-geo-graphite text-geo-mist hover:text-geo-white hover:border-geo-mist transition-colors disabled:opacity-30">Previous</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={!data.hasNext}
                className="text-sm px-3 py-1 border border-geo-steel rounded bg-geo-graphite text-geo-mist hover:text-geo-white hover:border-geo-mist transition-colors disabled:opacity-30">Next</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

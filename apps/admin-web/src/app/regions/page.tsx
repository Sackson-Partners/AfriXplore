'use client';

import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';

interface Region {
  id: string;
  name: string;
  country: string;
  colonial_name: string | null;
  modern_name: string | null;
  area_km2: number | null;
  created_at: string;
}

interface RegionsResponse {
  data: Region[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

async function fetchRegions(page: number, search?: string): Promise<RegionsResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (search) params.set('search', search);
  const res = await fetch(`${process.env.NEXT_PUBLIC_MSIM_API_URL}/regions?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json() as Promise<RegionsResponse>;
}

export default function RegionsPage() {
  const isAuthenticated = useAdminAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isAuthenticated === false) router.push('/');
  }, [isAuthenticated, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-regions', page, search],
    queryFn: () => fetchRegions(page, search || undefined),
    enabled: isAuthenticated === true,
  });

  if (isAuthenticated !== true) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-geo-obsidian min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-geo-white">Regions</h2>
        </div>

        <input
          type="text"
          placeholder="Search by name or country…"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-sm border border-geo-steel rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-geo-graphite text-geo-cloud placeholder-geo-mist"
        />

        {isLoading && <p className="text-geo-mist">Loading…</p>}
        {error && <p className="text-signal-critical text-sm">Failed to load regions.</p>}

        {data && (
          <>
            <p className="text-sm text-geo-mist mb-3">{data.total} regions</p>
            <div className="bg-geo-slate rounded-xl border border-geo-steel overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-geo-graphite border-b border-geo-steel">
                  <tr>
                    {['Name', 'Country', 'Colonial Name', 'Modern Name', 'Area (km²)'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-geo-mist uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-geo-steel/30">
                  {data.data.map((r) => (
                    <tr key={r.id} className="hover:bg-geo-graphite/50">
                      <td className="px-4 py-3 font-medium text-geo-white">{r.name}</td>
                      <td className="px-4 py-3 text-geo-cloud">{r.country}</td>
                      <td className="px-4 py-3 text-geo-mist">{r.colonial_name ?? '—'}</td>
                      <td className="px-4 py-3 text-geo-mist">{r.modern_name ?? '—'}</td>
                      <td className="px-4 py-3 text-geo-cloud font-mono text-xs">
                        {r.area_km2 != null ? Number(r.area_km2).toLocaleString() : '—'}
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

'use client';

import { useIsAuthenticated } from '@azure/msal-react';
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
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-regions', page, search],
    queryFn: () => fetchRegions(page, search || undefined),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Regions</h2>
        </div>

        <input
          type="text"
          placeholder="Search by name or country…"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-sm border border-gray-300 rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />

        {isLoading && <p className="text-gray-500">Loading…</p>}
        {error && <p className="text-red-500 text-sm">Failed to load regions.</p>}

        {data && (
          <>
            <p className="text-sm text-gray-500 mb-3">{data.total} regions</p>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Name', 'Country', 'Colonial Name', 'Modern Name', 'Area (km²)'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                      <td className="px-4 py-3 text-gray-600">{r.country}</td>
                      <td className="px-4 py-3 text-gray-500">{r.colonial_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{r.modern_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {r.area_km2 != null ? Number(r.area_km2).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="text-sm px-3 py-1 border border-gray-300 rounded disabled:opacity-40">Previous</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={!data.hasNext}
                className="text-sm px-3 py-1 border border-gray-300 rounded disabled:opacity-40">Next</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

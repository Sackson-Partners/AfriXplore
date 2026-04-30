'use client';

import { useIsAuthenticated } from '@azure/msal-react';
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
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  suspended: 'bg-yellow-100 text-yellow-700',
  pending: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function ConcessionsPage() {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-concessions', page, search],
    queryFn: () => fetchConcessions(page, search || undefined),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Concessions</h2>
        </div>

        <input
          type="text"
          placeholder="Search by name or country…"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-sm border border-gray-300 rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />

        {isLoading && <p className="text-gray-500">Loading…</p>}
        {error && <p className="text-red-500 text-sm">Failed to load concessions.</p>}

        {data && (
          <>
            <p className="text-sm text-gray-500 mb-3">{data.total} concessions</p>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Name', 'Country', 'Status', 'Minerals', 'Region', 'Company', 'Area (km²)'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.country}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(c.minerals ?? []).slice(0, 3).map((m) => (
                            <span key={m} className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{m}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{c.region_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{c.company_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {c.area_km2 != null ? Number(c.area_km2).toLocaleString() : '—'}
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

'use client';

import { useIsAuthenticated } from '@azure/msal-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';

interface Mine {
  id: string;
  name: string;
  country: string;
  commodity: string[];
  digitisationStatus: string;
}

interface MinesResponse {
  data: Mine[];
  total: number;
}

async function fetchMines(page: number, search?: string): Promise<MinesResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (search) params.set('search', search);
  const res = await fetch(`${process.env.NEXT_PUBLIC_MSIM_API_URL}/mines?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json() as Promise<MinesResponse>;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  reviewed: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
};

export default function MinesAdminPage() {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-mines', page, search],
    queryFn: () => fetchMines(page, search || undefined),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Historical Mines</h2>
          <button className="bg-amber-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-600">
            + Add mine
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value as string); setPage(1); }}
          className="w-full max-w-sm border border-gray-300 rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />

        {isLoading && <p className="text-gray-500">Loading…</p>}
        {error && <p className="text-red-500 text-sm">Failed to load mines.</p>}

        {data && (
          <>
            <p className="text-sm text-gray-500 mb-3">{data.total} mines</p>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Name', 'Country', 'Commodity', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.map((mine) => (
                    <tr key={mine.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{mine.name}</td>
                      <td className="px-4 py-3 text-gray-600">{mine.country}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {mine.commodity.map((c) => (
                            <span key={c} className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{c}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[mine.digitisationStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                          {mine.digitisationStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-xs text-amber-600 hover:underline">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-sm px-3 py-1 border border-gray-300 rounded disabled:opacity-40"
              >Previous</button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={data.data.length < 25}
                className="text-sm px-3 py-1 border border-gray-300 rounded disabled:opacity-40"
              >Next</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

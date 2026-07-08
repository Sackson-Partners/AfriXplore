'use client';

import { useAdminAuth } from '@/hooks/useAdminAuth';
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
  draft: 'bg-yellow-900/30 text-yellow-400',
  reviewed: 'bg-blue-900/30 text-blue-400',
  published: 'bg-signal-low/20 text-signal-low',
};

export default function MinesAdminPage() {
  const isAuthenticated = useAdminAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isAuthenticated === false) router.push('/');
  }, [isAuthenticated, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-mines', page, search],
    queryFn: () => fetchMines(page, search || undefined),
    enabled: isAuthenticated === true,
  });

  if (isAuthenticated !== true) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-geo-obsidian min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-geo-white">Historical Mines</h2>
          <button className="bg-amber-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-600">
            + Add mine
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value as string); setPage(1); }}
          className="w-full max-w-sm border border-geo-steel rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-geo-graphite text-geo-cloud placeholder-geo-mist"
        />

        {isLoading && <p className="text-geo-mist">Loading…</p>}
        {error && <p className="text-signal-critical text-sm">Failed to load mines.</p>}

        {data && (
          <>
            <p className="text-sm text-geo-mist mb-3">{data.total} mines</p>
            <div className="bg-geo-slate rounded-xl border border-geo-steel overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-geo-graphite border-b border-geo-steel">
                  <tr>
                    {['Name', 'Country', 'Commodity', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-geo-mist uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-geo-steel/30">
                  {data.data.map((mine) => (
                    <tr key={mine.id} className="hover:bg-geo-graphite/50">
                      <td className="px-4 py-3 font-medium text-geo-white">{mine.name}</td>
                      <td className="px-4 py-3 text-geo-cloud">{mine.country}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {mine.commodity.map((c) => (
                            <span key={c} className="bg-amber-900/30 text-amber-400 text-xs px-2 py-0.5 rounded-full">{c}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[mine.digitisationStatus] ?? 'bg-geo-graphite text-geo-mist'}`}>
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
                className="text-sm px-3 py-1 border border-geo-steel rounded bg-geo-graphite text-geo-mist hover:text-geo-white hover:border-geo-mist transition-colors disabled:opacity-30"
              >Previous</button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={data.data.length < 25}
                className="text-sm px-3 py-1 border border-geo-steel rounded bg-geo-graphite text-geo-mist hover:text-geo-white hover:border-geo-mist transition-colors disabled:opacity-30"
              >Next</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

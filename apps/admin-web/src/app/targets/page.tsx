'use client';

import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';

interface Target {
  id: string;
  systemId: string | null;
  priorityScore: number | null;
  status: string;
  geologyRationale: string | null;
  recommendedTest: string | null;
  confidenceLevel: 'A' | 'B' | 'C';
  estimatedTonnage: string | null;
  createdAt: string;
}

interface TargetsResponse {
  data: Target[];
  total: number;
}

async function fetchTargets(page: number): Promise<TargetsResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  const res = await fetch(`${process.env.NEXT_PUBLIC_MSIM_API_URL}/targets?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json() as Promise<TargetsResponse>;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  A: 'bg-signal-low/20 text-signal-low',
  B: 'bg-yellow-900/30 text-yellow-400',
  C: 'bg-geo-graphite text-geo-mist',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-900/30 text-yellow-400',
  published: 'bg-signal-low/20 text-signal-low',
  licensed: 'bg-blue-900/30 text-blue-400',
};

export default function TargetsPage() {
  const isAuthenticated = useAdminAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isAuthenticated === false) router.push('/');
  }, [isAuthenticated, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-targets', page],
    queryFn: () => fetchTargets(page),
    enabled: isAuthenticated === true,
  });

  if (isAuthenticated !== true) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-geo-obsidian min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-geo-white">MSIM Targets</h2>
          <button className="bg-amber-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-600">
            + Add target
          </button>
        </div>

        {isLoading && <p className="text-geo-mist">Loading&#8230;</p>}
        {error && <p className="text-signal-critical text-sm">Failed to load targets.</p>}

        {data && (
          <>
            <p className="text-sm text-geo-mist mb-3">{data.total} targets</p>
            <div className="bg-geo-slate rounded-xl border border-geo-steel overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-geo-graphite border-b border-geo-steel">
                  <tr>
                    {['Priority', 'Confidence', 'Status', 'Rationale', 'Est. Value', ''].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-medium text-geo-mist uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-geo-steel/30">
                  {data.data.map((t) => (
                    <tr key={t.id} className="hover:bg-geo-graphite/50">
                      <td className="px-4 py-3 font-mono text-geo-white font-semibold">
                        {t.priorityScore != null ? Number(t.priorityScore).toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${CONFIDENCE_COLORS[t.confidenceLevel] ?? ''}`}
                        >
                          {t.confidenceLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status] ?? 'bg-geo-graphite text-geo-mist'}`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-geo-cloud max-w-xs truncate">
                        {t.geologyRationale ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-geo-cloud font-mono text-xs">
                        {t.estimatedTonnage ?? '—'}
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
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={data.data.length < 25}
                className="text-sm px-3 py-1 border border-geo-steel rounded bg-geo-graphite text-geo-mist hover:text-geo-white hover:border-geo-mist transition-colors disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

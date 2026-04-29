'use client';

import { useIsAuthenticated } from '@azure/msal-react';
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
  A: 'bg-green-100 text-green-700',
  B: 'bg-yellow-100 text-yellow-700',
  C: 'bg-gray-100 text-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  licensed: 'bg-blue-100 text-blue-700',
};

export default function TargetsPage() {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-targets', page],
    queryFn: () => fetchTargets(page),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">MSIM Targets</h2>
          <button className="bg-amber-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-600">
            + Add target
          </button>
        </div>

        {isLoading && <p className="text-gray-500">Loading&#8230;</p>}
        {error && <p className="text-red-500 text-sm">Failed to load targets.</p>}

        {data && (
          <>
            <p className="text-sm text-gray-500 mb-3">{data.total} targets</p>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Priority', 'Confidence', 'Status', 'Rationale', 'Est. Value', ''].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-gray-900 font-semibold">
                        {t.priorityScore != null ? t.priorityScore.toFixed(1) : '&#8212;'}
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
                          className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                        {t.geologyRationale ?? '&#8212;'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {t.estimatedTonnage ?? '&#8212;'}
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
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={data.data.length < 25}
                className="text-sm px-3 py-1 border border-gray-300 rounded disabled:opacity-40"
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

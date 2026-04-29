'use client';

import { useIsAuthenticated } from '@azure/msal-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';

interface MineralSystem {
  id: string;
  name: string;
  type: string;
  country: string[];
  commodity: string[];
  prospectivityScore: number | null;
  createdAt: string;
}

interface SystemsResponse {
  data: MineralSystem[];
  total: number;
}

async function fetchSystems(page: number): Promise<SystemsResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  const res = await fetch(`${process.env.NEXT_PUBLIC_MSIM_API_URL}/systems?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json() as Promise<SystemsResponse>;
}

const TYPE_COLORS: Record<string, string> = {
  orogenic_gold: 'bg-yellow-100 text-yellow-700',
  sediment_hosted_copper: 'bg-orange-100 text-orange-700',
  other: 'bg-purple-100 text-purple-700',
  porphyry_copper: 'bg-red-100 text-red-700',
  iron_oxide_copper_gold: 'bg-pink-100 text-pink-700',
};

export default function SystemsPage() {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-systems', page],
    queryFn: () => fetchSystems(page),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Mineral Systems</h2>
          <button className="bg-amber-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-600">
            + Add system
          </button>
        </div>

        {isLoading && <p className="text-gray-500">Loading&#8230;</p>}
        {error && <p className="text-red-500 text-sm">Failed to load systems.</p>}

        {data && (
          <>
            <p className="text-sm text-gray-500 mb-3">{data.total} systems</p>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Name', 'Type', 'Country', 'Commodities', 'Score', ''].map((h) => (
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
                  {data.data.map((sys) => (
                    <tr key={sys.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{sys.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[sys.type] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {sys.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {Array.isArray(sys.country) ? sys.country.join(', ') : sys.country}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {sys.commodity.slice(0, 3).map((c) => (
                            <span
                              key={c}
                              className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {sys.prospectivityScore != null ? sys.prospectivityScore.toFixed(0) : '&#8212;'}
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

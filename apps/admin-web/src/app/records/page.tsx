'use client';

import { useIsAuthenticated } from '@azure/msal-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';

interface MiningRecord {
  id: string;
  mine_id: string;
  title: string;
  record_date: string | null;
  record_type: string;
  description: string | null;
  quantity_mt: number | null;
  confidence_score: number | null;
  source_reference: string | null;
  created_at: string;
}

interface RecordsResponse {
  data: MiningRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

async function fetchRecords(page: number, search?: string, recordType?: string): Promise<RecordsResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (search) params.set('search', search);
  if (recordType) params.set('recordType', recordType);
  const res = await fetch(`${process.env.NEXT_PUBLIC_MSIM_API_URL}/records?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json() as Promise<RecordsResponse>;
}

const TYPE_COLORS: Record<string, string> = {
  production: 'bg-green-100 text-green-700',
  survey: 'bg-blue-100 text-blue-700',
  incident: 'bg-red-100 text-red-700',
  inspection: 'bg-purple-100 text-purple-700',
  administrative: 'bg-gray-100 text-gray-600',
};

const RECORD_TYPES = ['', 'production', 'survey', 'incident', 'inspection', 'administrative'];

export default function RecordsPage() {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [recordType, setRecordType] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-records', page, search, recordType],
    queryFn: () => fetchRecords(page, search || undefined, recordType || undefined),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Mining Records</h2>
        </div>

        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Full-text search…"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
            className="w-full max-w-xs border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <select
            value={recordType}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setRecordType(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {RECORD_TYPES.map((t) => (
              <option key={t} value={t}>{t || 'All types'}</option>
            ))}
          </select>
        </div>

        {isLoading && <p className="text-gray-500">Loading…</p>}
        {error && <p className="text-red-500 text-sm">Failed to load records.</p>}

        {data && (
          <>
            <p className="text-sm text-gray-500 mb-3">{data.total} records</p>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Title', 'Type', 'Date', 'Quantity (Mt)', 'Confidence', 'Source'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{r.title}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[r.record_type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {r.record_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {r.record_date ? new Date(r.record_date).getFullYear() : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {r.quantity_mt != null ? Number(r.quantity_mt).toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {r.confidence_score != null ? `${(Number(r.confidence_score) * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                        {r.source_reference ?? '—'}
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

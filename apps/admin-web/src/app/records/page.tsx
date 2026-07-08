'use client';

import { useAdminAuth } from '@/hooks/useAdminAuth';
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
  production: 'bg-signal-low/20 text-signal-low',
  survey: 'bg-blue-900/30 text-blue-400',
  incident: 'bg-signal-critical/20 text-signal-critical',
  inspection: 'bg-purple-900/30 text-purple-400',
  administrative: 'bg-geo-graphite text-geo-mist',
};

const RECORD_TYPES = ['', 'production', 'survey', 'incident', 'inspection', 'administrative'];

export default function RecordsPage() {
  const isAuthenticated = useAdminAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [recordType, setRecordType] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isAuthenticated === false) router.push('/');
  }, [isAuthenticated, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-records', page, search, recordType],
    queryFn: () => fetchRecords(page, search || undefined, recordType || undefined),
    enabled: isAuthenticated === true,
  });

  if (isAuthenticated !== true) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-geo-obsidian min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-geo-white">Mining Records</h2>
        </div>

        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Full-text search…"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
            className="w-full max-w-xs border border-geo-steel rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-geo-graphite text-geo-cloud placeholder-geo-mist"
          />
          <select
            value={recordType}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setRecordType(e.target.value); setPage(1); }}
            className="border border-geo-steel rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-geo-graphite text-geo-cloud placeholder-geo-mist"
          >
            {RECORD_TYPES.map((t) => (
              <option key={t} value={t}>{t || 'All types'}</option>
            ))}
          </select>
        </div>

        {isLoading && <p className="text-geo-mist">Loading…</p>}
        {error && <p className="text-signal-critical text-sm">Failed to load records.</p>}

        {data && (
          <>
            <p className="text-sm text-geo-mist mb-3">{data.total} records</p>
            <div className="bg-geo-slate rounded-xl border border-geo-steel overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-geo-graphite border-b border-geo-steel">
                  <tr>
                    {['Title', 'Type', 'Date', 'Quantity (Mt)', 'Confidence', 'Source'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-geo-mist uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-geo-steel/30">
                  {data.data.map((r) => (
                    <tr key={r.id} className="hover:bg-geo-graphite/50">
                      <td className="px-4 py-3 font-medium text-geo-white max-w-xs truncate">{r.title}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[r.record_type] ?? 'bg-geo-graphite text-geo-mist'}`}>
                          {r.record_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-geo-cloud whitespace-nowrap">
                        {r.record_date ? new Date(r.record_date).getFullYear() : '—'}
                      </td>
                      <td className="px-4 py-3 text-geo-cloud font-mono text-xs">
                        {r.quantity_mt != null ? Number(r.quantity_mt).toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-3 text-geo-cloud font-mono text-xs">
                        {r.confidence_score != null ? `${(Number(r.confidence_score) * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-geo-mist text-xs max-w-xs truncate">
                        {r.source_reference ?? '—'}
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

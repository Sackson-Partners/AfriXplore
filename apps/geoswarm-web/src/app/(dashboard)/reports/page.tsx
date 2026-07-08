'use client';

import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_GEOSWARM_API_URL ?? 'http://localhost:3003';

interface Report {
  id: string;
  title?: string;
  survey_order_id?: string;
  geologist_name?: string;
  anomaly_count?: number;
  status?: string;
  created_at?: string;
}

function StatusBadge({ status }: { status?: string }) {
  const s = status ?? 'draft';
  const styles: Record<string, string> = {
    final: 'bg-scan-green/10 border-scan-green/30 text-scan-green',
    draft: 'bg-signal-medium/10 border-signal-medium/30 text-signal-medium',
    review: 'bg-drone-primary/10 border-drone-primary/30 text-drone-primary',
  };
  const cls = styles[s] ?? 'bg-geo-graphite border-geo-steel text-geo-mist';
  return (
    <span className={`inline-flex items-center border rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {s}
    </span>
  );
}

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/reports?limit=100`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<{ data: Report[]; total: number }>;
    },
  });

  const reports = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-geo-white text-xl">Interpretation Reports</h1>
          <p className="text-geo-mist text-sm mt-0.5">
            AI-generated geophysical interpretation reports for completed surveys.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-geo-mist">
          <span className="w-1.5 h-1.5 rounded-full bg-scan-green" />
          {data?.total ?? 0} reports total
        </div>
      </div>

      {/* Report list */}
      <div className="bg-geo-slate border border-geo-steel rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-geo-graphite rounded-lg animate-pulse" />)}
          </div>
        ) : !reports.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-xl bg-geo-graphite border border-geo-steel flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-geo-mist" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-geo-cloud font-medium text-sm">No reports available yet</p>
            <p className="text-geo-mist text-xs mt-1">Reports are generated automatically after survey processing is complete.</p>
          </div>
        ) : (
          <div className="divide-y divide-geo-steel">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-4 hover:bg-geo-graphite/40 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-drone-primary/10 border border-drone-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-drone-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-geo-white font-medium">{r.title ?? `Report ${r.id.slice(0, 8)}`}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {r.geologist_name && (
                        <span className="text-xs text-geo-mist">{r.geologist_name}</span>
                      )}
                      {r.anomaly_count != null && (
                        <span className="text-xs text-geo-mist">{r.anomaly_count} anomalies</span>
                      )}
                      {r.created_at && (
                        <span className="text-xs text-geo-mist font-mono">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={r.status} />
                  <button className="text-xs text-drone-primary hover:underline font-medium">View</button>
                  <button className="text-xs text-geo-mist hover:text-geo-cloud font-medium">Download</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

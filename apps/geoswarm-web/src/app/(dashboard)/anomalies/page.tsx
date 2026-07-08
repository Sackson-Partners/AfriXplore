'use client';

import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_GEOSWARM_API_URL ?? 'http://localhost:5003';

interface Anomaly {
  id: string;
  anomaly_type: string;
  confidence_score: number;
  depth_estimate_m?: number;
  status: string;
  detected_at?: string;
  latitude?: number;
  longitude?: number;
}

function ConfidenceBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-scan-green bg-scan-green/10 border-scan-green/30' :
    score >= 60 ? 'text-signal-medium bg-signal-medium/10 border-signal-medium/30' :
    'text-signal-critical bg-signal-critical/10 border-signal-critical/30';
  return (
    <span className={`inline-flex items-center border rounded-full px-2 py-0.5 text-xs font-mono font-semibold ${color}`}>
      {score}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    certified: 'bg-scan-green/10 border-scan-green/30 text-scan-green',
    pending: 'bg-signal-medium/10 border-signal-medium/30 text-signal-medium',
    rejected: 'bg-signal-critical/10 border-signal-critical/30 text-signal-critical',
  };
  const cls = styles[status] ?? 'bg-geo-graphite border-geo-steel text-geo-mist';
  return (
    <span className={`inline-flex items-center border rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

export default function AnomaliesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['anomalies'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/anomalies?limit=100`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<{ data: Anomaly[]; total: number }>;
    },
  });

  const anomalies = data?.data ?? [];
  const highConfidence = anomalies.filter((a) => a.confidence_score > 80).length;
  const certified = anomalies.filter((a) => a.status === 'certified').length;
  const pending = anomalies.filter((a) => a.status === 'pending').length;

  const STATS = [
    { label: 'Total Anomalies', value: String(data?.total ?? 0), color: 'text-geo-white' },
    { label: 'High Confidence (>80%)', value: String(highConfidence), color: 'text-scan-green' },
    { label: 'Certified', value: String(certified), color: 'text-drone-primary' },
    { label: 'Pending Review', value: String(pending), color: 'text-signal-medium' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div key={s.label} className="bg-geo-slate border border-geo-steel rounded-xl p-5">
            <p className="text-xs text-geo-mist uppercase tracking-wide font-medium mb-2">{s.label}</p>
            <p className={`font-mono font-bold text-3xl ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-geo-slate border border-geo-steel rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-geo-steel">
          <h2 className="font-display font-semibold text-geo-white text-sm">Anomaly Registry</h2>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-geo-graphite rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !anomalies.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-xl bg-geo-graphite border border-geo-steel flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-geo-mist" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <p className="text-geo-cloud font-medium text-sm">No anomalies detected yet</p>
            <p className="text-geo-mist text-xs mt-1">Anomalies will appear here once a survey is processed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-geo-steel text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">ID</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Anomaly Type</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Confidence</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Depth Est.</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-geo-steel">
                {anomalies.map((a) => (
                  <tr key={a.id} className="hover:bg-geo-graphite/40 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-geo-mist">{a.id.slice(0, 8)}…</td>
                    <td className="px-5 py-3 text-geo-cloud font-medium">{a.anomaly_type}</td>
                    <td className="px-5 py-3"><ConfidenceBadge score={a.confidence_score} /></td>
                    <td className="px-5 py-3 font-mono text-xs text-geo-cloud">
                      {a.depth_estimate_m != null ? `${a.depth_estimate_m}m` : '—'}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-5 py-3">
                      <button className="text-xs text-drone-primary hover:underline font-medium">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

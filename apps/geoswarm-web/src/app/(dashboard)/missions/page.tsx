'use client';

import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_GEOSWARM_API_URL ?? 'http://localhost:5003';

interface Mission {
  id: string;
  survey_order_id: string;
  mission_date: string;
  pilot_name?: string;
  aircraft_id?: string;
  status: string;
  altitude_m?: number;
  weather_conditions?: string;
  project_name?: string;
  area_km2?: number;
  created_at: string;
}

interface MissionStats {
  scheduled: number;
  in_flight: number;
  completed: number;
  cancelled: number;
  total: number;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    scheduled: 'bg-drone-primary/10 border-drone-primary/30 text-drone-primary',
    in_flight: 'bg-scan-green/10 border-scan-green/30 text-scan-green animate-pulse',
    completed: 'bg-geo-cloud/10 border-geo-cloud/30 text-geo-cloud',
    cancelled: 'bg-signal-critical/10 border-signal-critical/30 text-signal-critical',
  };
  const cls = styles[status] ?? 'bg-geo-graphite border-geo-steel text-geo-mist';
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {status === 'in_flight' && <span className="w-1.5 h-1.5 rounded-full bg-scan-green animate-pulse" />}
      {status.replace('_', ' ')}
    </span>
  );
}

export default function MissionsPage() {
  const { data: missions, isLoading } = useQuery({
    queryKey: ['missions'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/missions?limit=100`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<{ data: Mission[]; total: number }>;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['missions', 'stats'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/missions/stats/summary`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<MissionStats>;
    },
  });

  const missionList = missions?.data ?? [];

  const STATS = [
    { label: 'Scheduled', value: String(stats?.scheduled ?? 0), color: 'text-drone-primary' },
    { label: 'In Flight', value: String(stats?.in_flight ?? 0), color: 'text-scan-green' },
    { label: 'Completed', value: String(stats?.completed ?? 0), color: 'text-geo-cloud' },
    { label: 'Total Missions', value: String(stats?.total ?? 0), color: 'text-geo-white' },
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
        <div className="px-5 py-4 border-b border-geo-steel flex items-center justify-between">
          <h2 className="font-display font-semibold text-geo-white text-sm">Flight Missions</h2>
          <button className="px-3 py-1.5 bg-drone-primary/10 border border-drone-primary/30 text-drone-primary text-xs font-semibold rounded-lg hover:bg-drone-primary/20 transition-all">
            + Schedule Mission
          </button>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-geo-graphite rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !missionList.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-xl bg-geo-graphite border border-geo-steel flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-geo-mist" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </div>
            <p className="text-geo-cloud font-medium text-sm">No missions scheduled yet</p>
            <p className="text-geo-mist text-xs mt-1">Schedule your first flight mission to begin drone operations.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-geo-steel text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Mission ID</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Project</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Mission Date</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Pilot</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Aircraft</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Area</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-geo-steel">
                {missionList.map((m) => (
                  <tr key={m.id} className="hover:bg-geo-graphite/40 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-geo-mist">{m.id.slice(0, 8)}…</td>
                    <td className="px-5 py-3 text-geo-cloud font-medium">{m.project_name ?? '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-geo-cloud">
                      {new Date(m.mission_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3 text-xs text-geo-mist">{m.pilot_name ?? '—'}</td>
                    <td className="px-5 py-3 text-xs text-geo-mist">{m.aircraft_id ?? '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-geo-cloud">
                      {m.area_km2 != null ? `${m.area_km2.toFixed(0)} km²` : '—'}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={m.status} /></td>
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

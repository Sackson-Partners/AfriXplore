'use client';

import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_GEOSWARM_API_URL ?? 'http://localhost:5003';

interface Scout {
  id: string;
  country: string;
  district: string;
  status: string;
  kyc_status: string;
  badge_level: string;
  points_earned: number;
  payouts_usd: number;
  created_at: string;
}

interface ScoutStats {
  active: number;
  inactive: number;
  kyc_verified: number;
  kyc_pending: number;
  total_points: number;
  total_payouts_usd: number;
  total: number;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-scan-green/10 border-scan-green/30 text-scan-green',
    inactive: 'bg-geo-graphite border-geo-steel text-geo-mist',
  };
  const cls = styles[status] ?? 'bg-geo-graphite border-geo-steel text-geo-mist';
  return (
    <span className={`inline-flex items-center border rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

function BadgePill({ level }: { level: string }) {
  const colors: Record<string, string> = {
    bronze: 'bg-amber-900/30 border-amber-700/40 text-amber-400',
    silver: 'bg-slate-700/40 border-slate-500/40 text-slate-300',
    gold: 'bg-yellow-900/40 border-yellow-700/40 text-yellow-300',
    platinum: 'bg-cyan-900/40 border-cyan-700/40 text-cyan-300',
  };
  const cls = colors[level] ?? 'bg-geo-graphite border-geo-steel text-geo-mist';
  return (
    <span className={`inline-flex items-center border rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {level}
    </span>
  );
}

export default function ScoutsPage() {
  const { data: scouts, isLoading } = useQuery({
    queryKey: ['scouts'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/scouts?limit=100`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<{ data: Scout[]; total: number }>;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['scouts', 'stats'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/scouts/stats/summary`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<ScoutStats>;
    },
  });

  const scoutList = scouts?.data ?? [];

  const STATS = [
    { label: 'Active Scouts', value: String(stats?.active ?? 0), color: 'text-scan-green' },
    { label: 'KYC Verified', value: String(stats?.kyc_verified ?? 0), color: 'text-drone-primary' },
    { label: 'Total Points', value: String(stats?.total_points ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ','), color: 'text-geo-cloud' },
    { label: 'Total Payouts', value: `$${String(stats?.total_payouts_usd ?? 0)}`, color: 'text-geo-white' },
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
          <h2 className="font-display font-semibold text-geo-white text-sm">Scout Network</h2>
          <button className="px-3 py-1.5 bg-drone-primary/10 border border-drone-primary/30 text-drone-primary text-xs font-semibold rounded-lg hover:bg-drone-primary/20 transition-all">
            + Invite Scout
          </button>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-geo-graphite rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !scoutList.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-xl bg-geo-graphite border border-geo-steel flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-geo-mist" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p className="text-geo-cloud font-medium text-sm">No scouts enrolled yet</p>
            <p className="text-geo-mist text-xs mt-1">Invite scouts to start building your ground intelligence network.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-geo-steel text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Scout ID</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Location</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Badge</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Points</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Payouts</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">KYC</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-geo-mist">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-geo-steel">
                {scoutList.map((s) => (
                  <tr key={s.id} className="hover:bg-geo-graphite/40 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-geo-mist">{s.id.slice(0, 8)}…</td>
                    <td className="px-5 py-3 text-geo-cloud text-xs">
                      {s.district}, {s.country}
                    </td>
                    <td className="px-5 py-3"><BadgePill level={s.badge_level} /></td>
                    <td className="px-5 py-3 font-mono text-xs text-geo-cloud">{s.points_earned.toLocaleString()}</td>
                    <td className="px-5 py-3 font-mono text-xs text-geo-cloud">${s.payouts_usd.toFixed(2)}</td>
                    <td className="px-5 py-3 text-xs text-geo-mist capitalize">{s.kyc_status}</td>
                    <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
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

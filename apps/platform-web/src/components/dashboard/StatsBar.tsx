'use client';

import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/auth/msalConfig';

export function StatsBar() {
  const { instance, accounts } = useMsal();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      if (accounts.length === 0) return null;
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stats/summary`, {
        headers: { Authorization: `Bearer ${response.accessToken}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const items = [
    { label: 'Active Clusters', value: stats?.active_clusters ?? '—' },
    { label: 'High DPI (>70)', value: stats?.high_dpi_count ?? '—' },
    { label: 'Scout Reports (30d)', value: stats?.reports_30d ?? '—' },
    { label: 'Confirmed Targets', value: stats?.confirmed_targets ?? '—' },
  ];

  return (
    <div className="space-y-2">
      {items.map(({ label, value }) => (
        <div key={label} className="flex justify-between items-center py-2 border-b border-gray-800">
          <span className="text-xs text-gray-400">{label}</span>
          <span className="text-sm font-semibold text-white">{value}</span>
        </div>
      ))}
    </div>
  );
}

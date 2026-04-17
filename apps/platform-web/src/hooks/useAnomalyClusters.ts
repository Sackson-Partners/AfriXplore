'use client';

import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/auth/msalConfig';

async function fetchClusters(token: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/clusters?limit=500&min_dpi=30`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error('Failed to fetch clusters');
  const data = await res.json();
  return data.data;
}

export function useAnomalyClusters() {
  const { instance, accounts } = useMsal();

  return useQuery({
    queryKey: ['anomaly-clusters'],
    queryFn: async () => {
      if (accounts.length === 0) return [];
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      return fetchClusters(response.accessToken);
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 2 * 60 * 1000,
  });
}

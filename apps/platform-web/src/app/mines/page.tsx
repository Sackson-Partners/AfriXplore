'use client';

import { useIsAuthenticated } from '@azure/msal-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Mine {
  id: string;
  name: string;
  country: string;
  commodity: string[];
  digitisationStatus: string;
  location?: { type: string; coordinates: [number, number] };
}

async function fetchMines(page: number, search?: string): Promise<{ data: Mine[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (search) params.set('search', search);
  const res = await fetch(`${process.env.NEXT_PUBLIC_MSIM_API_URL}/mines?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch mines');
  return res.json() as Promise<{ data: Mine[]; total: number }>;
}

export default function MinesPage() {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['mines', page, search],
    queryFn: () => fetchMines(page, search || undefined),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Mine Browser</h1>
      </nav>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <input
          type="text"
          placeholder="Search mines by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {isLoading && <p className="text-gray-500">Loading…</p>}
        {data && (
          <>
            <p className="text-sm text-gray-500 mb-4">{data.total} mines found</p>
            <div className="space-y-2">
              {data.data.map((mine) => (
                <div key={mine.id} className="bg-white border border-gray-200 rounded-lg px-5 py-4 flex items-center justify-between hover:shadow-sm transition-shadow">
                  <div>
                    <p className="font-medium text-gray-900">{mine.name}</p>
                    <p className="text-sm text-gray-500">{mine.country}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {mine.commodity.map((c) => (
                      <span key={c} className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

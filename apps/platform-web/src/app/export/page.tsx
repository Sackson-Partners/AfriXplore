'use client';

import { useIsAuthenticated } from '@azure/msal-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ExportPage() {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const [format, setFormat] = useState<'geojson' | 'csv'>('geojson');
  const [country, setCountry] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (country) params.set('country', country);
      const res = await fetch(`${process.env.NEXT_PUBLIC_MSIM_API_URL}/export/mines?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ain-mines.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Data Export</h1>
      </nav>
      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="bg-white border border-gray-200 rounded-xl p-8">
          <h2 className="font-semibold text-gray-900 mb-6">Export Historical Mines</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'geojson' | 'csv')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="geojson">GeoJSON (RFC 7946)</option>
                <option value="csv">CSV (spreadsheet-compatible)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country filter (optional)</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. South Africa"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full bg-amber-500 text-white font-medium py-2.5 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {isExporting ? 'Exporting…' : `Download ${format.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

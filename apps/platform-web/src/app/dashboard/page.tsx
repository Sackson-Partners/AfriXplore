'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { StatsBar } from '@/components/dashboard/StatsBar';
import { AnomalyPanel } from '@/components/dashboard/AnomalyPanel';
import { AlertInbox } from '@/components/dashboard/AlertInbox';
import { AnomalyDetailModal } from '@/components/dashboard/AnomalyDetailModal';
import { useAnomalyClusters } from '@/hooks/useAnomalyClusters';
import type { AnomalyCluster } from '@/types/anomaly';

export default function DashboardPage() {
  const [selectedCluster, setSelectedCluster] = useState<AnomalyCluster | null>(null);
  const { data: clusters } = useAnomalyClusters();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Intelligence Dashboard</h1>
          <p className="text-xs text-gray-400">Real-time mineral anomaly monitoring across your licensed territory</p>
        </div>
        <span className="flex items-center gap-2 text-xs text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live
        </span>
      </header>

      <div className="grid grid-cols-12 gap-0 h-[calc(100vh-65px)]">
        {/* Left sidebar — stats + anomaly ranking */}
        <aside className="col-span-3 border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Summary</h2>
            <StatsBar />
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            <AnomalyPanel />
          </div>
        </aside>

        {/* Main content — cluster table */}
        <main className="col-span-6 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Anomaly Clusters
            </h2>
            <span className="text-xs text-gray-500">
              {clusters?.length ?? 0} clusters in territory
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-950 border-b border-gray-800">
                <tr className="text-xs text-gray-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Mineral</th>
                  <th className="text-left px-4 py-3">Location</th>
                  <th className="text-right px-4 py-3">DPI</th>
                  <th className="text-right px-4 py-3">Reports</th>
                  <th className="text-left px-4 py-3">Trend</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {clusters?.map((cluster: AnomalyCluster) => (
                  <tr
                    key={cluster.id}
                    className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedCluster(cluster)}
                  >
                    <td className="px-4 py-3 font-medium capitalize">{cluster.dominant_mineral}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {cluster.country}{cluster.district ? `, ${cluster.district}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${
                        cluster.dpi_score >= 90 ? 'text-red-400' :
                        cluster.dpi_score >= 70 ? 'text-orange-400' :
                        cluster.dpi_score >= 40 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {cluster.dpi_score}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{cluster.report_count}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium capitalize ${
                        cluster.trend === 'growing' ? 'text-green-400' :
                        cluster.trend === 'declining' ? 'text-red-400' : 'text-yellow-400'
                      }`}>
                        {cluster.trend}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full capitalize">
                        {cluster.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {!clusters?.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">
                      No anomaly clusters in your licensed territory.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>

        {/* Right sidebar — live alerts */}
        <aside className="col-span-3 border-l border-gray-800 p-4 overflow-y-auto">
          <AlertInbox />
        </aside>
      </div>

      {selectedCluster && (
        <AnomalyDetailModal
          cluster={selectedCluster}
          onClose={() => setSelectedCluster(null)}
        />
      )}
    </div>
  );
}

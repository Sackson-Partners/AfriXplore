'use client';

import { useAnomalyClusters } from '@/hooks/useAnomalyClusters';
import type { AnomalyCluster } from '@/types/anomaly';

export function AnomalyPanel() {
  const { data: clusters, isLoading } = useAnomalyClusters();

  const topClusters = clusters
    ?.slice()
    .sort((a: AnomalyCluster, b: AnomalyCluster) => b.dpi_score - a.dpi_score)
    .slice(0, 10);

  if (isLoading) return <div className="p-4 text-gray-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-2 overflow-y-auto">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Top Anomalies by DPI
      </h3>
      {topClusters?.map((cluster: AnomalyCluster) => (
        <div
          key={cluster.id}
          className="bg-gray-800 rounded-lg p-3 hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-white capitalize">{cluster.dominant_mineral}</p>
              <p className="text-xs text-gray-400">
                {cluster.country ?? 'Unknown'} · {cluster.report_count} reports
              </p>
            </div>
            <span className={`text-sm font-bold ${
              cluster.dpi_score >= 90 ? 'text-red-400' :
              cluster.dpi_score >= 70 ? 'text-orange-400' :
              cluster.dpi_score >= 40 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {cluster.dpi_score}
            </span>
          </div>
        </div>
      ))}
      {!topClusters?.length && (
        <p className="text-sm text-gray-500">No anomaly clusters in your territory.</p>
      )}
    </div>
  );
}

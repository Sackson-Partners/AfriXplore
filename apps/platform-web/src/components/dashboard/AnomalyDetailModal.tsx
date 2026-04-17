'use client';

import { AnomalyCluster } from '@/types/anomaly';

interface AnomalyDetailModalProps {
  cluster: AnomalyCluster;
  onClose: () => void;
}

export function AnomalyDetailModal({ cluster, onClose }: AnomalyDetailModalProps) {
  const dpiColor =
    cluster.dpi_score >= 90 ? 'text-red-400' :
    cluster.dpi_score >= 70 ? 'text-orange-400' :
    cluster.dpi_score >= 40 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white capitalize">
              {cluster.dominant_mineral} Anomaly
            </h2>
            <p className="text-sm text-gray-400">
              {cluster.country}{cluster.district ? `, ${cluster.district}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">DPI Score</p>
            <p className={`text-2xl font-bold ${dpiColor}`}>{cluster.dpi_score}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Reports</p>
            <p className="text-2xl font-bold text-white">{cluster.report_count}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Scouts</p>
            <p className="text-2xl font-bold text-white">{cluster.scout_count}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Trend</p>
            <p className={`text-sm font-semibold capitalize ${
              cluster.trend === 'growing' ? 'text-green-400' :
              cluster.trend === 'declining' ? 'text-red-400' : 'text-yellow-400'
            }`}>{cluster.trend}</p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">Status</p>
          <span className="inline-block px-3 py-1 bg-gray-700 rounded-full text-xs text-white capitalize">
            {cluster.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="text-xs text-gray-500">
          First seen: {new Date(cluster.first_seen).toLocaleDateString()}
          {' · '}
          Updated: {new Date(cluster.last_updated).toLocaleDateString()}
        </div>

        <div className="mt-4 flex gap-2">
          <button className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
            View Full Report
          </button>
          <button className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
            Export Data
          </button>
        </div>
      </div>
    </div>
  );
}

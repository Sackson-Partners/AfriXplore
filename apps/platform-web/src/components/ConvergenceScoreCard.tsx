'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { triggerConvergenceScore, getConvergenceEventsHistory, ConvergenceMineScore, ConvergenceEventItem } from '@/lib/api-client';
import { ConvergenceScoreBar } from './ConvergenceScoreBar';
import { CertifiedBadge } from './CertifiedBadge';

interface ConvergenceScoreCardProps {
  mineId: string;
  mineName: string;
}

const SCORE_THRESHOLDS = {
  drone: { max: 40, weak: 15, strong: 30 },
  archive: { max: 30, weak: 10, strong: 20 },
  scout: { max: 20, weak: 8, strong: 15 },
  geology: { max: 10, weak: 4, strong: 7 },
};

export function ConvergenceScoreCard({ mineId, mineName }: ConvergenceScoreCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const queryClient = useQueryClient();

  const { data: scoreData, isLoading: scoreLoading } = useQuery({
    queryKey: ['convergence', 'score', mineId],
    queryFn: () => triggerConvergenceScore(mineId),
    retry: false,
  });

  const { data: eventsData } = useQuery({
    queryKey: ['convergence', 'events', mineId],
    queryFn: () => getConvergenceEventsHistory(1, 10),
    enabled: showHistory,
  });

  const rescoretMutation = useMutation({
    mutationFn: () => triggerConvergenceScore(mineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['convergence', 'score', mineId] });
      queryClient.invalidateQueries({ queryKey: ['convergence', 'events', mineId] });
    },
  });

  const mineEvents = eventsData?.data?.filter((e) => e.mine_id === mineId) ?? [];

  if (scoreLoading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="h-48 flex items-center justify-center">
          <div className="animate-pulse text-gray-500">Loading convergence score...</div>
        </div>
      </div>
    );
  }

  if (!scoreData) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Convergence Assessment</h3>
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm mb-4">No convergence score available for this mine</p>
          <button
            onClick={() => rescoretMutation.mutate()}
            disabled={rescoretMutation.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {rescoretMutation.isPending ? 'Computing...' : 'Compute Score'}
          </button>
        </div>
      </div>
    );
  }

  const { convergence_score, breakdown, certified_target, scored_at } = scoreData;

  // Generate recommendations based on weak scores
  const recommendations = [];
  if (breakdown.drone_score < SCORE_THRESHOLDS.drone.weak) {
    recommendations.push({
      type: 'drone',
      icon: '🚁',
      message: 'Order GeoSwarm survey to detect geophysical anomalies',
      color: 'text-blue-400',
    });
  }
  if (breakdown.archive_score < SCORE_THRESHOLDS.archive.weak) {
    recommendations.push({
      type: 'archive',
      icon: '📚',
      message: 'Search archives for historical documents and reports',
      color: 'text-amber-400',
    });
  }
  if (breakdown.scout_score < SCORE_THRESHOLDS.scout.weak) {
    recommendations.push({
      type: 'scout',
      icon: '👤',
      message: 'Deploy scouts for ground validation and sampling',
      color: 'text-green-400',
    });
  }
  if (breakdown.geology_score < SCORE_THRESHOLDS.geology.weak) {
    recommendations.push({
      type: 'geology',
      icon: '🏔️',
      message: 'Request DPI reassessment with updated geological data',
      color: 'text-purple-400',
    });
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Convergence Assessment</h3>
          <p className="text-xs text-gray-400 mt-1">
            Unified scoring from drone, archive, scout, and geology data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors"
          >
            {showHistory ? 'Hide History' : 'View History'}
          </button>
          <button
            onClick={() => rescoretMutation.mutate()}
            disabled={rescoretMutation.isPending}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {rescoretMutation.isPending ? 'Computing...' : 'Rescore'}
          </button>
        </div>
      </div>

      {/* Overall Score */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-mono font-bold text-5xl text-white">{convergence_score.toFixed(0)}</span>
            <span className="text-xl text-gray-500">/100</span>
          </div>
          <CertifiedBadge certified={certified_target} size="md" />
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Last scored</p>
          <p className="text-sm text-gray-300 font-mono">
            {new Date(scored_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Breakdown Bar */}
      <div className="mb-6">
        <ConvergenceScoreBar breakdown={breakdown} totalScore={convergence_score} showLabels height="lg" />
      </div>

      {/* Component Scores */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { label: 'Drone Score', value: breakdown.drone_score, max: 40, icon: '🚁', color: 'text-blue-400' },
          { label: 'Archive Score', value: breakdown.archive_score, max: 30, icon: '📚', color: 'text-amber-400' },
          { label: 'Scout Score', value: breakdown.scout_score, max: 20, icon: '👤', color: 'text-green-400' },
          { label: 'Geology Score', value: breakdown.geology_score, max: 10, icon: '🏔️', color: 'text-purple-400' },
        ].map((component) => {
          const percentage = (component.value / component.max) * 100;
          const status = component.value >= component.max * 0.7 ? 'Strong' : component.value >= component.max * 0.4 ? 'Moderate' : 'Weak';

          return (
            <div key={component.label} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{component.icon}</span>
                  <span className="text-xs text-gray-400">{component.label}</span>
                </div>
                <span className={`text-sm font-mono font-bold ${component.color}`}>
                  {component.value}/{component.max}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${component.color.replace('text-', 'bg-')} rounded-full`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{status}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="border-t border-gray-800 pt-6">
          <h4 className="text-sm font-semibold text-white mb-3">Recommendations</h4>
          <div className="space-y-2">
            {recommendations.map((rec) => (
              <div key={rec.type} className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg">
                <span className="text-xl flex-shrink-0">{rec.icon}</span>
                <p className={`text-sm ${rec.color}`}>{rec.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Timeline */}
      {showHistory && (
        <div className="border-t border-gray-800 pt-6 mt-6">
          <h4 className="text-sm font-semibold text-white mb-4">Score History</h4>
          {mineEvents.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No history available</p>
          ) : (
            <div className="space-y-3">
              {mineEvents.map((event, idx) => {
                const delta = event.previous_score ? event.new_score - event.previous_score : 0;
                const isIncrease = delta > 0;

                return (
                  <div key={event.id} className="flex items-start gap-4">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      {idx < mineEvents.length - 1 && <div className="w-0.5 h-8 bg-gray-700 my-1" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-white">{event.new_score.toFixed(0)}</span>
                        {delta !== 0 && (
                          <span className={`text-xs font-mono ${isIncrease ? 'text-green-400' : 'text-red-400'}`}>
                            {isIncrease ? '+' : ''}{delta.toFixed(1)}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {new Date(event.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Triggered by: <span className="text-gray-300">{event.triggered_by.replace('_', ' ')}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

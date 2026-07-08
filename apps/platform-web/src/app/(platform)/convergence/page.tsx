'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getConvergenceScores, getConvergenceStats, ConvergenceScoreListItem, ConvergenceStats } from '@/lib/api-client';
import { ConvergenceScoreBar } from '@/components/ConvergenceScoreBar';
import { CertifiedBadge } from '@/components/CertifiedBadge';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { usePreferences } from '@/hooks/usePreferences';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { exportToCSV, exportToText, downloadTextFile } from '@/lib/export';

export default function ConvergencePage() {
  const { preferences, updatePreferences } = usePreferences();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const scoreFilter = preferences.convergence.scoreFilter;
  const pageSize = preferences.convergence.pageSize;

  const setScoreFilter = (filter: 'all' | 'certified' | 'high' | 'medium') => {
    updatePreferences({ convergence: { ...preferences.convergence, scoreFilter: filter } });
  };

  const setPageSize = (size: number) => {
    updatePreferences({ convergence: { ...preferences.convergence, pageSize: size } });
    setCurrentPage(1);
  };

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['convergence', 'stats'],
    queryFn: getConvergenceStats,
  });

  const { data: scores, isLoading: scoresLoading } = useQuery({
    queryKey: ['convergence', 'scores'],
    queryFn: () => getConvergenceScores(1, 100),
  });

  const allScores = scores?.data ?? [];

  // Apply score filter
  const filteredScores = useMemo(() => {
    return allScores.filter((score) => {
      if (scoreFilter === 'certified') return score.certified_target;
      if (scoreFilter === 'high') return score.estimated_convergence_score >= 60 && !score.certified_target;
      if (scoreFilter === 'medium') return score.estimated_convergence_score >= 30 && score.estimated_convergence_score < 60;
      return true;
    });
  }, [allScores, scoreFilter]);

  // Paginate
  const totalPages = Math.ceil(filteredScores.length / pageSize);
  const scoreList = filteredScores.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Calculate distribution for histogram (use filtered scores, not paginated)
  const distribution = useMemo(() => [
    { range: '0-29', count: filteredScores.filter((s) => s.estimated_convergence_score < 30).length, color: '#EF4444' },
    { range: '30-49', count: filteredScores.filter((s) => s.estimated_convergence_score >= 30 && s.estimated_convergence_score < 50).length, color: '#F59E0B' },
    { range: '50-69', count: filteredScores.filter((s) => s.estimated_convergence_score >= 50 && s.estimated_convergence_score < 70).length, color: '#3B82F6' },
    { range: '70-100', count: filteredScores.filter((s) => s.estimated_convergence_score >= 70).length, color: '#10B981' },
  ], [filteredScores]);

  const STATS = [
    {
      label: 'Certified Targets',
      value: String(stats?.certified_targets ?? 0),
      color: 'text-green-400',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: 'High Potential (≥60)',
      value: String(stats?.high_potential_targets ?? 0),
      color: 'text-blue-400',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      label: 'Average Score',
      value: String(stats?.average_score?.toFixed(1) ?? '0.0'),
      color: 'text-amber-400',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      label: 'Total Mines Scored',
      value: String(stats?.total_mines ?? 0),
      color: 'text-gray-300',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      ),
    },
  ];

  function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { range: string } }> }) {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-xs text-gray-400">{payload[0].payload.range}</p>
        <p className="font-mono text-sm text-white font-bold">{payload[0].value} mines</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Breadcrumb - hidden on mobile */}
      <div className="hidden md:block">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/dashboard' },
            { label: 'Intelligence', href: '/library' },
            { label: 'Convergence Dashboard' },
          ]}
        />
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Convergence Scores</h1>
          <p className="text-xs md:text-sm text-gray-400 mt-1">
            Unified target assessment combining drone surveys, archives, scout reports, and geology
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
              <button
                onClick={() => {
                  exportToCSV(scoreList, `convergence-targets-${new Date().toISOString().split('T')[0]}.csv`);
                  setShowExportMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors rounded-t-lg"
              >
                Export as CSV
              </button>
              <button
                onClick={() => {
                  const textContent = exportToText(scoreList);
                  downloadTextFile(textContent, `convergence-report-${new Date().toISOString().split('T')[0]}.txt`);
                  setShowExportMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors rounded-b-lg"
              >
                Export as Text Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid - 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <div className={`${stat.color}`}>{stat.icon}</div>
            </div>
            <p className={`font-mono font-bold text-2xl md:text-3xl mb-1 ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Distribution Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Score Distribution</h2>
          <p className="text-xs text-gray-400 mt-1">Mines grouped by convergence score range</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={distribution} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
            <XAxis dataKey="range" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {distribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-gray-400">Low (0-29)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span className="text-gray-400">Medium (30-49)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-gray-400">High (50-69)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-gray-400">Certified (70-100)</span>
          </div>
        </div>
      </div>

      {/* Top Targets Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Top Convergence Targets</h2>
            <p className="text-xs text-gray-400 mt-1">Mines ranked by convergence score</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Filter:</span>
            <div className="flex gap-1">
              {[
                { value: 'all' as const, label: 'All', count: allScores.length },
                { value: 'certified' as const, label: 'Certified (≥70)', count: allScores.filter((s) => s.certified_target).length },
                { value: 'high' as const, label: 'High (60-69)', count: allScores.filter((s) => s.estimated_convergence_score >= 60 && !s.certified_target).length },
                { value: 'medium' as const, label: 'Medium (30-59)', count: allScores.filter((s) => s.estimated_convergence_score >= 30 && s.estimated_convergence_score < 60).length },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setScoreFilter(filter.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    scoreFilter === filter.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {scoresLoading || statsLoading ? (
          <div className="p-6">
            <LoadingSkeleton variant="table" count={pageSize} />
          </div>
        ) : !scoreList.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-gray-300 font-medium text-sm">No convergence scores yet</p>
            <p className="text-gray-500 text-xs mt-1">Scores will appear once mines have been assessed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Rank</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Mine</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Score</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 w-80">Breakdown</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {scoreList
                  .sort((a, b) => b.estimated_convergence_score - a.estimated_convergence_score)
                  .map((item, idx) => (
                    <tr key={item.mine_id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-gray-400 text-sm">#{idx + 1}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{item.mine_name}</div>
                        <div className="text-xs text-gray-500 font-mono">{item.mine_id.slice(0, 8)}…</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-baseline gap-1">
                          <span className="font-mono font-bold text-2xl text-white">
                            {item.estimated_convergence_score.toFixed(0)}
                          </span>
                          <span className="text-sm text-gray-500">/100</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <ConvergenceScoreBar
                          breakdown={{
                            drone_score: 0,
                            archive_score: 0,
                            scout_score: 0,
                            geology_score: item.geology_score,
                          }}
                          totalScore={item.estimated_convergence_score}
                          height="sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <CertifiedBadge certified={item.certified_target} size="sm" />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!scoresLoading && !statsLoading && filteredScores.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredScores.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </div>
  );
}

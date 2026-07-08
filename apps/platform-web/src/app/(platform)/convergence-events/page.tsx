'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getConvergenceEventsHistory, ConvergenceEventItem } from '@/lib/api-client';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { usePreferences } from '@/hooks/usePreferences';
import Link from 'next/link';

export default function ConvergenceEventsPage() {
  const { preferences, updatePreferences } = usePreferences();
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = preferences.events.pageSize;

  const setPageSize = (size: number) => {
    updatePreferences({ events: { pageSize: size } });
    setCurrentPage(1);
  };

  const { data: eventsData, isLoading, error, refetch } = useQuery({
    queryKey: ['convergence', 'events', 'all', currentPage, pageSize],
    queryFn: () => getConvergenceEventsHistory(currentPage, pageSize),
    retry: 2,
  });

  const events = eventsData?.data ?? [];

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const date = new Date(event.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, ConvergenceEventItem[]>);

  const getTriggerColor = (trigger: string) => {
    if (trigger.includes('drone')) return 'text-blue-400';
    if (trigger.includes('archive')) return 'text-amber-400';
    if (trigger.includes('scout')) return 'text-green-400';
    if (trigger.includes('manual')) return 'text-purple-400';
    return 'text-gray-400';
  };

  const getTriggerIcon = (trigger: string) => {
    if (trigger.includes('drone')) return '🚁';
    if (trigger.includes('archive')) return '📚';
    if (trigger.includes('scout')) return '👤';
    if (trigger.includes('manual')) return '⚙️';
    return '📊';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Convergence', href: '/convergence' },
          { label: 'Score Events' },
        ]}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Convergence Events</h1>
        <p className="text-sm text-gray-400 mt-1">
          Real-time feed of score changes across all targets
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: String(events.length), color: 'text-gray-300' },
          { label: 'Drone Triggers', value: String(events.filter((e) => e.triggered_by.includes('drone')).length), color: 'text-blue-400' },
          { label: 'Archive Triggers', value: String(events.filter((e) => e.triggered_by.includes('archive')).length), color: 'text-amber-400' },
          { label: 'Scout Triggers', value: String(events.filter((e) => e.triggered_by.includes('scout')).length), color: 'text-green-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className={`font-mono font-bold text-3xl mb-1 ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Events Timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Event Timeline</h2>
          <p className="text-xs text-gray-400 mt-1">Chronological feed of convergence score updates</p>
        </div>

        {error ? (
          <div className="p-6">
            <ErrorState message="Failed to load convergence events" onRetry={() => refetch()} />
          </div>
        ) : isLoading ? (
          <div className="p-6">
            <LoadingSkeleton variant="list" count={pageSize} />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-300 font-medium text-sm">No events yet</p>
            <p className="text-gray-500 text-xs mt-1">Events will appear as convergence scores are computed.</p>
          </div>
        ) : (
          <div className="p-6 space-y-8">
            {Object.entries(groupedEvents).map(([date, dateEvents]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-sm font-semibold text-gray-300">{date}</h3>
                  <div className="flex-1 h-px bg-gray-800" />
                </div>

                <div className="space-y-4">
                  {dateEvents.map((event, idx) => {
                    const delta = event.previous_score ? event.new_score - event.previous_score : 0;
                    const isIncrease = delta > 0;
                    const isDecrease = delta < 0;

                    return (
                      <div key={event.id} className="flex items-start gap-4 group">
                        {/* Timeline connector */}
                        <div className="flex flex-col items-center flex-shrink-0 pt-1">
                          <div className={`w-3 h-3 rounded-full ${getTriggerColor(event.triggered_by).replace('text-', 'bg-')}`} />
                          {idx < dateEvents.length - 1 && <div className="w-0.5 flex-1 bg-gray-800 my-2 min-h-[20px]" />}
                        </div>

                        {/* Event card */}
                        <div className="flex-1 bg-gray-800/30 border border-gray-800 rounded-lg p-4 group-hover:border-gray-700 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{getTriggerIcon(event.triggered_by)}</span>
                              <div>
                                <Link
                                  href={`/mines/${event.mine_id}`}
                                  className="font-medium text-white hover:text-blue-400 transition-colors"
                                >
                                  {event.mine_name}
                                </Link>
                                <p className="text-xs text-gray-500 font-mono mt-0.5">
                                  {event.mine_id.slice(0, 8)}…
                                </p>
                              </div>
                            </div>

                            {/* Score change */}
                            <div className="text-right">
                              <div className="flex items-baseline gap-2">
                                {event.previous_score !== null && (
                                  <>
                                    <span className="font-mono text-sm text-gray-500 line-through">
                                      {event.previous_score.toFixed(0)}
                                    </span>
                                    <span className="text-gray-600">→</span>
                                  </>
                                )}
                                <span className="font-mono font-bold text-xl text-white">
                                  {event.new_score.toFixed(0)}
                                </span>
                              </div>
                              {delta !== 0 && (
                                <div className={`text-xs font-mono font-semibold mt-1 ${isIncrease ? 'text-green-400' : isDecrease ? 'text-red-400' : 'text-gray-400'}`}>
                                  {isIncrease ? '+' : ''}{delta.toFixed(1)}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Event details */}
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-500">Triggered by:</span>
                              <span className={`font-medium ${getTriggerColor(event.triggered_by)}`}>
                                {event.triggered_by.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-gray-500">
                                {new Date(event.created_at).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            {event.event_type !== 'score_computed' && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-gray-500">Event:</span>
                                <span className="text-gray-400">{event.event_type}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !error && eventsData && eventsData.total > pageSize && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(eventsData.total / pageSize)}
            totalItems={eventsData.total}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </div>
  );
}

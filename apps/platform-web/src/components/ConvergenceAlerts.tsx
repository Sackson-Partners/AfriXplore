'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getConvergenceEventsHistory, ConvergenceEventItem } from '@/lib/api-client';
import { useConvergenceWebSocket } from '@/lib/websocket';

interface Alert {
  id: string;
  message: string;
  timestamp: Date;
  type: 'certified' | 'threshold' | 'improvement';
}

export function ConvergenceAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Use WebSocket for real-time updates, fallback to polling if not connected
  const { lastMessage, isConnected } = useConvergenceWebSocket(true);

  const { data: eventsData } = useQuery({
    queryKey: ['convergence', 'events', 'recent'],
    queryFn: () => getConvergenceEventsHistory(1, 20),
    refetchInterval: isConnected ? false : 60000, // Only poll if WebSocket not connected
  });

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage?.type === 'score_update') {
      const event = lastMessage.data as ConvergenceEventItem;

      // Create alert from WebSocket event
      const newAlert = createAlertFromEvent(event);
      if (newAlert) {
        setAlerts((prev) => [newAlert, ...prev].slice(0, 10)); // Keep max 10 alerts
      }
    }
  }, [lastMessage]);

  const createAlertFromEvent = (event: ConvergenceEventItem): Alert | null => {
    // Alert when a mine crosses certification threshold (70)
    if (event.previous_score && event.previous_score < 70 && event.new_score >= 70) {
      return {
        id: `cert-${event.id}`,
        message: `🎉 ${event.mine_name} is now certified! Score jumped from ${event.previous_score.toFixed(0)} → ${event.new_score.toFixed(0)}`,
        timestamp: new Date(event.created_at),
        type: 'certified',
      };
    }

    // Alert when a mine crosses high potential threshold (60)
    if (event.previous_score && event.previous_score < 60 && event.new_score >= 60) {
      return {
        id: `thresh-${event.id}`,
        message: `📈 ${event.mine_name} reached high potential status (${event.new_score.toFixed(0)}/100)`,
        timestamp: new Date(event.created_at),
        type: 'threshold',
      };
    }

    // Alert for significant improvements (>15 points)
    if (event.previous_score && event.new_score - event.previous_score >= 15) {
      const delta = event.new_score - event.previous_score;
      return {
        id: `improve-${event.id}`,
        message: `⚡ ${event.mine_name} improved by ${delta.toFixed(0)} points (now ${event.new_score.toFixed(0)}/100)`,
        timestamp: new Date(event.created_at),
        type: 'improvement',
      };
    }

    return null;
  };

  useEffect(() => {
    if (!eventsData?.data) return;

    const newAlerts: Alert[] = [];

    eventsData.data.forEach((event) => {
      const alert = createAlertFromEvent(event);
      if (alert) newAlerts.push(alert);
    });

    // Only show alerts from last 24 hours and not dismissed
    const recent = newAlerts.filter((alert) => {
      const hoursSince = (Date.now() - alert.timestamp.getTime()) / (1000 * 60 * 60);
      return hoursSince < 24 && !dismissed.has(alert.id);
    });

    setAlerts(recent);
  }, [eventsData, dismissed]);

  const dismissAlert = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-md">
      {alerts.slice(0, 3).map((alert) => (
        <div
          key={alert.id}
          className="bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-4 animate-slide-in-right"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm text-white font-medium mb-1">{alert.message}</p>
              <p className="text-xs text-gray-400">
                {alert.timestamp.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <button
              onClick={() => dismissAlert(alert.id)}
              className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
      {alerts.length > 3 && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-3 text-center">
          <p className="text-xs text-gray-400">
            +{alerts.length - 3} more alert{alerts.length - 3 !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useSignalRAlerts } from '@/hooks/useSignalRAlerts';

interface Alert {
  id: string;
  type: 'anomaly' | 'field_dispatch' | 'system';
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
}

export function AlertInbox() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useSignalRAlerts({
    onAnomalyDetected: (data) => {
      setAlerts(prev => [{
        id: data.clusterId,
        type: 'anomaly',
        title: `New ${data.dominantMineral} anomaly detected`,
        body: `DPI Score: ${data.dpiScore} · ${data.requiresDispatch ? 'Field dispatch recommended' : 'Monitor'}`,
        timestamp: new Date(),
        read: false,
      }, ...prev.slice(0, 49)]);
    },
  });

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Live Alerts
      </h3>
      {alerts.length === 0 && (
        <p className="text-sm text-gray-500">No alerts. Listening for updates...</p>
      )}
      {alerts.map((alert) => (
        <div
          key={`${alert.id}-${alert.timestamp.getTime()}`}
          className={`rounded-lg p-3 border-l-2 ${
            alert.type === 'anomaly' ? 'border-orange-400 bg-orange-400/10' : 'border-blue-400 bg-blue-400/10'
          } ${!alert.read ? 'opacity-100' : 'opacity-60'}`}
        >
          <p className="text-sm font-medium text-white">{alert.title}</p>
          <p className="text-xs text-gray-400 mt-1">{alert.body}</p>
          <p className="text-xs text-gray-500 mt-1">
            {alert.timestamp.toLocaleTimeString()}
          </p>
        </div>
      ))}
    </div>
  );
}

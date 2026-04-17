'use client';

import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';

interface AnomalyDetectedData {
  clusterId: string;
  dominantMineral: string;
  dpiScore: number;
  requiresDispatch: boolean;
}

interface UseSignalRAlertsOptions {
  onAnomalyDetected?: (data: AnomalyDetectedData) => void;
}

export function useSignalRAlerts({ onAnomalyDetected }: UseSignalRAlertsOptions) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    const hubUrl = process.env.NEXT_PUBLIC_SIGNALR_HUB_URL;
    if (!hubUrl) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .build();

    connectionRef.current = connection;

    if (onAnomalyDetected) {
      connection.on('anomalyDetected', onAnomalyDetected);
    }

    connection.start().catch(() => {
      // SignalR not available — silent fail in development
    });

    return () => {
      connection.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

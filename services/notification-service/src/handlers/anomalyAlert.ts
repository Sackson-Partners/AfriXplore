import { ServiceBusReceivedMessage } from '@azure/service-bus';
import { sendSignalRBroadcast } from '../services/signalrService';
import { sendSMS } from '../services/smsService';
import { db } from '../db/client';

const log = {
  info:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'info',  service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
  warn:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'warn',  service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
  error: (msg: string, extra?: object) => process.stderr.write(JSON.stringify({ level: 'error', service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
};

interface AnomalyMessage {
  clusterId: string;
  dominantMineral: string;
  reportCount: number;
  timestamp: string;
}

export async function sendAnomalyAlert(message: ServiceBusReceivedMessage): Promise<void> {
  const body = message.body as AnomalyMessage;

  // Fetch authoritative DPI score and dispatch priority from DB —
  // clustering.py no longer computes these; intelligence-api owns them.
  const clusterRow = await db.query(
    `SELECT dpi_score, dispatch_priority FROM anomaly_clusters WHERE id = $1`,
    [body.clusterId]
  );

  if (clusterRow.rows.length === 0) {
    log.warn('anomaly-detected message references unknown cluster — skipping', { clusterId: body.clusterId });
    return;
  }

  const dpiScore: number = clusterRow.rows[0].dpi_score ?? 0;
  const requiresDispatch: boolean = clusterRow.rows[0].dispatch_priority === true;

  log.info('Processing anomaly alert', {
    clusterId: body.clusterId,
    dpiScore,
    dominantMineral: body.dominantMineral,
  });

  // Real-time dashboard push via SignalR
  await sendSignalRBroadcast('dashboard-hub', 'AnomalyDetected', {
    clusterId: body.clusterId,
    dpiScore,
    dominantMineral: body.dominantMineral,
    requiresDispatch,
    timestamp: new Date().toISOString(),
  });

  // Webhook delivery to licensed subscribers whose territory covers the cluster
  const subscribers = await db.query(
    `SELECT id, webhook_url, dpi_alert_threshold
     FROM subscribers
     WHERE is_active = true
       AND dpi_alert_threshold <= $1
       AND ST_Within(
         (SELECT centroid::geometry FROM anomaly_clusters WHERE id = $2),
         licensed_territories::geometry
       )`,
    [dpiScore, body.clusterId]
  );

  for (const sub of subscribers.rows) {
    if (sub.webhook_url) {
      deliverWebhook(sub.webhook_url, {
        event: 'anomaly.detected',
        cluster_id: body.clusterId,
        dpi_score: dpiScore,
        dominant_mineral: body.dominantMineral,
        requires_dispatch: requiresDispatch,
        timestamp: new Date().toISOString(),
      }).catch((err: Error) =>
        log.warn('Webhook delivery failed', { subscriberId: sub.id, error: err.message })
      );
    }
  }

  // SMS dispatch to available geologists when immediate field visit is required
  if (requiresDispatch) {
    const geologists = await db.query(
      `SELECT phone, full_name
       FROM field_geologists
       WHERE is_available = true
       LIMIT 2`
    );

    for (const geo of geologists.rows) {
      await sendSMS(
        geo.phone,
        `AfriXplore DISPATCH\n` +
        `DPI: ${dpiScore}/100\n` +
        `Mineral: ${body.dominantMineral.toUpperCase()}\n` +
        `Cluster: ${body.clusterId.slice(0, 8)}\n` +
        `48hr target. Check Field App.`
      ).catch((err: Error) =>
        log.warn('SMS failed', { phone: geo.phone.slice(0, -4) + '****', error: err.message })
      );
    }
  }
}

async function deliverWebhook(url: string, payload: object): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AfriXplore-Event': 'anomaly.detected',
      'X-AfriXplore-Timestamp': new Date().toISOString(),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

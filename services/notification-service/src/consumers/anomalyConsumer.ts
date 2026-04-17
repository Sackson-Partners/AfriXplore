import { ServiceBusClient } from '@azure/service-bus';
import { sendSignalRBroadcast } from '../services/signalrService';
import { sendSMS } from '../services/smsService';
import { db } from '../db/client';

const CONNECTION_STRING = process.env.SERVICE_BUS_CONNECTION_STRING!;

class AnomalyConsumer {
  private client: ServiceBusClient | null = null;

  async start(): Promise<void> {
    this.client = new ServiceBusClient(CONNECTION_STRING);
    const receiver = this.client.createReceiver(
      'anomaly-detected',
      'notification-service',
      { receiveMode: 'peekLock' }
    );

    console.log('Anomaly notification consumer started');

    receiver.subscribe({
      processMessage: async (message) => {
        const body = message.body as {
          clusterId: string;
          dpiScore: number;
          dominantMineral: string;
          requiresDispatch: boolean;
          timestamp: string;
        };

        await this.handleAnomalyDetected(body);
        await receiver.completeMessage(message);
      },
      processError: async (error) => {
        console.error('Anomaly consumer error:', error.error);
      },
    });
  }

  private async handleAnomalyDetected(body: {
    clusterId: string;
    dpiScore: number;
    dominantMineral: string;
    requiresDispatch: boolean;
  }): Promise<void> {
    console.log(
      `Anomaly: cluster=${body.clusterId} DPI=${body.dpiScore} mineral=${body.dominantMineral}`
    );

    await sendSignalRBroadcast('dashboard-hub', 'AnomalyDetected', {
      clusterId: body.clusterId,
      dpiScore: body.dpiScore,
      dominantMineral: body.dominantMineral,
      requiresDispatch: body.requiresDispatch,
      timestamp: new Date().toISOString(),
    });

    const subscribers = await db.query(
      `SELECT id, webhook_url, dpi_alert_threshold
       FROM subscribers
       WHERE is_active = true
         AND dpi_alert_threshold <= $1
         AND ST_Within(
           (SELECT centroid::geometry FROM anomaly_clusters WHERE id = $2),
           licensed_territories::geometry
         )`,
      [body.dpiScore, body.clusterId]
    );

    for (const sub of subscribers.rows) {
      if (sub.webhook_url) {
        deliverWebhook(sub.webhook_url, {
          event: 'anomaly.detected',
          cluster_id: body.clusterId,
          dpi_score: body.dpiScore,
          dominant_mineral: body.dominantMineral,
          requires_dispatch: body.requiresDispatch,
          timestamp: new Date().toISOString(),
        }).catch((err: Error) =>
          console.warn(`Webhook delivery failed for ${sub.id}: ${err.message}`)
        );
      }
    }

    if (body.requiresDispatch) {
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
          `DPI: ${body.dpiScore}/100\n` +
          `Mineral: ${body.dominantMineral.toUpperCase()}\n` +
          `Cluster: ${body.clusterId.slice(0, 8)}\n` +
          `48hr target. Check Field App.`
        ).catch((err: Error) =>
          console.warn(`SMS failed for ${geo.phone}: ${err.message}`)
        );
      }
    }
  }

  async stop(): Promise<void> {
    await this.client?.close();
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

export const anomalyConsumer = new AnomalyConsumer();

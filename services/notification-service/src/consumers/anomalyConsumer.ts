import { ServiceBusClient, ServiceBusReceivedMessage } from '@azure/service-bus';
import { sendSignalRBroadcast } from '../services/signalrService';
import { sendSMS } from '../services/smsService';
import { db } from '../db/client';

const log = {
  info:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'info',  service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
  warn:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'warn',  service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
  error: (msg: string, extra?: object) => process.stderr.write(JSON.stringify({ level: 'error', service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
};

const CONNECTION_STRING = process.env.SERVICE_BUS_CONNECTION_STRING!;
const MAX_DELIVERY_COUNT = 3;

interface AnomalyMessage {
  clusterId: string;
  dpiScore: number;
  dominantMineral: string;
  requiresDispatch: boolean;
  timestamp: string;
}

class AnomalyConsumer {
  private client: ServiceBusClient | null = null;

  async start(): Promise<void> {
    this.client = new ServiceBusClient(CONNECTION_STRING);
    const receiver = this.client.createReceiver(
      'anomaly-detected',
      'notification-service',
      { receiveMode: 'peekLock' }
    );

    log.info('Anomaly notification consumer started');

    receiver.subscribe({
      processMessage: async (message: ServiceBusReceivedMessage) => {
        const body = message.body as AnomalyMessage;
        const deliveryCount = message.deliveryCount ?? 0;

        try {
          await this.handleAnomalyDetected(body);
          await receiver.completeMessage(message);
        } catch (err) {
          const error = err as Error;
          log.error('Failed to process anomaly message', {
            clusterId: body.clusterId,
            deliveryCount,
            error: error.message,
          });

          if (deliveryCount >= MAX_DELIVERY_COUNT - 1) {
            await receiver.deadLetterMessage(message, {
              deadLetterReason: 'MaxRetriesExceeded',
              deadLetterErrorDescription: error.message,
            });
            log.error('Message dead-lettered after max retries', {
              clusterId: body.clusterId,
              deliveryCount,
            });
          } else {
            // Abandon — redelivered after lock timeout
            await receiver.abandonMessage(message);
          }
        }
      },
      processError: async (args) => {
        log.error('Anomaly consumer error', { error: String(args.error) });
      },
    });
  }

  private async handleAnomalyDetected(body: AnomalyMessage): Promise<void> {
    log.info('Processing anomaly detection', {
      clusterId: body.clusterId,
      dpiScore: body.dpiScore,
      dominantMineral: body.dominantMineral,
    });

    // Real-time dashboard push via SignalR
    await sendSignalRBroadcast('dashboard-hub', 'AnomalyDetected', {
      clusterId: body.clusterId,
      dpiScore: body.dpiScore,
      dominantMineral: body.dominantMineral,
      requiresDispatch: body.requiresDispatch,
      timestamp: new Date().toISOString(),
    });

    // Webhook delivery to licensed subscribers within the cluster's territory
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
          log.warn('Webhook delivery failed', { subscriberId: sub.id, error: err.message })
        );
      }
    }

    // SMS dispatch to available geologists when immediate field visit is required
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
          log.warn('SMS failed', { phone: geo.phone.slice(0, -4) + '****', error: err.message })
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

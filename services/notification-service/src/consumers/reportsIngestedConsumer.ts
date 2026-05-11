import { ServiceBusClient, ServiceBusReceivedMessage } from '@azure/service-bus';
import { handleReportIngested } from '../handlers/reportIngested';

const log = {
  info:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'info',  service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
  error: (msg: string, extra?: object) => process.stderr.write(JSON.stringify({ level: 'error', service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
};

const CONNECTION_STRING = process.env.SERVICE_BUS_CONNECTION_STRING!;
const TOPIC = 'reports-ingested';
const SUBSCRIPTION = 'notification-service';
const MAX_DELIVERY_COUNT = 3;

class ReportsIngestedConsumer {
  private client: ServiceBusClient | null = null;

  async start(): Promise<void> {
    this.client = new ServiceBusClient(CONNECTION_STRING);
    const receiver = this.client.createReceiver(
      TOPIC,
      SUBSCRIPTION,
      { receiveMode: 'peekLock' }
    );

    log.info('Reports-ingested notification consumer started');

    receiver.subscribe({
      processMessage: async (message: ServiceBusReceivedMessage) => {
        const deliveryCount = message.deliveryCount ?? 0;

        try {
          await handleReportIngested(message);
          await receiver.completeMessage(message);
        } catch (err) {
          const error = err as Error;
          log.error('Failed to process reports-ingested message', {
            deliveryCount,
            error: error.message,
          });

          if (deliveryCount >= MAX_DELIVERY_COUNT) {
            await receiver.deadLetterMessage(message, {
              deadLetterReason: 'MaxRetriesExceeded',
              deadLetterErrorDescription: error.message,
            });
            log.error('Message dead-lettered after max retries', { deliveryCount });
          } else {
            // Abandon — redelivered after lock timeout
            await receiver.abandonMessage(message);
          }
        }
      },
      processError: async (args) => {
        log.error('Reports-ingested consumer error', { error: String(args.error) });
      },
    });
  }

  async stop(): Promise<void> {
    await this.client?.close();
  }
}

export const reportsIngestedConsumer = new ReportsIngestedConsumer();

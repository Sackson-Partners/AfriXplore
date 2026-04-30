import { ServiceBusClient, ServiceBusReceivedMessage } from '@azure/service-bus';
import { sendPaymentNotification } from '../handlers/paymentNotification';

const log = {
  info:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'info',  service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
  error: (msg: string, extra?: object) => process.stderr.write(JSON.stringify({ level: 'error', service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
};

const CONNECTION_STRING = process.env.SERVICE_BUS_CONNECTION_STRING!;
const MAX_DELIVERY_COUNT = 3;

class PaymentConsumer {
  private client: ServiceBusClient | null = null;

  async start(): Promise<void> {
    this.client = new ServiceBusClient(CONNECTION_STRING);
    const receiver = this.client.createReceiver(
      'payment-triggered',
      'notification-service',
      { receiveMode: 'peekLock' }
    );

    log.info('Payment notification consumer started');

    receiver.subscribe({
      processMessage: async (message: ServiceBusReceivedMessage) => {
        const deliveryCount = message.deliveryCount ?? 0;

        try {
          await sendPaymentNotification(message);
          await receiver.completeMessage(message);
        } catch (err) {
          const error = err as Error;
          log.error('Failed to process payment notification', {
            deliveryCount,
            error: error.message,
          });

          if (deliveryCount >= MAX_DELIVERY_COUNT - 1) {
            await receiver.deadLetterMessage(message, {
              deadLetterReason: 'MaxRetriesExceeded',
              deadLetterErrorDescription: error.message,
            });
          } else {
            await receiver.abandonMessage(message);
          }
        }
      },
      processError: async (args) => {
        log.error('Payment consumer error', { error: String(args.error) });
      },
    });
  }

  async stop(): Promise<void> {
    await this.client?.close();
  }
}

export const paymentConsumer = new PaymentConsumer();

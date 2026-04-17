import { ServiceBusClient } from '@azure/service-bus';
import { sendPaymentNotification } from '../handlers/paymentNotification';

const CONNECTION_STRING = process.env.SERVICE_BUS_CONNECTION_STRING!;

class PaymentConsumer {
  private client: ServiceBusClient | null = null;

  async start(): Promise<void> {
    this.client = new ServiceBusClient(CONNECTION_STRING);
    const receiver = this.client.createReceiver(
      'payment-triggered',
      'notification-service',
      { receiveMode: 'peekLock' }
    );

    console.log('Payment notification consumer started');

    receiver.subscribe({
      processMessage: async (message) => {
        await sendPaymentNotification(message);
        await receiver.completeMessage(message);
      },
      processError: async (error) => {
        console.error('Payment consumer error:', error.error);
      },
    });
  }

  async stop(): Promise<void> {
    await this.client?.close();
  }
}

export const paymentConsumer = new PaymentConsumer();

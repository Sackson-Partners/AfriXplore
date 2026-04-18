import { ServiceBusClient, ServiceBusReceivedMessage } from '@azure/service-bus';
import { db } from '../db/client';
import { disburseFinderfee, createFinderFeePayment, getProviderForCountry } from '../services/mobileMoneyService';
import { publishToServiceBus } from '../utils/serviceBus';

const CONNECTION_STRING = process.env.SERVICE_BUS_CONNECTION_STRING!;
const TOPIC = 'payment-triggered';
const SUBSCRIPTION = 'payment-service';

class PaymentConsumer {
  private client: ServiceBusClient | null = null;

  async start() {
    this.client = new ServiceBusClient(CONNECTION_STRING);
    const receiver = this.client.createReceiver(TOPIC, SUBSCRIPTION, { receiveMode: 'peekLock' });

    console.log('Payment consumer started — listening for payment events');

    receiver.subscribe({
      processMessage: async (message: ServiceBusReceivedMessage) => {
        await this.processMessage(message);
        await receiver.completeMessage(message);
      },
      processError: async (error) => {
        console.error('Payment consumer error:', error.error);
      },
    });
  }

  private async processMessage(message: ServiceBusReceivedMessage) {
    const body = message.body as {
      type: 'finder_fee' | 'validated_anomaly_bonus';
      scoutId: string;
      reportId?: string;
      clusterId?: string;
      amountUsd: number;
      reason: string;
      retry?: number;
    };

    console.log(`Processing payment: ${body.type} for scout ${body.scoutId}`);

    try {
      const scoutResult = await db.query(
        `SELECT id, phone, wallet_mobile_money, wallet_provider, country FROM scouts WHERE id = $1 AND status = 'active'`,
        [body.scoutId]
      );

      if (scoutResult.rows.length === 0) {
        console.error(`Scout ${body.scoutId} not found or inactive`);
        return;
      }

      const scout = scoutResult.rows[0];
      const paymentId = await createFinderFeePayment(
        body.scoutId,
        body.reportId || '',
        body.clusterId || '',
        body.amountUsd
      );

      const provider = getProviderForCountry(scout.country, scout.wallet_provider);

      const result = await disburseFinderfee({
        paymentId,
        scoutId: body.scoutId,
        phoneNumber: scout.wallet_mobile_money || scout.phone,
        amount: body.amountUsd,
        currency: 'USD',
        provider,
        description: `AfriXplore ${body.type === 'finder_fee' ? 'Finder Fee' : 'Discovery Bonus'}`,
      });

      if (result.success) {
        await publishToServiceBus('payment-triggered', {
          event: 'disbursed',
          scoutId: body.scoutId,
          paymentId,
          amount: body.amountUsd,
          provider,
          reference: result.providerReference,
        });
        console.log(`Payment ${paymentId} disbursed: ${result.providerReference}`);
      } else {
        console.error(`Payment ${paymentId} failed: ${result.errorMessage}`);
        if ((body.retry || 0) < 3) {
          await publishToServiceBus(TOPIC, { ...body, retry: (body.retry || 0) + 1, lastError: result.errorMessage });
        }
      }
    } catch (error) {
      console.error('Payment processing error:', error);
    }
  }

  async stop() {
    await this.client?.close();
  }
}

export const serviceBusConsumer = new PaymentConsumer();

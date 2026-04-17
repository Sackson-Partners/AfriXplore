import { ServiceBusReceivedMessage } from '@azure/service-bus';

export async function sendPaymentNotification(message: ServiceBusReceivedMessage) {
  const body = message.body as {
    scoutId: string;
    amount: number;
    currency: string;
    type: string;
  };

  console.log(`Processing payment notification for scout ${body.scoutId}`);
  // TODO: Send SMS via Twilio/Africa's Talking
}

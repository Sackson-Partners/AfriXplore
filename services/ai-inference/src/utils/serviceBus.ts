import { ServiceBusClient } from '@azure/service-bus';

export async function publishToServiceBus(topic: string, message: object): Promise<void> {
  const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
  if (!connectionString) {
    console.warn('SERVICE_BUS_CONNECTION_STRING not set, skipping publish');
    return;
  }

  const client = new ServiceBusClient(connectionString);
  const sender = client.createSender(topic);

  try {
    await sender.sendMessages({
      body: message,
      contentType: 'application/json',
    });
  } finally {
    await sender.close();
    await client.close();
  }
}

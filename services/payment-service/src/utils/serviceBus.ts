import { ServiceBusClient } from '@azure/service-bus';

export async function publishToServiceBus(topic: string, message: object): Promise<void> {
  const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
  if (!connectionString) {
    process.stderr.write(JSON.stringify({ level: 'warn', service: 'payment-service', ts: new Date().toISOString(), msg: 'SERVICE_BUS_CONNECTION_STRING not set, skipping publish' }) + '\n');
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

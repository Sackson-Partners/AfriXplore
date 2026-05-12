import { DefaultAzureCredential } from '@azure/identity';

const SIGNALR_CONNECTION_STRING = process.env.AZURE_SIGNALR_CONNECTION_STRING!;

interface SignalRMessage {
  target: string;
  arguments: unknown[];
}

export async function sendSignalRBroadcast(
  hub: string,
  target: string,
  data: object
): Promise<void> {
  const endpointMatch = SIGNALR_CONNECTION_STRING.match(
    /Endpoint=(https?:\/\/[^;]+)/
  );
  if (!endpointMatch) {
    process.stderr.write(JSON.stringify({ level: 'warn', service: 'notification-service', ts: new Date().toISOString(), msg: 'SignalR connection string missing Endpoint' }) + '\n');
    return;
  }

  const endpoint = endpointMatch[1];
  const apiUrl = `${endpoint}/api/v1/hubs/${hub}`;

  const message: SignalRMessage = { target, arguments: [data] };

  try {
    const credential = new DefaultAzureCredential();
    const tokenResult = await credential.getToken('https://signalr.azure.com/.default');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenResult?.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      process.stderr.write(JSON.stringify({ level: 'error', service: 'notification-service', ts: new Date().toISOString(), msg: `SignalR broadcast failed: HTTP ${response.status}` }) + '\n');
    } else {
      process.stdout.write(JSON.stringify({ level: 'info', service: 'notification-service', ts: new Date().toISOString(), msg: `SignalR broadcast -> ${hub}/${target}` }) + '\n');
    }
  } catch (error) {
    process.stderr.write(JSON.stringify({ level: 'error', service: 'notification-service', ts: new Date().toISOString(), msg: 'SignalR service error', error: (error as Error).message }) + '\n');
  }
}

export async function sendSignalRToUser(
  hub: string,
  userId: string,
  target: string,
  data: object
): Promise<void> {
  const endpointMatch = SIGNALR_CONNECTION_STRING.match(
    /Endpoint=(https?:\/\/[^;]+)/
  );
  if (!endpointMatch) return;

  const endpoint = endpointMatch[1];
  const apiUrl = `${endpoint}/api/v1/hubs/${hub}/users/${encodeURIComponent(userId)}`;

  const credential = new DefaultAzureCredential();
  const tokenResult = await credential.getToken('https://signalr.azure.com/.default');

  await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenResult?.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ target, arguments: [data] }),
  });
}

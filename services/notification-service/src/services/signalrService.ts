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
    console.warn('SignalR connection string missing Endpoint');
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
      console.error(`SignalR broadcast failed: HTTP ${response.status}`);
    } else {
      console.log(`SignalR broadcast -> ${hub}/${target}`);
    }
  } catch (error) {
    console.error('SignalR service error:', error);
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

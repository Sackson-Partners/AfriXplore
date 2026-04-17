import { ServiceBusReceivedMessage } from '@azure/service-bus';

export async function sendAnomalyAlert(message: ServiceBusReceivedMessage) {
  const body = message.body as {
    clusterId: string;
    dpiScore: number;
    dominantMineral: string;
    requiresDispatch: boolean;
  };

  console.log(`Processing anomaly alert for cluster ${body.clusterId}, DPI: ${body.dpiScore}`);

  // TODO: Query subscribers with territory covering this cluster
  // TODO: Send email/webhook notifications via configured channels
  // TODO: Trigger SignalR push to connected dashboard clients
}

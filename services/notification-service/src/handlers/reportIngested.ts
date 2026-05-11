import { ServiceBusReceivedMessage } from '@azure/service-bus';
import { sendSignalRBroadcast } from '../services/signalrService';
import { db } from '../db/client';

interface ReportIngestedMessage {
  reportId: string;
  scoutId: string;
  mineralType: string;
  source: 'ussd' | 'app';
  phoneNumber?: string;
  timestamp: string;
}

export async function handleReportIngested(message: ServiceBusReceivedMessage): Promise<void> {
  const body = message.body as ReportIngestedMessage;

  // 1. Broadcast to validator dashboard via SignalR
  await sendSignalRBroadcast('validation-hub', 'ReportSubmitted', {
    reportId: body.reportId,
    scoutId: body.scoutId,
    mineralType: body.mineralType,
    source: body.source,
    timestamp: body.timestamp,
  });

  // 2. Look up the report country for routing
  const reportResult = await db.query(
    `SELECT country, district FROM reports WHERE id = $1`,
    [body.reportId]
  ).catch(() => ({ rows: [] }));  // graceful if table doesn't exist yet

  const country = reportResult.rows[0]?.country ?? 'UNKNOWN';
  const district = reportResult.rows[0]?.district ?? '';

  // Log — actual assignment logic would be done by the validation platform
  process.stdout.write(JSON.stringify({
    level: 'info',
    service: 'notification-service',
    ts: new Date().toISOString(),
    msg: 'Report ingested — validator notification sent',
    reportId: body.reportId,
    mineralType: body.mineralType,
    country,
    district,
    source: body.source,
  }) + '\n');
}

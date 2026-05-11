/**
 * AfriXplore — AI Inference Service Bus Consumer
 * Subscribes to reports-ingested topic
 */

import { ServiceBusClient, ServiceBusReceivedMessage } from '@azure/service-bus';
import { runMineralIdentification } from '../mineralIdentification';
import { runVoiceTranscription } from '../voiceTranscription';
import { db } from '../db/client';
import { trackEvent } from '../utils/appInsights';

const MAX_CONCURRENT = 10;
const CONNECTION_STRING = process.env.SERVICE_BUS_CONNECTION_STRING!;

interface ReportIngestedMessage {
  reportId: string;
  scoutId: string;
  mineralType?: string;    // scout-api app publishes 'mineralType' (camelCase)
  mineral_type?: string;   // USSD publishes 'mineral_type' (snake_case)
  source: 'app' | 'ussd';
  // latitude/longitude/photoUrls NOT in message — fetched from DB
}

class AIInferenceConsumer {
  private client: ServiceBusClient | null = null;
  private processingCount = 0;

  async start() {
    this.client = new ServiceBusClient(CONNECTION_STRING);
    const receiver = this.client.createReceiver('reports-ingested', 'ai-pipeline', {
      receiveMode: 'peekLock',
    });

    process.stdout.write(JSON.stringify({ level: 'info', service: 'ai-inference', ts: new Date().toISOString(), msg: 'AI inference consumer started' }) + '\n');

    receiver.subscribe({
      processMessage: async (message: ServiceBusReceivedMessage) => {
        while (this.processingCount >= MAX_CONCURRENT) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        this.processingCount++;

        try {
          await this.processReport(message.body as ReportIngestedMessage);
          await receiver.completeMessage(message);
        } catch (error) {
          process.stderr.write(JSON.stringify({ level: 'error', service: 'ai-inference', ts: new Date().toISOString(), msg: 'AI processing error', err: (error as Error).message }) + '\n');
          await receiver.abandonMessage(message);
        } finally {
          this.processingCount--;
        }
      },
      processError: async (error) => {
        process.stderr.write(JSON.stringify({ level: 'error', service: 'ai-inference', ts: new Date().toISOString(), msg: 'Consumer error', err: String(error.error) }) + '\n');
      },
    });
  }

  private async processReport(message: ReportIngestedMessage) {
    const { reportId } = message;

    process.stdout.write(JSON.stringify({ level: 'info', service: 'ai-inference', ts: new Date().toISOString(), msg: 'Processing report', reportId }) + '\n');
    const start = Date.now();

    // Fetch full report data — the SB message only has reportId/scoutId/mineralType
    const pool = db;
    const reportResult = await pool.query(
      `SELECT
         ST_Y(location::geometry) AS latitude,
         ST_X(location::geometry) AS lon,
         photo_uris,
         audio_uri,
         country
       FROM reports WHERE id = $1`,
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      process.stdout.write(JSON.stringify({ level: 'warn', service: 'ai-inference', ts: new Date().toISOString(), msg: 'Report not found — skipping AI pipeline', reportId }) + '\n');
      return;
    }

    const row = reportResult.rows[0];
    const latitude: number = parseFloat(row.latitude) || 0;
    const longitude: number = parseFloat(row.lon) || 0;
    const photoUrls: string[] = row.photo_uris || [];
    const voiceNoteUrl: string | undefined = row.audio_uri || undefined;

    try {
      const tasks: Promise<any>[] = [
        runMineralIdentification(reportId, photoUrls, latitude, longitude),
      ];

      if (voiceNoteUrl) {
        tasks.push(runVoiceTranscription(reportId, voiceNoteUrl, row.country));
      }

      const results = await Promise.allSettled(tasks);
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        const reasons = failures.map((r) => (r as PromiseRejectedResult).reason?.message ?? String((r as PromiseRejectedResult).reason));
        process.stdout.write(
          JSON.stringify({ level: 'error', service: 'ai-inference', ts: new Date().toISOString(), msg: 'AI pipeline subtask(s) failed', reportId, failures: reasons }) + '\n'
        );
        // If ALL tasks failed there is nothing useful to persist — rethrow so
        // the message is abandoned and redelivered rather than silently completed.
        if (failures.length === tasks.length) {
          throw new Error(`All AI tasks failed for report ${reportId}: ${reasons.join('; ')}`);
        }
      }

      trackEvent('report_ai_processed', {
        reportId,
        durationMs: (Date.now() - start).toString(),
        hasVoiceNote: voiceNoteUrl ? 'true' : 'false',
      });

    } catch (error) {
      process.stderr.write(JSON.stringify({ level: 'error', service: 'ai-inference', ts: new Date().toISOString(), msg: 'Failed to process report', reportId, err: (error as Error).message }) + '\n');
      await db.query('UPDATE reports SET updated_at = NOW() WHERE id = $1', [reportId]);
      throw error;
    }
  }

  async stop() {
    await this.client?.close();
  }
}

export const aiInferenceConsumer = new AIInferenceConsumer();

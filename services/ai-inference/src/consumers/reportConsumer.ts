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
  mineral_type: string;
  latitude: number;
  longitude: number;
  photoUrls: string[];
  voiceNoteUrl?: string;
  timestamp: string;
}

class AIInferenceConsumer {
  private client: ServiceBusClient | null = null;
  private processingCount = 0;

  async start() {
    this.client = new ServiceBusClient(CONNECTION_STRING);
    const receiver = this.client.createReceiver('reports-ingested', 'ai-pipeline', {
      receiveMode: 'peekLock',
    });

    console.log('AI inference consumer started');

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
          console.error('AI processing error:', error);
          await receiver.abandonMessage(message);
        } finally {
          this.processingCount--;
        }
      },
      processError: async (error) => {
        console.error('Consumer error:', error.error);
      },
    });
  }

  private async processReport(message: ReportIngestedMessage) {
    const { reportId, latitude, longitude, photoUrls, voiceNoteUrl } = message;

    console.log(`Processing report ${reportId}`);
    const start = Date.now();

    try {
      const tasks: Promise<any>[] = [
        runMineralIdentification(reportId, photoUrls, latitude, longitude),
      ];

      if (voiceNoteUrl) {
        tasks.push(runVoiceTranscription(reportId, voiceNoteUrl));
      }

      await Promise.allSettled(tasks);

      trackEvent('report_ai_processed', {
        reportId,
        durationMs: (Date.now() - start).toString(),
        hasVoiceNote: voiceNoteUrl ? 'true' : 'false',
      });

    } catch (error) {
      console.error(`Failed to process report ${reportId}:`, error);
      await db.query('UPDATE reports SET updated_at = NOW() WHERE id = $1', [reportId]);
      throw error;
    }
  }

  async stop() {
    await this.client?.close();
  }
}

export const aiInferenceConsumer = new AIInferenceConsumer();

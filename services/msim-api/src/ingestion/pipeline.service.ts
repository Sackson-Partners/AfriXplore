import { AzureOpenAI } from 'openai';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { ServiceBusClient } from '@azure/service-bus';
import { getPool } from '@ain/database';
import { downloadDocument, uploadDocument } from './storage.service.js';
import { extractTextFromUrl, extractText } from './ocr.service.js';
import { geocodeFirstMatch } from './geo.service.js';
import { retryWithBackoff } from '../utils/retry.js';
import type { ExtractedRecord, IngestionRequest, IngestionResult } from './types.js';

// ── Azure OpenAI client ──────────────────────────────────────────────────────

let openaiClient: AzureOpenAI | null = null;

function getOpenAIClient(): AzureOpenAI {
  if (openaiClient) return openaiClient;

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  if (!endpoint) throw new Error('AZURE_OPENAI_ENDPOINT not set');

  const apiKey = process.env.AZURE_OPENAI_KEY;

  if (apiKey) {
    openaiClient = new AzureOpenAI({ endpoint, apiKey, apiVersion: '2024-10-21' });
  } else {
    const credential = new DefaultAzureCredential();
    const azureADTokenProvider = getBearerTokenProvider(
      credential,
      'https://cognitiveservices.azure.com/.default',
    );
    openaiClient = new AzureOpenAI({ endpoint, azureADTokenProvider, apiVersion: '2024-10-21' });
  }

  return openaiClient;
}

// ── Cost tracking ─────────────────────────────────────────────────────────────

interface OpenAICostTracker {
  sessionTotalUsd: number;
  callCount: number;
}

const costTracker: OpenAICostTracker = {
  sessionTotalUsd: 0,
  callCount: 0,
};

// GPT-4 pricing (as of 2024)
const GPT4_INPUT_PRICE_PER_1K = 0.03;
const GPT4_OUTPUT_PRICE_PER_1K = 0.06;

function logOpenAICost(
  documentId: string,
  model: string,
  promptTokens: number,
  completionTokens: number
): void {
  const inputCost = (promptTokens / 1000) * GPT4_INPUT_PRICE_PER_1K;
  const outputCost = (completionTokens / 1000) * GPT4_OUTPUT_PRICE_PER_1K;
  const totalCost = inputCost + outputCost;

  costTracker.sessionTotalUsd += totalCost;
  costTracker.callCount += 1;

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'msim-api',
      event: 'openai_call',
      documentId,
      model,
      promptTokens,
      completionTokens,
      costUsd: totalCost.toFixed(4),
      sessionTotalUsd: costTracker.sessionTotalUsd.toFixed(4),
      sessionCallCount: costTracker.callCount,
    })
  );
}

// ── Structured extraction via GPT-4 ─────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are an expert historian specialising in colonial African mining records.
Extract structured data from the provided text and return a JSON object matching this schema exactly:
{
  "title": "string — concise title for this record",
  "recordDate": "YYYY-MM-DD string or null",
  "recordType": "production|survey|incident|inspection|administrative",
  "description": "string — 1-3 sentence summary",
  "quantityMt": "number (metric tonnes) or null",
  "notes": "string — additional context",
  "sourceReference": "string — bibliographic reference if found",
  "confidenceScore": "number 0-1",
  "extractions": [
    {
      "mineralRaw": "string — exact mineral text from document",
      "quantityMt": "number or null",
      "quantityRaw": "string — original quantity text",
      "purityPct": "number or null",
      "unit": "string — mt|kg|oz|carats|grade"
    }
  ],
  "locationHints": ["string — place names mentioned"]
}
Return only valid JSON. Do not include markdown fences.`;

async function extractStructuredData(text: string, documentId: string): Promise<ExtractedRecord> {
  const client = getOpenAIClient();
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o';

  // Get configurable character limit (default 12000)
  const maxChars = parseInt(process.env.OPENAI_MAX_DOCUMENT_CHARS ?? '12000', 10);
  const truncatedText = text.slice(0, maxChars);

  const estimatedInputTokens = Math.ceil(truncatedText.length / 4);
  console.log(
    `[OpenAI] Starting extraction for document ${documentId}, ` +
    `estimated input tokens: ${estimatedInputTokens}, model: ${deploymentName}`
  );

  // Wrap in retry logic
  const response = await retryWithBackoff(
    async () => {
      return await client.chat.completions.create({
        model: deploymentName,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Extract structured mining record data from this text:\n\n${truncatedText}`,
          },
        ],
        temperature: 0,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });
    },
    { maxRetries: 3, baseDelayMs: 1000 }
  );

  // Log actual usage and cost
  const usage = response.usage;
  if (usage) {
    logOpenAICost(
      documentId,
      deploymentName,
      usage.prompt_tokens,
      usage.completion_tokens
    );
  }

  const raw = response.choices[0]?.message?.content ?? '{}';
  return JSON.parse(raw) as ExtractedRecord;
}

// ── Mine lookup ───────────────────────────────────────────────────────────────

async function findClosestMine(locationHints: string[]): Promise<string | null> {
  if (locationHints.length === 0) return null;

  const pool = getPool();
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM historical_mines
     WHERE country ILIKE $1
        OR region  ILIKE $1
        OR name    ILIKE $1
     LIMIT 1`,
    [`%${locationHints[0]}%`],
  );

  return result.rows[0]?.id ?? null;
}

// ── Service Bus retry queue ──────────────────────────────────────────────────

interface RetryQueueItem {
  topic: string;
  message: any;
  attempts: number;
  lastError: string;
  timestamp: string;
}

const serviceBusRetryQueue: RetryQueueItem[] = [];
const MAX_RETRY_QUEUE_SIZE = 100;

// Process retry queue every 30 seconds
setInterval(async () => {
  if (serviceBusRetryQueue.length === 0) return;

  console.log(`[ServiceBus] Processing retry queue (${serviceBusRetryQueue.length} items)`);

  const item = serviceBusRetryQueue.shift();
  if (!item) return;

  try {
    await publishToServiceBus(item.topic, item.message);
    console.log(`[ServiceBus] Retry successful for topic ${item.topic}`);
  } catch (err) {
    item.attempts += 1;
    item.lastError = String(err);

    if (item.attempts < 3) {
      // Re-queue for another attempt
      serviceBusRetryQueue.push(item);
      console.log(`[ServiceBus] Retry failed (attempt ${item.attempts}/3), re-queued`);
    } else {
      // Max retries exceeded - log and drop
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'msim-api',
          event: 'servicebus_retry_exhausted',
          topic: item.topic,
          attempts: item.attempts,
          lastError: item.lastError,
          messageDropped: true,
        })
      );
    }
  }
}, 30000);

async function publishToServiceBus(topic: string, message: any): Promise<void> {
  const sbConn = process.env.SERVICE_BUS_CONNECTION_STRING;
  if (!sbConn) {
    console.warn('[ServiceBus] CONNECTION_STRING not set, skipping publish');
    return;
  }

  const sbClient = new ServiceBusClient(sbConn);
  const sender = sbClient.createSender(topic);

  try {
    await sender.sendMessages({
      body: message,
      contentType: 'application/json',
    });
  } finally {
    await sender.close();
    await sbClient.close();
  }
}

async function publishToServiceBusWithRetry(topic: string, message: any): Promise<void> {
  try {
    await publishToServiceBus(topic, message);
  } catch (err) {
    console.error(`[ServiceBus] Publish to ${topic} failed:`, String(err));

    // Add to retry queue
    if (serviceBusRetryQueue.length >= MAX_RETRY_QUEUE_SIZE) {
      const dropped = serviceBusRetryQueue.shift();
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'msim-api',
          event: 'servicebus_queue_overflow',
          droppedTopic: dropped?.topic,
          messageDropped: true,
        })
      );
    }

    serviceBusRetryQueue.push({
      topic,
      message,
      attempts: 1,
      lastError: String(err),
      timestamp: new Date().toISOString(),
    });

    console.log(`[ServiceBus] Message queued for retry (queue size: ${serviceBusRetryQueue.length})`);
  }
}

// ── Dead letter queue ─────────────────────────────────────────────────────────

async function sendToDeadLetterQueue(
  documentId: string,
  originalMessageId: string,
  failureReason: string,
  attemptCount: number,
  lastError: string
): Promise<void> {
  const message = {
    documentId,
    originalMessageId,
    failureReason,
    failureTimestamp: new Date().toISOString(),
    attemptCount,
    lastError,
  };

  await publishToServiceBusWithRetry('document-ingestion-deadletter', message);

  // Also update document status in database
  try {
    const pool = getPool();
    await pool.query(
      `UPDATE msim_documents SET status = 'failed', error_message = $1, updated_at = NOW()
       WHERE blob_name = $2`,
      [failureReason, documentId]
    );

    console.log(
      JSON.stringify({
        level: 'error',
        service: 'msim-api',
        event: 'document_ingestion_failed',
        documentId,
        failureReason,
        lastError,
      })
    );
  } catch (dbErr) {
    console.error(`[DeadLetter] Failed to update document status:`, String(dbErr));
  }
}

// ── Materialized view refresh with retry ──────────────────────────────────────

let mvRefreshScheduled = false;

async function refreshMaterializedView(): Promise<void> {
  if (mvRefreshScheduled) return;

  mvRefreshScheduled = true;

  // Delay refresh by 5 seconds to batch multiple updates
  setTimeout(async () => {
    const pool = getPool();
    const startTime = Date.now();

    try {
      console.log('[MV] Starting materialized view refresh...');

      // Set statement timeout to 30 seconds
      await pool.query('SET statement_timeout = 30000');

      const result = await pool.query('SELECT refresh_msim_search_mv()');

      // Get row count
      const countResult = await pool.query('SELECT COUNT(*) as count FROM msim_search_mv');
      const rowCount = countResult.rows[0]?.count || 0;

      const duration = Date.now() - startTime;

      console.log(
        `[MV] Materialized view refreshed successfully, rows: ${rowCount}, duration: ${duration}ms`
      );
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err as Error;

      if (duration >= 30000) {
        console.warn(
          `[MV] Refresh exceeded 30s timeout (${duration}ms), will complete in background`
        );
      } else {
        console.error(`[MV] Refresh failed after ${duration}ms:`, error.message);

        // Schedule retry in 5 minutes
        setTimeout(() => {
          mvRefreshScheduled = false;
          refreshMaterializedView();
        }, 5 * 60 * 1000);
      }
    } finally {
      mvRefreshScheduled = false;
    }
  }, 5000);
}

// ── DB insert ────────────────────────────────────────────────────────────────

async function persistRecord(
  extracted: ExtractedRecord,
  mineId: string,
  blobName: string,
  sourceRef: string,
): Promise<string> {
  const pool = getPool();

  const rec = await pool.query<{ id: string }>(
    `INSERT INTO msim_mining_records
       (mine_id, title, record_date, record_type, description, quantity_mt,
        notes, source_reference, document_url, confidence_score, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      mineId,
      extracted.title,
      extracted.recordDate ?? null,
      extracted.recordType,
      extracted.description,
      extracted.quantityMt ?? null,
      extracted.notes,
      extracted.sourceReference || sourceRef,
      blobName,
      extracted.confidenceScore,
      JSON.stringify({ ingested_from: blobName }),
    ],
  );

  const recordId = rec.rows[0].id;

  if (extracted.extractions?.length) {
    for (const ext of extracted.extractions) {
      await pool.query(
        `INSERT INTO msim_mineral_extractions
           (record_id, mineral_raw, mineral_name, quantity_mt, quantity_raw, purity_pct, unit)
         VALUES ($1,$2,$2,$3,$4,$5,$6)`,
        [
          recordId,
          ext.mineralRaw,
          ext.quantityMt ?? null,
          ext.quantityRaw,
          ext.purityPct ?? null,
          ext.unit ?? 'mt',
        ],
      );
    }
  }

  // Schedule materialized view refresh (batched)
  await refreshMaterializedView();

  // Publish event so convergence-engine recomputes the mine's score
  await publishToServiceBusWithRetry('archive-document-indexed', {
    record_id: recordId,
    mine_id: mineId,
    blob_name: blobName,
    timestamp: new Date().toISOString(),
  });

  return recordId;
}

// ── Public pipeline entry point ───────────────────────────────────────────────

/**
 * Run the full ingestion pipeline for a document already in blob storage.
 *
 * Steps:
 *   1. Download document from blob storage
 *   2. OCR via Azure Document Intelligence (with retry)
 *   3. Structured extraction via GPT-4 (with retry)
 *   4. Geocode location hints via Azure Maps (with retry)
 *   5. Persist record + extractions to DB
 *   6. Refresh msim_search_mv (batched)
 *   7. Publish to Service Bus (with retry queue)
 */
export async function ingestDocument(request: IngestionRequest): Promise<IngestionResult> {
  const errors: string[] = [];
  let extracted: ExtractedRecord | null = null;
  let mineId: string | null = null;
  let recordId: string | null = null;
  let geocoded = null;

  try {
    // Step 1: Download (with retry)
    const buffer = await retryWithBackoff(
      async () => await downloadDocument(request.blobName),
      { maxRetries: 3, baseDelayMs: 1000 }
    );

    // Step 2: OCR (with retry)
    const ocrResult = await retryWithBackoff(
      async () => await extractText(buffer),
      { maxRetries: 3, baseDelayMs: 2000 }
    );

    if (!ocrResult.fullText) {
      const reason = 'OCR produced no text';
      errors.push(reason);
      await sendToDeadLetterQueue(request.blobName, request.blobName, reason, 1, reason);
      return { blobName: request.blobName, mineId, recordId, extractedRecord: {} as ExtractedRecord, geocoded, status: 'failed', errors };
    }

    // Step 3: Structured extraction (with retry)
    extracted = await extractStructuredData(ocrResult.fullText, request.blobName);

    // Step 4: Geocode (with retry, non-fatal)
    if (extracted.locationHints?.length) {
      geocoded = await retryWithBackoff(
        async () => await geocodeFirstMatch(extracted!.locationHints!),
        { maxRetries: 2, baseDelayMs: 1000 }
      ).catch((err: unknown) => {
        errors.push(`Geocoding failed: ${String(err)}`);
        return null;
      });
    }

    // Step 5: Find mine + persist
    mineId = await findClosestMine(extracted.locationHints ?? []);
    if (!mineId) {
      const reason = 'No matching historical_mine found — record not persisted';
      errors.push(reason);
      return { blobName: request.blobName, mineId, recordId, extractedRecord: extracted, geocoded, status: 'partial', errors };
    }

    recordId = await persistRecord(extracted, mineId, request.blobName, request.sourceReference ?? '');
  } catch (err) {
    const errorMessage = String(err);
    errors.push(errorMessage);

    // Send to dead letter queue after retries exhausted
    await sendToDeadLetterQueue(
      request.blobName,
      request.blobName,
      'Ingestion pipeline failed after retries',
      3,
      errorMessage
    );

    return {
      blobName: request.blobName,
      mineId,
      recordId,
      extractedRecord: extracted ?? ({} as ExtractedRecord),
      geocoded,
      status: 'failed',
      errors,
    };
  }

  return {
    blobName: request.blobName,
    mineId,
    recordId,
    extractedRecord: extracted,
    geocoded,
    status: errors.length ? 'partial' : 'success',
    errors,
  };
}

/**
 * Upload a document buffer then run the full pipeline.
 */
export async function uploadAndIngest(
  blobName: string,
  data: Buffer,
  contentType: string,
  sourceReference?: string,
): Promise<IngestionResult> {
  await uploadDocument(blobName, data, contentType);
  return ingestDocument({ blobName, contentType, sourceReference });
}

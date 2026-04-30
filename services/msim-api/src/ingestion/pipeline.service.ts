import { AzureOpenAI } from 'openai';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { getPool } from '@ain/database';
import { downloadDocument, uploadDocument } from './storage.service.js';
import { extractTextFromUrl, extractText } from './ocr.service.js';
import { geocodeFirstMatch } from './geo.service.js';
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

async function extractStructuredData(text: string): Promise<ExtractedRecord> {
  const client = getOpenAIClient();
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o';

  const response = await client.chat.completions.create({
    model: deploymentName,
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Extract structured mining record data from this text:\n\n${text.slice(0, 12000)}`,
      },
    ],
    temperature: 0,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

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

  // Fire-and-forget search MV refresh
  pool.query('SELECT refresh_msim_search_mv()').catch(() => null);

  return recordId;
}

// ── Public pipeline entry point ───────────────────────────────────────────────

/**
 * Run the full ingestion pipeline for a document already in blob storage.
 *
 * Steps:
 *   1. Download document from blob storage
 *   2. OCR via Azure Document Intelligence
 *   3. Structured extraction via GPT-4
 *   4. Geocode location hints via Azure Maps
 *   5. Persist record + extractions to DB
 *   6. Refresh msim_search_mv
 */
export async function ingestDocument(request: IngestionRequest): Promise<IngestionResult> {
  const errors: string[] = [];
  let extracted: ExtractedRecord | null = null;
  let mineId: string | null = null;
  let recordId: string | null = null;
  let geocoded = null;

  try {
    // Step 1: Download
    const buffer = await downloadDocument(request.blobName);

    // Step 2: OCR
    const ocrResult = await extractText(buffer);
    if (!ocrResult.fullText) {
      errors.push('OCR produced no text');
      return { blobName: request.blobName, mineId, recordId, extractedRecord: {} as ExtractedRecord, geocoded, status: 'failed', errors };
    }

    // Step 3: Structured extraction
    extracted = await extractStructuredData(ocrResult.fullText);

    // Step 4: Geocode
    if (extracted.locationHints?.length) {
      geocoded = await geocodeFirstMatch(extracted.locationHints).catch((err: unknown) => {
        errors.push(`Geocoding failed: ${String(err)}`);
        return null;
      });
    }

    // Step 5: Find mine + persist
    mineId = await findClosestMine(extracted.locationHints ?? []);
    if (!mineId) {
      errors.push('No matching historical_mine found — record not persisted');
      return { blobName: request.blobName, mineId, recordId, extractedRecord: extracted, geocoded, status: 'partial', errors };
    }

    recordId = await persistRecord(extracted, mineId, request.blobName, request.sourceReference ?? '');
  } catch (err) {
    errors.push(String(err));
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

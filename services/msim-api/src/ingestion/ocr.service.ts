import { DocumentAnalysisClient, AzureKeyCredential, AnalyzeResult, AnalyzedDocument } from '@azure/ai-form-recognizer';
import { DefaultAzureCredential } from '@azure/identity';
import type { OcrResult } from './types.js';

let ocrClient: DocumentAnalysisClient | null = null;

function getOcrClient(): DocumentAnalysisClient {
  if (ocrClient) return ocrClient;

  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

  if (!endpoint) throw new Error('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT not set');

  ocrClient = key
    ? new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key))
    : new DocumentAnalysisClient(endpoint, new DefaultAzureCredential());

  return ocrClient;
}

function buildOcrResult(result: AnalyzeResult<AnalyzedDocument>): OcrResult {
  if (!result.pages || result.pages.length === 0) {
    return { fullText: '', confidence: 0, pageCount: 0 };
  }

  const pageTexts: string[] = [];
  let totalConfidence = 0;
  let wordCount = 0;

  for (const page of result.pages) {
    pageTexts.push((page.lines ?? []).map((l: { content: string }) => l.content).join('\n'));
    for (const word of page.words ?? []) {
      totalConfidence += word.confidence ?? 1;
      wordCount++;
    }
  }

  return {
    fullText: pageTexts.join('\n\n--- PAGE BREAK ---\n\n'),
    confidence: wordCount > 0 ? totalConfidence / wordCount : 1,
    pageCount: result.pages.length,
  };
}

/**
 * Extract text from a document buffer using Azure Document Intelligence.
 * Uses the prebuilt-read model for maximum text fidelity on historical scans.
 */
export async function extractText(data: Buffer): Promise<OcrResult> {
  const client = getOcrClient();
  const poller = await client.beginAnalyzeDocument('prebuilt-read', data);
  const result = await poller.pollUntilDone();
  return buildOcrResult(result);
}

/**
 * Extract text directly from a blob URL (avoids re-downloading the document).
 */
export async function extractTextFromUrl(blobUrl: string): Promise<OcrResult> {
  const client = getOcrClient();
  const poller = await client.beginAnalyzeDocumentFromUrl('prebuilt-read', blobUrl);
  const result = await poller.pollUntilDone();
  return buildOcrResult(result);
}

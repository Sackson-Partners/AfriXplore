/**
 * Types for the MSIM document ingestion pipeline.
 *
 * Flow: upload → OCR → GPT-4 structured extraction → geocode → DB insert
 */

export interface IngestionRequest {
  /** Blob name / path in the configured container */
  blobName: string;
  /** MIME type of the document (application/pdf, image/*, etc.) */
  contentType: string;
  /** Optional source reference string (e.g. "BCM Annual Report 1920") */
  sourceReference?: string;
  /** Optional uploader's subscriber ID for audit trail */
  uploadedBy?: string;
}

export interface OcrResult {
  /** Raw extracted text, all pages concatenated */
  fullText: string;
  /** Confidence 0–1 from Document Intelligence */
  confidence: number;
  /** Number of pages analysed */
  pageCount: number;
}

export interface GeocodedLocation {
  placeName: string;
  country: string;
  district?: string;
  latitude: number;
  longitude: number;
  /** Confidence 0–1 from Azure Maps */
  confidence: number;
}

export interface ExtractedRecord {
  /** Title / headline for the mining record */
  title: string;
  /** ISO date string or null */
  recordDate: string | null;
  recordType: 'production' | 'survey' | 'incident' | 'inspection' | 'administrative';
  description: string;
  /** Metric tonnes produced/surveyed — null if not a production record */
  quantityMt: number | null;
  notes: string;
  sourceReference: string;
  /** 0–1 GPT confidence the extraction is accurate */
  confidenceScore: number;
  /** Extracted minerals with raw text */
  extractions: Array<{
    mineralRaw: string;
    quantityMt: number | null;
    quantityRaw: string;
    purityPct: number | null;
    unit: string;
  }>;
  /** Location strings mentioned in the document */
  locationHints: string[];
}

export interface IngestionResult {
  blobName: string;
  mineId: string | null;
  recordId: string | null;
  extractedRecord: ExtractedRecord;
  geocoded: GeocodedLocation | null;
  status: 'success' | 'partial' | 'failed';
  errors: string[];
}

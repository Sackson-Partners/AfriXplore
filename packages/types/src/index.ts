/**
 * @ain/types — Shared TypeScript interfaces for the AIN MSIM platform.
 * All domain models are defined here and imported across services and apps.
 */

import type * as GeoJSON from 'geojson';

// ── Re-export GeoJSON for convenience ────────────────────────────────────────
export type { GeoJSON };

// ── Scout (future AIN Scout integration) ─────────────────────────────────────

/** Field scout who submits mineral reports via mobile or USSD */
export interface Scout {
  id: string;
  entraObjectId: string;
  fullName: string;
  phone: string | null;
  country: string;
  location: GeoJSON.Point | null;
  preferredLanguage: string;
  isActive: boolean;
  totalReports: number;
  totalEarningsUsd: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Subscriber ────────────────────────────────────────────────────────────────

/** Tier levels controlling data access and feature availability */
export type SubscriberTier = 'starter' | 'professional' | 'enterprise' | 'government_dfi';

/** B2B subscriber company with licensed territory access */
export interface Subscriber {
  id: string;
  companyName: string;
  entraObjectId: string;
  tier: SubscriberTier;
  licensedTerritories: GeoJSON.MultiPolygon | null;
  territoryNames: string[];
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  isActive: boolean;
  webhookUrl: string | null;
  dpiAlertThreshold: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Historical Mine ───────────────────────────────────────────────────────────

/** Digitisation workflow status for archive mine records */
export type DigitisationStatus = 'draft' | 'reviewed' | 'published';

/** A historical mine record digitised from archive sources */
export interface HistoricalMine {
  id: string;
  name: string;
  location: GeoJSON.Point;
  country: string;
  commodity: string[];
  hostRock: string | null;
  oreGrade: string | null;
  miningPeriod: string | null;
  closureReason: string | null;
  estimatedDepthM: number | null;
  productionStats: Record<string, unknown> | null;
  archiveSource: string | null;
  archiveDocumentUrl: string | null;
  digitisedBy: string | null;
  reviewedBy: string | null;
  digitisationStatus: DigitisationStatus;
  systemId: string | null;
  qualityScore: number | null;
  rawCoordinates: Record<string, unknown> | null;
  aiExtracted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Mineral System ────────────────────────────────────────────────────────────

/** Geological mineral system type classification */
export type MineralSystemType =
  | 'VMS'
  | 'IOCG'
  | 'Orogenic_Gold'
  | 'Pegmatite'
  | 'Porphyry'
  | 'Sediment_Hosted'
  | 'Layered_Intrusion'
  | 'Other';

/** A geological mineral system (e.g. Central African Copperbelt) */
export interface MineralSystem {
  id: string;
  name: string;
  type: MineralSystemType;
  country: string[];
  commodity: string[];
  heatSource: string | null;
  fluidPathway: string | null;
  trapMechanism: string | null;
  footprint: GeoJSON.Polygon | null;
  alterationTypes: string[];
  ageMa: number | null;
  prospectivityScore: number | null;
  geologicalCrossSectionUrl: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── MSIM Target ───────────────────────────────────────────────────────────────

/** Confidence classification for drill/staking targets */
export type TargetConfidence = 'A' | 'B' | 'C';

/** Licence acquisition status */
export type LicenceStatus = 'available' | 'pending' | 'licensed';

/** Target status in the publication workflow */
export type TargetStatus = 'draft' | 'published' | 'licensed';

/** A geologically-ranked drill or staking target derived from a mineral system */
export interface MsimTarget {
  id: string;
  systemId: string | null;
  location: GeoJSON.Point;
  licenceBlock: GeoJSON.Polygon | null;
  geologyRationale: string | null;
  riskRank: 1 | 2 | 3 | 4 | 5;
  recommendedTest: string | null;
  confidenceLevel: TargetConfidence;
  dominantMineral: string | null;
  estimatedGrade: string | null;
  estimatedTonnage: string | null;
  licenceStatus: LicenceStatus;
  priorityScore: number | null;
  technicalReportUrl: string | null;
  status: TargetStatus;
  assignedTo: string | null;
  aiGeneratedText: string | null;
  humanReviewedText: string | null;
  rankingModelVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── MSIM Document ─────────────────────────────────────────────────────────────

/** Document source classification */
export type DocumentType = 'survey' | 'company' | 'missionary' | 'government' | 'academic' | 'other';

/** AI extraction pipeline status */
export type ExtractionStatus = 'pending' | 'extracted' | 'reviewed' | 'failed';

/** An archive document (PDF/scan) attached to a historical mine */
export interface MsimDocument {
  id: string;
  mineId: string;
  documentType: DocumentType;
  title: string;
  sourceOrganisation: string | null;
  documentDate: Date | null;
  blobUrl: string;
  blobKey: string;
  extractedText: string | null;
  extractionStatus: ExtractionStatus;
  extractionConfidence: number | null;
  pageCount: number | null;
  fileSizeBytes: number | null;
  createdAt: Date;
}

// ── API Primitives ────────────────────────────────────────────────────────────

/**
 * RFC 7807 Problem Details error response.
 * All API errors use this format.
 */
export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string | null;
}

/** Generic cursor-based paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
  cursor: string | null;
}

/** GeoJSON FeatureCollection with AIN platform metadata */
export interface AinFeatureCollection<P = Record<string, unknown>> {
  type: 'FeatureCollection';
  bbox: [number, number, number, number];
  crs: {
    type: 'name';
    properties: { name: 'EPSG:4326' };
  };
  metadata: {
    generatedAt: string;
    recordCount: number;
    exportedBy: string;
    disclaimer: string;
  };
  features: GeoJSON.Feature<GeoJSON.Point | GeoJSON.Polygon, P>[];
}

/**
 * MSIM API client
 * Replaces mock-data.ts for production data fetching.
 * In dev mode (NEXT_PUBLIC_DEV_BYPASS_AUTH=true) no token is required.
 * In production, acquires an MSAL access token silently via useTokenSync hook
 * mounted in the platform layout. All exported functions pick up the token
 * automatically from the module-level store — no changes to call sites needed.
 */

import { useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from './msal-config';
import { canBypassAuth } from './featureFlags';

const BASE = process.env.NEXT_PUBLIC_MSIM_API_URL ?? 'http://localhost:3002';

// Module-level token store. Populated by useTokenSync() in the platform layout.
// Allows all exported API functions to attach auth headers without prop-drilling.
let _cachedToken: string | null = null;
let _tokenExpiresAt: number = 0;

export function setApiToken(token: string, expiresOn: Date) {
  _cachedToken = token;
  _tokenExpiresAt = expiresOn.getTime();
}

function getStoredToken(): string | null {
  if (_cachedToken && Date.now() < _tokenExpiresAt - 30_000) return _cachedToken;
  return null;
}

/**
 * Mount this hook once in the platform layout (already a 'use client' component).
 * It silently refreshes the MSAL token and writes it to the module-level store
 * so all exported API functions get an auth header automatically.
 */
export function useTokenSync() {
  const { instance, accounts } = useMsal();

  useEffect(() => {
    if (canBypassAuth() || accounts.length === 0) return;

    async function refresh() {
      try {
        const result = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });
        if (result?.accessToken && result.expiresOn) {
          setApiToken(result.accessToken, result.expiresOn);
        }
      } catch {
        // Silent refresh failed — trigger interactive login
        instance.acquireTokenRedirect({ ...loginRequest, account: accounts[0] });
      }
    }

    refresh();
    // Re-acquire 5 minutes before expiry
    const interval = setInterval(refresh, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, [instance, accounts]);
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── TYPE EXPORTS ──────────────────────────────────────────

export interface ApiMine {
  id: string;
  name: string;
  commodity: string;
  country: string;
  status: string;
  digitisation_status: string;
  dpi_score: number | null;
  confidence_grade: string | null;
  revival_score: number | null;
  host_rock: string | null;
  mining_period: string | null;
  closure_reason: string | null;
  estimated_depth_m: number | null;
  archive_source: string | null;
  system_id: string | null;
  created_at: string;
  updated_at: string;
  // from joins
  lng?: number;
  lat?: number;
}

export interface MineMapFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    commodity: string;
    country: string;
    status: string;
    dpi: number;
    confidenceGrade: string | null;
  };
}

export interface MineMapGeoJSON {
  type: 'FeatureCollection';
  features: MineMapFeature[];
}

export interface AnalyticsKPIs {
  mines_digitised: string | number;
  drill_targets: string | number;
  avg_dpi: string | number | null;
  countries: string | number;
  anomalies_active: string | number;
  documents_indexed: string | number;
}

export interface DiscoveryRatePoint {
  month: string;
  count: string | number;
}

export interface DPIBucket {
  range: string;
  count: string | number;
}

export interface CountryStat {
  country: string;
  mine_count: string | number;
  avg_dpi: string | number | null;
  high_potential: string | number;
  surveyed: string | number;
}

export interface ArchiveDocument {
  id: string;
  mine_id: string | null;
  title: string;
  document_type: string;
  country: string | null;
  year: number | null;
  language: string;
  author: string | null;
  confidence_score: number | null;
  status: string;
  page_count: number | null;
  tags: string[];
  created_at: string;
  mine_name?: string;
  mine_country?: string;
}

export interface DrillTarget {
  id: string;
  system_id: string | null;
  priority_score: number | null;
  status: string;
  geology_rationale: string | null;
  recommended_test: string | null;
  confidence_level: 'A' | 'B' | 'C';
  estimated_tonnage: string | null;
  created_at: string;
}

export interface DataRoomPackage {
  id: string;
  title: string;
  mine_id: string | null;
  status: string;
  nda_required: boolean;
  document_ids: string[];
  view_count: number;
  created_at: string;
  mine_name?: string;
  country?: string;
  commodity?: string;
}

export interface Deal {
  id: string;
  title: string;
  mine_id: string | null;
  stage: string;
  deal_type: string;
  value_usd: number | null;
  equity_percent: number | null;
  notes: Array<{ id: string; text: string; author: string; created_at: string }>;
  created_at: string;
  updated_at: string;
  mine_name?: string;
  country?: string;
  commodity?: string;
}

export interface RevivalJob {
  id: string;
  mine_id: string | null;
  document_id: string | null;
  status: string;
  priority: number;
  result_json: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  mine_name?: string;
  document_title?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ── MINES ──────────────────────────────────────────────────

export const getMines = (params: Record<string, string | number> = {}) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiFetch<{ data: ApiMine[]; pagination: { total: number; page: number; pageSize: number } }>(
    `/mines?${qs}`
  );
};

export const getMineMap = (bounds?: [number, number, number, number]) => {
  const qs = bounds ? `?bounds=${bounds.join(',')}` : '';
  return apiFetch<MineMapGeoJSON>(`/mines/map${qs}`);
};

export const getMine = (id: string) => apiFetch<ApiMine>(`/mines/${id}`);

// ── ANALYTICS ──────────────────────────────────────────────

export const getAnalyticsKPIs = () => apiFetch<AnalyticsKPIs>('/analytics/kpis');

export const getDiscoveryRate = () => apiFetch<DiscoveryRatePoint[]>('/analytics/discovery-rate');

export const getDPIDistribution = () => apiFetch<DPIBucket[]>('/analytics/dpi-distribution');

export const getCountryLeague = () => apiFetch<CountryStat[]>('/analytics/country-league');

export const getAnalyticsOverview = () =>
  apiFetch<{
    total_regions: string | number;
    total_companies: string | number;
    total_concessions: string | number;
    total_records: string | number;
    total_extractions: string | number;
    total_quantity_mt: string | number | null;
  }>('/analytics/overview');

// ── DRILL TARGETS ──────────────────────────────────────────

export const getDrillTargets = (params: Record<string, string | number> = {}) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiFetch<{ data: DrillTarget[]; total: number }>(`/targets?${qs}`);
};

// ── ARCHIVE DOCUMENTS (VAULT) ──────────────────────────────

export const getArchiveDocs = (params: Record<string, string | number> = {}) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiFetch<PaginatedResponse<ArchiveDocument>>(`/archive-docs?${qs}`);
};

export const getArchiveDoc = (id: string) => apiFetch<ArchiveDocument>(`/archive-docs/${id}`);

export const getDocumentDownloadUrl = (id: string) =>
  apiFetch<{ sas_url: string; expires_at: string }>(`/archive-docs/${id}/download`);

export const getArchiveDocStats = () =>
  apiFetch<{ total: string; indexed: string; pending: string; failed: string; countries: string }>(
    '/archive-docs/meta/stats'
  );

// ── DATA ROOM ──────────────────────────────────────────────

export const getDataRoomPackages = (params: Record<string, string | number> = {}) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiFetch<PaginatedResponse<DataRoomPackage>>(`/data-room?${qs}`);
};

export const getDataRoomPackage = (id: string) =>
  apiFetch<DataRoomPackage & { access_list: unknown[] }>(`/data-room/${id}`);

export const createDataRoomPackage = (body: {
  title: string;
  mine_id?: string;
  nda_required?: boolean;
  expires_at?: string;
}) =>
  apiFetch<DataRoomPackage>('/data-room', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const grantDataRoomAccess = (
  packageId: string,
  body: { grantee_email: string; org_id?: string; expires_at?: string }
) =>
  apiFetch(`/data-room/${packageId}/grant`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

// ── DEALS ──────────────────────────────────────────────────

export const getDeals = (params: Record<string, string | number> = {}) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiFetch<PaginatedResponse<Deal>>(`/deals?${qs}`);
};

export const getDeal = (id: string) => apiFetch<Deal>(`/deals/${id}`);

export const createDeal = (body: {
  title: string;
  mine_id?: string;
  deal_type?: string;
  value_usd?: number;
  equity_percent?: number;
}) =>
  apiFetch<Deal>('/deals', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const advanceDealStage = (id: string, stage: string) =>
  apiFetch<Deal>(`/deals/${id}/stage`, {
    method: 'PATCH',
    body: JSON.stringify({ stage }),
  });

export const addDealNote = (id: string, text: string) =>
  apiFetch<Deal>(`/deals/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });

// ── ARCHIVE REVIVAL ────────────────────────────────────────

export const getRevivalJobs = (params: Record<string, string | number> = {}) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiFetch<PaginatedResponse<RevivalJob>>(`/archive-revival/jobs?${qs}`);
};

export const getRevivalStats = () =>
  apiFetch<{ queued: string; processing: string; completed: string; failed: string; total: string }>(
    '/archive-revival/stats'
  );

export const triggerRevival = (body: { mine_id?: string; document_id?: string; priority?: number }) =>
  apiFetch<RevivalJob>('/archive-revival/trigger', {
    method: 'POST',
    body: JSON.stringify(body),
  });

// ── CONVERGENCE ENGINE ─────────────────────────────────────

const CONVERGENCE_BASE = process.env.NEXT_PUBLIC_CONVERGENCE_URL ?? 'http://localhost:3005';

async function convergenceFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${CONVERGENCE_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Convergence API error ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

export interface ScoreBreakdown {
  drone_score: number;
  archive_score: number;
  scout_score: number;
  geology_score: number;
}

export interface ConvergenceScore {
  mine_id: string;
  mine_name: string;
  convergence_score: number;
  breakdown: ScoreBreakdown;
  certified_target: boolean;
  scored_at: string;
}

export interface ConvergenceEvent {
  id: string;
  mine_id: string;
  mine_name: string;
  event_type: string;
  previous_score: number | null;
  new_score: number;
  triggered_by: string;
  created_at: string;
}

export const scoreMinе = (mineId: string) =>
  convergenceFetch<ConvergenceScore>(`/v1/score/${mineId}`, { method: 'POST' });

export const getConvergenceScores = (page = 1, pageSize = 20) =>
  convergenceFetch<PaginatedResponse<ConvergenceScore>>(`/v1/scores?page=${page}&page_size=${pageSize}`);

export const getConvergenceEvents = (page = 1, pageSize = 20) =>
  convergenceFetch<PaginatedResponse<ConvergenceEvent>>(`/v1/events?page=${page}&page_size=${pageSize}`);

// ── CONVERGENCE (MSIM-GEOSWARM INTEGRATION) ────────────────

export interface ScoreBreakdown {
  drone_score: number;
  archive_score: number;
  scout_score: number;
  geology_score: number;
}

export interface ConvergenceMineScore {
  mine_id: string;
  mine_name: string;
  convergence_score: number;
  breakdown: ScoreBreakdown;
  certified_target: boolean;
  scored_at: string;
}

export interface ConvergenceScoreListItem {
  mine_id: string;
  mine_name: string;
  geology_score: number;
  estimated_convergence_score: number;
  certified_target: boolean;
}

export interface ConvergenceEventItem {
  id: string;
  mine_id: string;
  mine_name: string;
  event_type: string;
  previous_score: number | null;
  new_score: number;
  triggered_by: string;
  created_at: string;
}

export interface ConvergenceStats {
  total_mines: number;
  certified_targets: number;
  high_potential_targets: number;
  average_score: number;
}

export const triggerConvergenceScore = (mineId: string) =>
  apiFetch<ConvergenceMineScore>(`/convergence/score/${mineId}`, { method: 'POST' });

export const getConvergenceScores = (page = 1, pageSize = 20) =>
  apiFetch<PaginatedResponse<ConvergenceScoreListItem>>(`/convergence/scores?page=${page}&page_size=${pageSize}`);

export const getConvergenceEventsHistory = (page = 1, pageSize = 20) =>
  apiFetch<PaginatedResponse<ConvergenceEventItem>>(`/convergence/events?page=${page}&page_size=${pageSize}`);

export const getConvergenceStats = () =>
  apiFetch<ConvergenceStats>('/convergence/stats');

export interface AnomalyCluster {
  id: string;
  latitude: number;
  longitude: number;
  radius_km?: number;
  report_count: number;
  scout_count: number;
  dpi_score: number;
  dominant_mineral: string;
  mineral_diversity: Record<string, number>;
  status: 'detected' | 'under_review' | 'field_dispatched' | 'confirmed' | 'negative' | 'inconclusive' | 'staking_initiated' | 'licensed';
  trend: 'growing' | 'stable' | 'declining';
  first_seen: string;
  last_updated: string;
  country?: string;
  district?: string;
}

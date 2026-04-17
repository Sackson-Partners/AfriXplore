// Scout types
export interface Scout {
  id: string;
  phone: string;
  full_name?: string;
  status: 'pending_kyc' | 'active' | 'suspended' | 'banned';
  country: string;
  district?: string;
  kyc_status: 'pending' | 'approved' | 'rejected' | 'expired';
  report_count: number;
  validated_report_count: number;
  quality_score: number;
  badge_level: string;
  total_earnings_usd: number;
  pending_earnings_usd: number;
  referral_code: string;
  created_at: string;
}

// Report types
export interface Report {
  id: string;
  scout_id: string;
  latitude: number;
  longitude: number;
  location_accuracy_m?: number;
  mineral_type: string;
  mineral_type_secondary?: string;
  working_type: WorkingType;
  depth_estimate_m?: number;
  volume_estimate?: 'small' | 'medium' | 'large';
  host_rock?: HostRock;
  alteration_colour?: string;
  photos: ReportPhoto[];
  voice_note_url?: string;
  status: ReportStatus;
  ai_confidence?: number;
  cluster_id?: string;
  created_at: string;
  updated_at: string;
}

export type ReportStatus = 'draft' | 'submitted' | 'under_review' | 'validated' | 'rewarded' | 'rejected';
export type WorkingType = 'alluvial_river' | 'open_pit' | 'shallow_shaft' | 'deep_shaft' | 'tunnel' | 'surface_pick';
export type HostRock = 'felsic' | 'mafic' | 'sedimentary' | 'mixed';

export interface ReportPhoto {
  url: string;
  caption?: string;
  blob_path: string;
}

// Anomaly cluster types
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
  status: AnomalyStatus;
  trend: 'growing' | 'stable' | 'declining';
  first_seen: string;
  last_updated: string;
  country?: string;
  district?: string;
}

export type AnomalyStatus = 'detected' | 'under_review' | 'field_dispatched' | 'confirmed' | 'negative' | 'inconclusive' | 'staking_initiated' | 'licensed';

// Subscriber types
export interface Subscriber {
  id: string;
  company_name: string;
  entra_object_id: string;
  tier: SubscriberTier;
  territory_names?: string[];
  subscription_start?: string;
  subscription_end?: string;
  is_active: boolean;
}

export type SubscriberTier = 'starter' | 'professional' | 'enterprise' | 'government_dfi';

// Payment types
export interface Payment {
  id: string;
  scout_id?: string;
  type: PaymentType;
  amount_usd: number;
  provider: PaymentProvider;
  status: PaymentStatus;
  initiated_at: string;
  completed_at?: string;
}

export type PaymentType = 'finder_fee' | 'subscription' | 'validated_anomaly' | 'bonus';
export type PaymentProvider = 'mpesa' | 'mtn_momo' | 'airtel_money' | 'flutterwave' | 'stripe' | 'manual';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  next_cursor: string | null;
}

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

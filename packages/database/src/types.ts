/** Raw PostgreSQL row for historical_mines table */
export interface DatabaseMine {
  id: string;
  name: string;
  commodity: string;
  status: string;
  digitisation_status: string;
  latitude: number | null;
  longitude: number | null;
  location_wkt: string | null;
  country: string;
  region: string | null;
  province: string | null;
  area_ha: number | null;
  production_start_year: number | null;
  production_end_year: number | null;
  estimated_resource_mt: number | null;
  notes: string | null;
  source_reference: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

/** Raw PostgreSQL row for mineral_systems table */
export interface DatabaseSystem {
  id: string;
  name: string;
  system_type: string;
  description: string | null;
  commodities: string[];
  geometry_wkt: string | null;
  country: string;
  area_km2: number | null;
  confidence_level: number | null;
  data_sources: string[] | null;
  is_published: boolean;
  created_at: Date;
  updated_at: Date;
}

/** Raw PostgreSQL row for msim_targets table */
export interface DatabaseTarget {
  id: string;
  mine_id: string | null;
  system_id: string | null;
  name: string;
  target_status: string;
  priority_score: number | null;
  latitude: number | null;
  longitude: number | null;
  location_wkt: string | null;
  geology_rationale: string | null;
  recommended_work: string | null;
  estimated_value_usd: number | null;
  assigned_geologist_id: string | null;
  due_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Raw PostgreSQL row for msim_documents table */
export interface DatabaseDocument {
  id: string;
  mine_id: string | null;
  system_id: string | null;
  target_id: string | null;
  filename: string;
  blob_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_at: Date;
  sas_url: string | null;
  sas_expires_at: Date | null;
}

/** Raw PostgreSQL row for subscribers table */
export interface DatabaseSubscriber {
  id: string;
  entra_oid: string;
  email: string;
  display_name: string | null;
  tier: string;
  is_active: boolean;
  licensed_territories: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

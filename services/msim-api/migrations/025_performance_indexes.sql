-- =====================================================================
-- Migration 025: Performance Indexes
-- Purpose: Add strategic indexes for query optimization across all tables
-- =====================================================================

-- ── BTREE INDEXES (Foreign Keys & Filters) ──────────────────────────

-- Subscribers
CREATE INDEX IF NOT EXISTS idx_subscribers_created_by
  ON msim_subscribers(created_by);

-- MSIM Targets
CREATE INDEX IF NOT EXISTS idx_msim_targets_assigned_geologist
  ON msim_targets(assigned_geologist_id);

CREATE INDEX IF NOT EXISTS idx_msim_targets_status_due_date
  ON msim_targets(target_status, due_date)
  WHERE due_date IS NOT NULL;

-- Scout Reports
CREATE INDEX IF NOT EXISTS idx_scout_reports_country_district
  ON scout_reports(country, district);

CREATE INDEX IF NOT EXISTS idx_scout_reports_validated_by
  ON scout_reports(validated_by);

CREATE INDEX IF NOT EXISTS idx_scout_reports_reward_paid
  ON scout_reports(reward_paid);

CREATE INDEX IF NOT EXISTS idx_scout_reports_confidence_score
  ON scout_reports(confidence_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_scout_reports_status_created
  ON scout_reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scout_reports_mine_status
  ON scout_reports(mine_id, status)
  WHERE mine_id IS NOT NULL;

-- Scouts
CREATE INDEX IF NOT EXISTS idx_scouts_district
  ON scouts(district);

CREATE INDEX IF NOT EXISTS idx_scouts_kyc_status
  ON scouts(kyc_status);

CREATE INDEX IF NOT EXISTS idx_scouts_badge_level
  ON scouts(badge_level);

CREATE INDEX IF NOT EXISTS idx_scouts_country_status
  ON scouts(country, status);

-- GeoSwarm Survey Orders
CREATE INDEX IF NOT EXISTS idx_geoswarm_survey_orders_delivery_date
  ON geoswarm_survey_orders(delivery_date);

-- GeoSwarm Missions
CREATE INDEX IF NOT EXISTS idx_geoswarm_missions_mission_date
  ON geoswarm_flight_missions(mission_date);

-- GeoSwarm Anomalies
CREATE INDEX IF NOT EXISTS idx_geoswarm_anomalies_type
  ON geoswarm_anomalies(anomaly_type);

-- Scout Cooperatives
CREATE INDEX IF NOT EXISTS idx_scout_cooperatives_leader
  ON scout_cooperatives(leader_id);

-- Scout Cooperative Members
CREATE INDEX IF NOT EXISTS idx_scout_cooperative_members_scout
  ON scout_cooperative_members(scout_id);

-- MSIM Mining Records (historical queries)
CREATE INDEX IF NOT EXISTS idx_msim_mining_records_mine_year
  ON msim_mining_records(mine_id, year_extracted DESC)
  WHERE year_extracted IS NOT NULL;

-- MSIM Concessions (company history)
CREATE INDEX IF NOT EXISTS idx_msim_concessions_company_year
  ON msim_concessions(company_id, granted_year)
  WHERE company_id IS NOT NULL;

-- ── GIN INDEXES (Array Columns) ─────────────────────────────────────

-- Scouts photo URIs
CREATE INDEX IF NOT EXISTS idx_scouts_photo_uris
  ON scouts USING gin(photo_uris);

-- Anomaly clusters mineral types
CREATE INDEX IF NOT EXISTS idx_anomaly_clusters_mineral_types
  ON anomaly_clusters USING gin(mineral_types);

-- ── GIST INDEXES (Additional Geospatial) ────────────────────────────

-- GeoSwarm anomalies polygon (for containment queries)
CREATE INDEX IF NOT EXISTS idx_geoswarm_anomalies_polygon
  ON geoswarm_anomalies USING gist(polygon)
  WHERE polygon IS NOT NULL;

-- Scout reports spatial + FK composite
CREATE INDEX IF NOT EXISTS idx_scout_reports_location_mine
  ON scout_reports USING gist(location)
  WHERE location IS NOT NULL AND mine_id IS NOT NULL;

-- ── PARTIAL INDEXES (Hot Paths) ─────────────────────────────────────

-- Active scout reports (review queue)
CREATE INDEX IF NOT EXISTS idx_scout_reports_pending
  ON scout_reports(created_at DESC)
  WHERE status IN ('pending', 'under_review');

-- Active anomaly investigations
CREATE INDEX IF NOT EXISTS idx_anomaly_clusters_active
  ON anomaly_clusters(priority DESC, created_at DESC)
  WHERE status IN ('open', 'investigating');

-- ── ANALYTICS & REPORTING ───────────────────────────────────────────

-- Time-series analytics on scout reports
CREATE INDEX IF NOT EXISTS idx_scout_reports_created_at
  ON scout_reports(created_at DESC);

-- Time-series analytics on convergence events
-- (already exists: idx_convergence_events_created_at)

COMMENT ON INDEX idx_subscribers_created_by IS
  'Optimize queries filtering mines by creator/subscriber';

COMMENT ON INDEX idx_msim_targets_status_due_date IS
  'Dashboard queries for active tasks sorted by deadline';

COMMENT ON INDEX idx_scout_reports_pending IS
  'Fast access to review queue (pending/under_review reports)';

COMMENT ON INDEX idx_anomaly_clusters_active IS
  'Prioritized active investigation queue';

COMMENT ON INDEX idx_geoswarm_anomalies_polygon IS
  'Spatial containment queries for anomaly polygons';

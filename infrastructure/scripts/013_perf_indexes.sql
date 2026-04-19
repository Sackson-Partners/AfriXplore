-- Performance indexes identified in Week 2 database audit

-- Partial index on field_geologists.is_available — used in geologist dispatch queries.
-- Without this, every anomaly alert triggers a full table scan to find available geologists.
CREATE INDEX IF NOT EXISTS idx_field_geologists_available
  ON field_geologists(is_available)
  WHERE is_available = TRUE;

-- Composite index on field_visits(cluster_id, scheduled_date) — supports common query
-- pattern: "all visits for cluster X scheduled after date Y".
CREATE INDEX IF NOT EXISTS idx_field_visits_cluster_scheduled
  ON field_visits(cluster_id, scheduled_date);

-- Composite index on payments(status, initiated_at) — supports dashboard queries
-- filtering pending/failed payments sorted by recency.
CREATE INDEX IF NOT EXISTS idx_payments_status_initiated
  ON payments(status, initiated_at DESC);

-- Index on targets.assigned_to — FK column lacks explicit index; supports queries
-- filtering targets by subscriber.
CREATE INDEX IF NOT EXISTS idx_targets_assigned_to
  ON targets(assigned_to);

-- Migration 017: Add cluster_key to anomaly_clusters for stable UPSERT.
--
-- cluster_key = "{country}:{dominant_mineral}:{lat_0.1deg}:{lon_0.1deg}"
-- 0.1 degrees ≈ 11 km — coarser than DBSCAN epsilon (5 km) so two adjacent
-- clusters of the same mineral still get distinct keys, while the same physical
-- cluster in consecutive runs resolves to the same key.

ALTER TABLE anomaly_clusters ADD COLUMN IF NOT EXISTS cluster_key TEXT;

-- Backfill existing rows so the UNIQUE constraint can be applied.
UPDATE anomaly_clusters
SET cluster_key = country
               || ':' || dominant_mineral
               || ':' || round(ST_Y(centroid::geometry)::numeric, 1)
               || ':' || round(ST_X(centroid::geometry)::numeric, 1)
WHERE cluster_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clusters_key ON anomaly_clusters(cluster_key);

-- AfriXplore Anomaly Clusters
-- Geospatial clusters of related mineral reports

CREATE TABLE IF NOT EXISTS anomaly_clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  centroid GEOGRAPHY(POINT, 4326) NOT NULL,
  bounding_box GEOGRAPHY(POLYGON, 4326),
  dominant_mineral TEXT NOT NULL,
  report_count INT DEFAULT 1,
  dpi_score NUMERIC(5,2),
  country TEXT NOT NULL,
  requires_dispatch BOOLEAN DEFAULT FALSE,
  dispatch_priority TEXT DEFAULT 'low' CHECK (dispatch_priority IN ('low','medium','high','critical')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','dispatched','verified','closed')),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clusters_centroid ON anomaly_clusters USING GIST(centroid);
CREATE INDEX IF NOT EXISTS idx_clusters_mineral ON anomaly_clusters(dominant_mineral);
CREATE INDEX IF NOT EXISTS idx_clusters_country ON anomaly_clusters(country);
CREATE INDEX IF NOT EXISTS idx_clusters_status ON anomaly_clusters(status);
CREATE INDEX IF NOT EXISTS idx_clusters_dpi ON anomaly_clusters(dpi_score DESC);
CREATE INDEX IF NOT EXISTS idx_clusters_updated ON anomaly_clusters(last_updated DESC);

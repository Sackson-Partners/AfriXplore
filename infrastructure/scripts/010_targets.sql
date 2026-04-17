-- AfriXplore Exploration Targets (Upgraded Anomaly Clusters)

CREATE TABLE targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Source cluster
  cluster_id UUID NOT NULL REFERENCES anomaly_clusters(id),

  -- Spatial
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  licence_block GEOGRAPHY(POLYGON, 4326),

  -- Classification
  target_type TEXT NOT NULL,  -- drill_target, scout_target, staking_target
  confidence_level TEXT,      -- A, B, C

  -- Geological
  dominant_mineral TEXT NOT NULL,
  estimated_grade TEXT,
  estimated_tonnage TEXT,

  -- Business
  licence_status TEXT DEFAULT 'available',
  acquisition_stage TEXT,
  assigned_to UUID REFERENCES subscribers(id),

  -- DPI
  dpi_score NUMERIC(5,2),

  -- Reports
  technical_report_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_targets_location ON targets USING GIST(location);
CREATE INDEX idx_targets_cluster ON targets(cluster_id);
CREATE INDEX idx_targets_mineral ON targets(dominant_mineral);
CREATE INDEX idx_targets_subscriber ON targets(assigned_to);

-- AfriXplore Field Geologist Visits

CREATE TABLE field_geologists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entra_object_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  specialisation TEXT[],
  current_location GEOGRAPHY(POINT, 4326),
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE field_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Assignment
  cluster_id UUID NOT NULL REFERENCES anomaly_clusters(id),
  geologist_id UUID NOT NULL REFERENCES field_geologists(id),
  dispatched_by UUID,

  -- Scheduling
  scheduled_date DATE,
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Location
  visit_location GEOGRAPHY(POINT, 4326),

  -- Outcome
  outcome field_visit_outcome,
  outcome_notes TEXT,

  -- Samples
  samples_collected INT DEFAULT 0,
  sample_lab_results JSONB DEFAULT '[]',

  -- Reports
  field_report_url TEXT,
  photos JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE anomaly_clusters ADD COLUMN assigned_geologist_id UUID REFERENCES field_geologists(id);

CREATE INDEX idx_field_visits_cluster ON field_visits(cluster_id);
CREATE INDEX idx_field_visits_geologist ON field_visits(geologist_id);
CREATE INDEX idx_field_visits_scheduled ON field_visits(scheduled_date);
CREATE INDEX idx_geologists_location ON field_geologists USING GIST(current_location);

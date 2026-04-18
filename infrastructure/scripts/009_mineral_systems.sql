-- AfriXplore Mineral Systems (Geological Context)

CREATE TABLE IF NOT EXISTS mineral_systems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- VMS, IOCG, Orogenic Gold, Pegmatite, etc.

  -- Spatial extent
  boundary GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL,

  -- Geological data
  age_ma NUMERIC,  -- Million years ago
  host_lithology TEXT[],
  structural_setting TEXT,

  -- Prospectivity
  prospectivity_score NUMERIC(5,2),
  known_deposits INT DEFAULT 0,

  -- Source
  data_source TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mineral_systems_boundary ON mineral_systems USING GIST(boundary);
CREATE INDEX IF NOT EXISTS idx_mineral_systems_type ON mineral_systems(type);

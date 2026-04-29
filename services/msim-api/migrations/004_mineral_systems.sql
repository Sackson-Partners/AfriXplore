CREATE TABLE mineral_systems (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  system_type      mineral_system_type NOT NULL,
  description      TEXT,
  commodities      TEXT[] NOT NULL DEFAULT '{}',
  -- PostGIS geography: polygon boundary of the mineral system
  boundary         GEOGRAPHY(POLYGON, 4326),
  country          TEXT NOT NULL,
  area_km2         NUMERIC(12, 2),
  confidence_level SMALLINT CHECK (confidence_level BETWEEN 1 AND 5),
  data_sources     TEXT[],
  is_published     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mineral_systems_type ON mineral_systems (system_type);
CREATE INDEX idx_mineral_systems_country ON mineral_systems (country);
CREATE INDEX idx_mineral_systems_published ON mineral_systems (is_published);
CREATE INDEX idx_mineral_systems_boundary ON mineral_systems USING GIST (boundary);

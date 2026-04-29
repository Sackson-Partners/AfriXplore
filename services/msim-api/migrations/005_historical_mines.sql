CREATE TABLE historical_mines (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                   TEXT NOT NULL,
  commodity              TEXT NOT NULL,
  status                 mine_status NOT NULL DEFAULT 'unknown',
  digitisation_status    digitisation_status NOT NULL DEFAULT 'raw',
  -- PostGIS geography: point location
  location               GEOGRAPHY(POINT, 4326),
  country                TEXT NOT NULL,
  region                 TEXT,
  province               TEXT,
  area_ha                NUMERIC(12, 2),
  production_start_year  SMALLINT CHECK (production_start_year BETWEEN 1000 AND 2100),
  production_end_year    SMALLINT CHECK (production_end_year BETWEEN 1000 AND 2100),
  estimated_resource_mt  NUMERIC(12, 4),
  notes                  TEXT,
  source_reference       TEXT,
  system_id              UUID REFERENCES mineral_systems (id) ON DELETE SET NULL,
  created_by             UUID REFERENCES subscribers (id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_historical_mines_commodity ON historical_mines (commodity);
CREATE INDEX idx_historical_mines_country ON historical_mines (country);
CREATE INDEX idx_historical_mines_status ON historical_mines (status);
CREATE INDEX idx_historical_mines_digitisation ON historical_mines (digitisation_status);
CREATE INDEX idx_historical_mines_system ON historical_mines (system_id);
CREATE INDEX idx_historical_mines_location ON historical_mines USING GIST (location);
-- Trigram index for full-text name search
CREATE INDEX idx_historical_mines_name_trgm ON historical_mines USING GIN (name gin_trgm_ops);

-- RLS: subscribers can only see mines within their licensed territories
ALTER TABLE historical_mines ENABLE ROW LEVEL SECURITY;

CREATE POLICY mines_territory_select ON historical_mines
  FOR SELECT
  USING (
    -- Admins (no RLS bypass needed — handled at API layer)
    -- Subscribers: mine location must be within their licensed territory
    EXISTS (
      SELECT 1 FROM subscribers s
      WHERE s.entra_oid = current_setting('app.current_user_oid', TRUE)
        AND s.is_active = TRUE
        AND (
          s.licensed_territories IS NULL -- free-tier: no territory restriction for basic data
          OR ST_Within(location::geometry, s.licensed_territories::geometry)
        )
    )
  );

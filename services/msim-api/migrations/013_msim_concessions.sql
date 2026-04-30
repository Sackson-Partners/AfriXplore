-- 013_msim_concessions.sql
-- Mining concessions granted during colonial era, linked to regions and companies.

CREATE TABLE msim_concessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  colonial_name    TEXT,
  region_id        UUID REFERENCES msim_regions(id)          ON DELETE SET NULL,
  company_id       UUID REFERENCES msim_mining_companies(id) ON DELETE SET NULL,
  country          TEXT NOT NULL,
  district         TEXT,
  granted_year     SMALLINT,
  revoked_year     SMALLINT,
  area_ha          NUMERIC(12, 2),
  geom             GEOMETRY(MULTIPOLYGON, 4326),
  minerals         TEXT[]  NOT NULL DEFAULT '{}',
  status           TEXT    NOT NULL DEFAULT 'historical'
                     CHECK (status IN ('active','historical','disputed','surrendered')),
  notes            TEXT,
  source_reference TEXT,
  search_vector    TSVECTOR,
  metadata         JSONB   NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_msim_concessions_region   ON msim_concessions(region_id);
CREATE INDEX idx_msim_concessions_company  ON msim_concessions(company_id);
CREATE INDEX idx_msim_concessions_country  ON msim_concessions(country);
CREATE INDEX idx_msim_concessions_status   ON msim_concessions(status);
CREATE INDEX idx_msim_concessions_minerals ON msim_concessions USING GIN(minerals);
CREATE INDEX idx_msim_concessions_geom     ON msim_concessions USING GIST(geom);
CREATE INDEX idx_msim_concessions_search   ON msim_concessions USING GIN(search_vector);

CREATE OR REPLACE FUNCTION msim_concessions_populate_search()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector =
    setweight(to_tsvector('english', coalesce(NEW.name, '')),          'A') ||
    setweight(to_tsvector('english', coalesce(NEW.colonial_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.country, '')),       'C') ||
    setweight(to_tsvector('english', coalesce(NEW.district, '')),      'C') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')),         'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_msim_concessions_search
  BEFORE INSERT OR UPDATE ON msim_concessions
  FOR EACH ROW EXECUTE FUNCTION msim_concessions_populate_search();

CREATE TRIGGER trg_msim_concessions_updated_at
  BEFORE UPDATE ON msim_concessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

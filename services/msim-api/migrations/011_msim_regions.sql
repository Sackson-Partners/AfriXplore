-- 011_msim_regions.sql
-- Creates update_updated_at_column() trigger function used by all subsequent tables.
-- Creates msim_regions: colonial/administrative mining regions with spatial + FTS support.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE msim_regions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  country       TEXT NOT NULL,
  colonial_name TEXT,
  modern_name   TEXT,
  description   TEXT,
  area_km2      NUMERIC(12, 2),
  geom          GEOMETRY(MULTIPOLYGON, 4326),
  search_vector TSVECTOR,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_msim_regions_country ON msim_regions(country);
CREATE INDEX idx_msim_regions_name    ON msim_regions(lower(name));
CREATE INDEX idx_msim_regions_geom    ON msim_regions USING GIST(geom);
CREATE INDEX idx_msim_regions_search  ON msim_regions USING GIN(search_vector);

CREATE OR REPLACE FUNCTION msim_regions_populate_search()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector =
    setweight(to_tsvector('english', coalesce(NEW.name, '')),          'A') ||
    setweight(to_tsvector('english', coalesce(NEW.colonial_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.modern_name, '')),   'B') ||
    setweight(to_tsvector('english', coalesce(NEW.country, '')),       'C') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')),   'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_msim_regions_search
  BEFORE INSERT OR UPDATE ON msim_regions
  FOR EACH ROW EXECUTE FUNCTION msim_regions_populate_search();

CREATE TRIGGER trg_msim_regions_updated_at
  BEFORE UPDATE ON msim_regions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 012_msim_companies.sql
-- Colonial and modern mining companies with FTS support.

CREATE TABLE msim_mining_companies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  colonial_name     TEXT,
  country_of_origin TEXT,
  founding_year     SMALLINT,
  dissolution_year  SMALLINT,
  description       TEXT,
  known_minerals    TEXT[]  NOT NULL DEFAULT '{}',
  active_regions    TEXT[]  NOT NULL DEFAULT '{}',
  search_vector     TSVECTOR,
  metadata          JSONB   NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_msim_companies_name     ON msim_mining_companies(lower(name));
CREATE INDEX idx_msim_companies_country  ON msim_mining_companies(country_of_origin);
CREATE INDEX idx_msim_companies_minerals ON msim_mining_companies USING GIN(known_minerals);
CREATE INDEX idx_msim_companies_search   ON msim_mining_companies USING GIN(search_vector);

CREATE OR REPLACE FUNCTION msim_companies_populate_search()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector =
    setweight(to_tsvector('english', coalesce(NEW.name, '')),              'A') ||
    setweight(to_tsvector('english', coalesce(NEW.colonial_name, '')),     'B') ||
    setweight(to_tsvector('english', coalesce(NEW.country_of_origin, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')),       'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_msim_companies_search
  BEFORE INSERT OR UPDATE ON msim_mining_companies
  FOR EACH ROW EXECUTE FUNCTION msim_companies_populate_search();

CREATE TRIGGER trg_msim_companies_updated_at
  BEFORE UPDATE ON msim_mining_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

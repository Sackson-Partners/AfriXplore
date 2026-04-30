-- 014_msim_records.sql
-- Individual mining activity records linked to historical_mines.
-- year_extracted is a generated column derived from record_date.
-- search_vector is weighted: title (A) > description (B) > notes (C) > source_reference (D).

CREATE TABLE msim_mining_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mine_id          UUID NOT NULL REFERENCES historical_mines(id) ON DELETE CASCADE,
  concession_id    UUID REFERENCES msim_concessions(id)          ON DELETE SET NULL,
  company_id       UUID REFERENCES msim_mining_companies(id)     ON DELETE SET NULL,
  title            TEXT NOT NULL,
  record_date      DATE,
  year_extracted   SMALLINT GENERATED ALWAYS AS (
                     EXTRACT(YEAR FROM record_date)::SMALLINT
                   ) STORED,
  record_type      TEXT NOT NULL DEFAULT 'production'
                     CHECK (record_type IN ('production','survey','incident','inspection','administrative')),
  description      TEXT,
  quantity_mt      NUMERIC(14, 4),
  notes            TEXT,
  source_reference TEXT,
  document_url     TEXT,
  confidence_score NUMERIC(3, 2) CHECK (confidence_score BETWEEN 0 AND 1),
  search_vector    TSVECTOR,
  metadata         JSONB   NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_msim_records_mine       ON msim_mining_records(mine_id);
CREATE INDEX idx_msim_records_concession ON msim_mining_records(concession_id);
CREATE INDEX idx_msim_records_company    ON msim_mining_records(company_id);
CREATE INDEX idx_msim_records_year       ON msim_mining_records(year_extracted);
CREATE INDEX idx_msim_records_type       ON msim_mining_records(record_type);
CREATE INDEX idx_msim_records_search     ON msim_mining_records USING GIN(search_vector);

CREATE OR REPLACE FUNCTION msim_records_populate_search()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector =
    setweight(to_tsvector('english', coalesce(NEW.title, '')),            'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')),      'B') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')),            'C') ||
    setweight(to_tsvector('english', coalesce(NEW.source_reference, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_msim_records_search
  BEFORE INSERT OR UPDATE ON msim_mining_records
  FOR EACH ROW EXECUTE FUNCTION msim_records_populate_search();

CREATE TRIGGER trg_msim_records_updated_at
  BEFORE UPDATE ON msim_mining_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

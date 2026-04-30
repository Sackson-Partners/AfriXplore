-- 015_msim_extractions.sql
-- Per-record mineral extraction quantities.
-- normalize_mineral_name() trigger converts chemical symbols and aliases to canonical names.

CREATE TABLE msim_mineral_extractions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id    UUID NOT NULL REFERENCES msim_mining_records(id) ON DELETE CASCADE,
  mineral_raw  TEXT NOT NULL,
  mineral_name TEXT NOT NULL,
  quantity_mt  NUMERIC(14, 4),
  quantity_raw TEXT,
  purity_pct   NUMERIC(5, 2),
  unit         TEXT NOT NULL DEFAULT 'mt',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_msim_extractions_record  ON msim_mineral_extractions(record_id);
CREATE INDEX idx_msim_extractions_mineral ON msim_mineral_extractions(mineral_name);

CREATE OR REPLACE FUNCTION normalize_mineral_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.mineral_name = LOWER(TRIM(NEW.mineral_raw));
  NEW.mineral_name = CASE NEW.mineral_name
    WHEN 'au'  THEN 'gold'
    WHEN 'ag'  THEN 'silver'
    WHEN 'cu'  THEN 'copper'
    WHEN 'pb'  THEN 'lead'
    WHEN 'zn'  THEN 'zinc'
    WHEN 'fe'  THEN 'iron'
    WHEN 'sn'  THEN 'tin'
    WHEN 'cr'  THEN 'chromium'
    WHEN 'co'  THEN 'cobalt'
    WHEN 'ni'  THEN 'nickel'
    WHEN 'mn'  THEN 'manganese'
    WHEN 'pt'  THEN 'platinum'
    WHEN 'pd'  THEN 'palladium'
    WHEN 'w'   THEN 'tungsten'
    WHEN 'u'   THEN 'uranium'
    WHEN 'al'  THEN 'aluminium'
    ELSE NEW.mineral_name
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_msim_extractions_normalize
  BEFORE INSERT OR UPDATE ON msim_mineral_extractions
  FOR EACH ROW EXECUTE FUNCTION normalize_mineral_name();

CREATE TRIGGER trg_msim_extractions_updated_at
  BEFORE UPDATE ON msim_mineral_extractions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

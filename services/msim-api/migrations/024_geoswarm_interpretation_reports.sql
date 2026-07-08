-- Geologist interpretation reports generated from anomaly analysis
CREATE TABLE geoswarm_interpretation_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES geoswarm_survey_orders(id) ON DELETE CASCADE,
  mine_id         UUID REFERENCES historical_mines(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  summary         TEXT,
  anomaly_ids     UUID[] NOT NULL DEFAULT '{}',
  recommendation  TEXT CHECK (recommendation IN ('drill','monitor','dismiss','resurvey')),
  confidence_pct  NUMERIC(5, 2) CHECK (confidence_pct BETWEEN 0 AND 100),
  interpreted_by  UUID REFERENCES subscribers(id) ON DELETE SET NULL,
  pdf_uri         TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','under_review','published','superseded')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geoswarm_interp_order ON geoswarm_interpretation_reports(order_id);
CREATE INDEX idx_geoswarm_interp_mine ON geoswarm_interpretation_reports(mine_id);
CREATE INDEX idx_geoswarm_interp_status ON geoswarm_interpretation_reports(status);

CREATE TRIGGER trg_geoswarm_interp_updated_at
  BEFORE UPDATE ON geoswarm_interpretation_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

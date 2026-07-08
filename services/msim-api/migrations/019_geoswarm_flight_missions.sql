-- Individual drone flight missions within a survey order
CREATE TABLE geoswarm_flight_missions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES geoswarm_survey_orders(id) ON DELETE CASCADE,
  mine_id         UUID REFERENCES historical_mines(id) ON DELETE SET NULL,
  mission_date    DATE,
  pilot_callsign  TEXT,
  altitude_m      NUMERIC(8, 1),
  speed_kmh       NUMERIC(6, 1),
  coverage_km2    NUMERIC(10, 2),
  flight_path     GEOGRAPHY(LINESTRING, 4326),
  status          TEXT NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned','in_progress','completed','aborted')),
  raw_data_uri    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geoswarm_missions_order ON geoswarm_flight_missions(order_id);
CREATE INDEX idx_geoswarm_missions_mine ON geoswarm_flight_missions(mine_id);
CREATE INDEX idx_geoswarm_missions_status ON geoswarm_flight_missions(status);
CREATE INDEX idx_geoswarm_missions_path ON geoswarm_flight_missions USING GIST(flight_path);

CREATE TRIGGER trg_geoswarm_missions_updated_at
  BEFORE UPDATE ON geoswarm_flight_missions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

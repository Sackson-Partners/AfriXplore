-- Geophysical anomalies detected from processed datasets
CREATE TABLE geoswarm_anomalies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id        UUID NOT NULL REFERENCES geoswarm_geophysical_datasets(id) ON DELETE CASCADE,
  mine_id           UUID REFERENCES historical_mines(id) ON DELETE SET NULL,
  anomaly_type      TEXT NOT NULL CHECK (anomaly_type IN ('magnetic_high','magnetic_low','radiometric_k','radiometric_th','radiometric_u','gravity_high','gravity_low')),
  confidence_pct    NUMERIC(5, 2) NOT NULL DEFAULT 50 CHECK (confidence_pct BETWEEN 0 AND 100),
  amplitude         NUMERIC(12, 4),
  wavelength_m      NUMERIC(10, 2),
  centroid          GEOGRAPHY(POINT, 4326),
  polygon           GEOGRAPHY(POLYGON, 4326),
  depth_est_m       NUMERIC(10, 2),
  interpreter_notes TEXT,
  status            TEXT NOT NULL DEFAULT 'detected'
                      CHECK (status IN ('detected','verified','dismissed','drill_recommended')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geoswarm_anomalies_dataset ON geoswarm_anomalies(dataset_id);
CREATE INDEX idx_geoswarm_anomalies_mine ON geoswarm_anomalies(mine_id);
CREATE INDEX idx_geoswarm_anomalies_status ON geoswarm_anomalies(status);
CREATE INDEX idx_geoswarm_anomalies_confidence ON geoswarm_anomalies(confidence_pct DESC);
CREATE INDEX idx_geoswarm_anomalies_centroid ON geoswarm_anomalies USING GIST(centroid);

CREATE TRIGGER trg_geoswarm_anomalies_updated_at
  BEFORE UPDATE ON geoswarm_anomalies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

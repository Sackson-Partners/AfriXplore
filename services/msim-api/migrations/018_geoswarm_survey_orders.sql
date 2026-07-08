-- GeoSwarm: client survey orders
CREATE TABLE geoswarm_survey_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id     UUID REFERENCES subscribers(id) ON DELETE SET NULL,
  area_km2          NUMERIC(12, 2) NOT NULL CHECK (area_km2 > 0),
  num_sensors       INTEGER NOT NULL DEFAULT 4 CHECK (num_sensors BETWEEN 1 AND 50),
  quoted_usd        NUMERIC(12, 2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'quoted'
                      CHECK (status IN ('quoted','confirmed','in_flight','processing','delivered','cancelled')),
  aoi_geojson       JSONB,
  notes             TEXT,
  delivery_date     DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geoswarm_orders_subscriber ON geoswarm_survey_orders(subscriber_id);
CREATE INDEX idx_geoswarm_orders_status ON geoswarm_survey_orders(status);

CREATE TRIGGER trg_geoswarm_orders_updated_at
  BEFORE UPDATE ON geoswarm_survey_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

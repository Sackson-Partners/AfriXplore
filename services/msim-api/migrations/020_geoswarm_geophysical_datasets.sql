-- Processed geophysical dataset from a mission (magnetics, radiometrics, etc.)
CREATE TABLE geoswarm_geophysical_datasets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id      UUID NOT NULL REFERENCES geoswarm_flight_missions(id) ON DELETE CASCADE,
  dataset_type    TEXT NOT NULL CHECK (dataset_type IN ('magnetics','radiometrics','gravity','multispectral','lidar')),
  grid_resolution_m NUMERIC(8, 2),
  processing_level  TEXT NOT NULL DEFAULT 'raw'
                      CHECK (processing_level IN ('raw','corrected','filtered','final')),
  blob_uri        TEXT NOT NULL,
  file_size_bytes BIGINT,
  crs             TEXT NOT NULL DEFAULT 'EPSG:4326',
  bbox            JSONB,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geoswarm_datasets_mission ON geoswarm_geophysical_datasets(mission_id);
CREATE INDEX idx_geoswarm_datasets_type ON geoswarm_geophysical_datasets(dataset_type);

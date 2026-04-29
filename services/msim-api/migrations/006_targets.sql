CREATE TABLE msim_targets (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mine_id                UUID REFERENCES historical_mines (id) ON DELETE SET NULL,
  system_id              UUID REFERENCES mineral_systems (id) ON DELETE SET NULL,
  name                   TEXT NOT NULL,
  target_status          target_status NOT NULL DEFAULT 'identified',
  priority_score         NUMERIC(4, 2) CHECK (priority_score BETWEEN 0 AND 10),
  location               GEOGRAPHY(POINT, 4326),
  geology_rationale      TEXT,
  recommended_work       TEXT,
  estimated_value_usd    NUMERIC(18, 2),
  assigned_geologist_id  UUID REFERENCES subscribers (id) ON DELETE SET NULL,
  due_date               DATE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_msim_targets_status ON msim_targets (target_status);
CREATE INDEX idx_msim_targets_mine ON msim_targets (mine_id);
CREATE INDEX idx_msim_targets_system ON msim_targets (system_id);
CREATE INDEX idx_msim_targets_priority ON msim_targets (priority_score DESC);
CREATE INDEX idx_msim_targets_location ON msim_targets USING GIST (location);

-- RLS: only pro+ subscribers can access targets
ALTER TABLE msim_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY targets_pro_select ON msim_targets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM subscribers s
      WHERE s.entra_oid = current_setting('app.current_user_oid', TRUE)
        AND s.is_active = TRUE
        AND s.tier IN ('pro', 'enterprise')
    )
  );

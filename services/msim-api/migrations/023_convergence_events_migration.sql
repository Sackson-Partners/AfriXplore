-- Formal migration for convergence_events (auto-created by convergence-engine at startup,
-- this makes it part of the tracked migration history).
CREATE TABLE IF NOT EXISTS convergence_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mine_id         UUID NOT NULL,
  event_type      TEXT NOT NULL DEFAULT 'score_computed',
  previous_score  FLOAT,
  new_score       FLOAT NOT NULL,
  triggered_by    TEXT NOT NULL DEFAULT 'manual',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add mine_id FK if not already present (safe to run if table pre-exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'convergence_events_mine_id_fkey'
  ) THEN
    ALTER TABLE convergence_events
      ADD CONSTRAINT convergence_events_mine_id_fkey
      FOREIGN KEY (mine_id) REFERENCES historical_mines(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_convergence_events_mine ON convergence_events(mine_id);
CREATE INDEX IF NOT EXISTS idx_convergence_events_created ON convergence_events(created_at DESC);

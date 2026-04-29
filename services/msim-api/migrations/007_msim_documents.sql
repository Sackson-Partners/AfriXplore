CREATE TABLE msim_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mine_id         UUID REFERENCES historical_mines (id) ON DELETE CASCADE,
  system_id       UUID REFERENCES mineral_systems (id) ON DELETE CASCADE,
  target_id       UUID REFERENCES msim_targets (id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  blob_name       TEXT NOT NULL UNIQUE,
  content_type    TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL,
  uploaded_by     UUID NOT NULL REFERENCES subscribers (id) ON DELETE RESTRICT,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- SAS URL cache (regenerated on demand, expires in 1h)
  sas_url         TEXT,
  sas_expires_at  TIMESTAMPTZ,
  -- Ensure at least one parent is set
  CONSTRAINT documents_has_parent CHECK (
    mine_id IS NOT NULL OR system_id IS NOT NULL OR target_id IS NOT NULL
  )
);

CREATE INDEX idx_msim_documents_mine ON msim_documents (mine_id);
CREATE INDEX idx_msim_documents_system ON msim_documents (system_id);
CREATE INDEX idx_msim_documents_target ON msim_documents (target_id);
CREATE INDEX idx_msim_documents_uploaded_by ON msim_documents (uploaded_by);

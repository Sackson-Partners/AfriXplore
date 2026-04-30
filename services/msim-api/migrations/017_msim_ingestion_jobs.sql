-- 017_msim_ingestion_jobs.sql
-- Tracks document ingestion pipeline runs independently from msim_documents,
-- since msim_documents requires a parent (mine/system/target) which may be unknown
-- until after the pipeline completes extraction.

CREATE TABLE msim_ingestion_jobs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blob_name            TEXT NOT NULL,
  content_type         TEXT NOT NULL DEFAULT 'application/pdf',
  source_reference     TEXT,
  processing_status    TEXT NOT NULL DEFAULT 'pending'
                         CHECK (processing_status IN ('pending','processing','completed','failed','partial')),
  extracted_record_id  UUID REFERENCES msim_mining_records(id) ON DELETE SET NULL,
  processing_errors    JSONB NOT NULL DEFAULT '[]',
  submitted_by         UUID REFERENCES subscribers(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_msim_ingestion_status ON msim_ingestion_jobs(processing_status);
CREATE INDEX idx_msim_ingestion_blob   ON msim_ingestion_jobs(blob_name);

CREATE TRIGGER trg_msim_ingestion_updated_at
  BEFORE UPDATE ON msim_ingestion_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

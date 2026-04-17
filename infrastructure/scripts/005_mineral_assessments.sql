-- AfriXplore Mineral AI Assessments

CREATE TABLE mineral_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,

  -- AI Results
  model_version TEXT NOT NULL,
  confidence NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),

  -- Predictions
  primary_mineral TEXT NOT NULL,
  predictions JSONB NOT NULL DEFAULT '[]',
  -- [{mineral, confidence, evidence}]

  -- Image analysis
  image_features JSONB DEFAULT '{}',
  geological_context JSONB DEFAULT '{}',

  -- Processing metadata
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  processing_duration_ms INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assessments_report ON mineral_assessments(report_id);
CREATE INDEX idx_assessments_mineral ON mineral_assessments(primary_mineral);
CREATE INDEX idx_assessments_confidence ON mineral_assessments(confidence DESC);
CREATE INDEX idx_assessments_predictions ON mineral_assessments USING GIN(predictions jsonb_path_ops);

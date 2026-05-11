-- Migration 018: Wave C — product completeness additions

-- C1: FCM push token storage on scouts
ALTER TABLE scouts ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- C4: KYC document blob path
ALTER TABLE scouts ADD COLUMN IF NOT EXISTS kyc_document_url TEXT;
ALTER TABLE scouts ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ;

-- C5: Seed mineral_prices with 2024 reference prices (price per tonne USD)
INSERT INTO mineral_prices (mineral_type, price_usd_per_tonne, updated_at)
VALUES
  ('gold',      73000000, NOW()),  -- ~$2,300/troy oz × 32,150 oz/tonne
  ('copper',        9000, NOW()),
  ('cobalt',       30000, NOW()),
  ('lithium',      15000, NOW()),  -- lithium carbonate
  ('coltan',       30000, NOW()),  -- columbite-tantalite
  ('tin',          28000, NOW()),
  ('chrome',         200, NOW()),  -- chromite ore
  ('graphite',       800, NOW()),
  ('nickel',       17000, NOW()),
  ('manganese',      300, NOW()),
  ('uranium',     130000, NOW()),  -- U3O8 yellowcake equivalent
  ('other',         1000, NOW())
ON CONFLICT (mineral_type) DO UPDATE
  SET price_usd_per_tonne = EXCLUDED.price_usd_per_tonne,
      updated_at = NOW();

-- C7: Reward rules table (DB-configurable finder fee per mineral)
CREATE TABLE IF NOT EXISTS reward_rules (
  mineral_type    TEXT PRIMARY KEY,
  finder_fee_usd  NUMERIC(10,4) NOT NULL DEFAULT 2.50,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO reward_rules (mineral_type, finder_fee_usd) VALUES
  ('default',    2.50),
  ('gold',       5.00),
  ('lithium',    4.00),
  ('cobalt',     4.00),
  ('coltan',     4.00),
  ('copper',     3.00),
  ('nickel',     3.00),
  ('tin',        2.50),
  ('chrome',     2.50),
  ('graphite',   2.00),
  ('manganese',  2.00),
  ('uranium',    0.00),
  ('other',      2.50)
ON CONFLICT (mineral_type) DO NOTHING;

-- C9: DB-backed USSD sessions (replaces in-memory Map)
CREATE TABLE IF NOT EXISTS ussd_sessions (
  session_id     TEXT PRIMARY KEY,
  phone_number   TEXT NOT NULL,
  language       TEXT NOT NULL DEFAULT 'en',
  scout_id       UUID REFERENCES scouts(id),
  mineral_type   TEXT,
  working_type   TEXT,
  depth_estimate TEXT,
  volume_estimate TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ussd_sessions_created ON ussd_sessions(created_at);

-- Auto-expire USSD sessions older than 10 minutes via a cleanup function.
-- Called by the USSD route after each successful submission.
CREATE OR REPLACE FUNCTION cleanup_ussd_sessions() RETURNS void
LANGUAGE sql AS $$
  DELETE FROM ussd_sessions WHERE created_at < NOW() - INTERVAL '10 minutes';
$$;

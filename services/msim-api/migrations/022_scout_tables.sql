-- Scout program tables (field data collection crowdsourcing)

CREATE TABLE scouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id   UUID REFERENCES subscribers(id) ON DELETE SET NULL,
  phone           TEXT NOT NULL UNIQUE,
  full_name       TEXT,
  country         TEXT NOT NULL,
  district        TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en'
                    CHECK (preferred_language IN ('en','fr','sw','pt','ha','am')),
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','suspended','pending_kyc','banned')),
  badge_level     TEXT NOT NULL DEFAULT 'bronze'
                    CHECK (badge_level IN ('bronze','silver','gold','platinum')),
  quality_score   NUMERIC(5, 2) NOT NULL DEFAULT 50 CHECK (quality_score BETWEEN 0 AND 100),
  report_count    INTEGER NOT NULL DEFAULT 0,
  validated_report_count INTEGER NOT NULL DEFAULT 0,
  total_earnings_usd     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pending_earnings_usd   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  wallet_provider TEXT CHECK (wallet_provider IN ('mpesa','mtn_momo','airtel_money','flutterwave')),
  wallet_mobile_money TEXT,
  kyc_status      TEXT NOT NULL DEFAULT 'not_started'
                    CHECK (kyc_status IN ('not_started','submitted','approved','rejected')),
  referral_code   TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE scout_cooperatives (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  country     TEXT NOT NULL,
  district    TEXT,
  leader_id   UUID REFERENCES scouts(id) ON DELETE SET NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE scout_cooperative_members (
  cooperative_id UUID NOT NULL REFERENCES scout_cooperatives(id) ON DELETE CASCADE,
  scout_id       UUID NOT NULL REFERENCES scouts(id) ON DELETE CASCADE,
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cooperative_id, scout_id)
);

CREATE TABLE scout_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_id        UUID NOT NULL REFERENCES scouts(id) ON DELETE CASCADE,
  mine_id         UUID REFERENCES historical_mines(id) ON DELETE SET NULL,
  location        GEOGRAPHY(POINT, 4326) NOT NULL,
  country         TEXT NOT NULL,
  district        TEXT,
  mineral_type    TEXT NOT NULL,
  working_type    TEXT CHECK (working_type IN ('alluvial','open_pit','shallow_shaft','deep_shaft','tunnel','surface_pick','unknown')),
  depth_estimate_m NUMERIC(8, 2),
  volume_estimate TEXT,
  photo_uris      TEXT[] NOT NULL DEFAULT '{}',
  audio_uri       TEXT,
  notes           TEXT,
  confidence_score NUMERIC(5, 2),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','under_review','validated','rejected','escalated')),
  validated_by    UUID REFERENCES subscribers(id) ON DELETE SET NULL,
  validated_at    TIMESTAMPTZ,
  reward_usd      NUMERIC(10, 2),
  reward_paid     BOOLEAN NOT NULL DEFAULT false,
  source          TEXT NOT NULL DEFAULT 'app'
                    CHECK (source IN ('app','ussd','whatsapp','sms')),
  device_id       TEXT,
  sync_status     TEXT NOT NULL DEFAULT 'synced'
                    CHECK (sync_status IN ('pending','synced','conflict')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE anomaly_clusters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mine_id         UUID REFERENCES historical_mines(id) ON DELETE SET NULL,
  centroid        GEOGRAPHY(POINT, 4326) NOT NULL,
  radius_m        NUMERIC(10, 2),
  report_count    INTEGER NOT NULL DEFAULT 0,
  mineral_types   TEXT[] NOT NULL DEFAULT '{}',
  confidence_score NUMERIC(5, 2),
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','investigating','confirmed','dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scouts_country ON scouts(country);
CREATE INDEX idx_scouts_status ON scouts(status);
CREATE INDEX idx_scout_reports_scout ON scout_reports(scout_id);
CREATE INDEX idx_scout_reports_mine ON scout_reports(mine_id);
CREATE INDEX idx_scout_reports_status ON scout_reports(status);
CREATE INDEX idx_scout_reports_mineral ON scout_reports(mineral_type);
CREATE INDEX idx_scout_reports_location ON scout_reports USING GIST(location);
CREATE INDEX idx_anomaly_clusters_mine ON anomaly_clusters(mine_id);
CREATE INDEX idx_anomaly_clusters_centroid ON anomaly_clusters USING GIST(centroid);

CREATE TRIGGER trg_scouts_updated_at
  BEFORE UPDATE ON scouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_scout_reports_updated_at
  BEFORE UPDATE ON scout_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_anomaly_clusters_updated_at
  BEFORE UPDATE ON anomaly_clusters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE subscribers (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entra_oid                TEXT NOT NULL UNIQUE,
  email                    TEXT NOT NULL UNIQUE,
  display_name             TEXT,
  tier                     subscriber_tier NOT NULL DEFAULT 'free',
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  -- PostGIS geography: MultiPolygon of licensed territory
  licensed_territories     GEOGRAPHY(MULTIPOLYGON, 4326),
  stripe_customer_id       TEXT,
  stripe_subscription_id   TEXT,
  subscription_ends_at     TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: subscribers can only see their own row
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscribers_self_select ON subscribers
  FOR SELECT
  USING (entra_oid = current_setting('app.current_user_oid', TRUE));

CREATE POLICY subscribers_self_update ON subscribers
  FOR UPDATE
  USING (entra_oid = current_setting('app.current_user_oid', TRUE));

-- Admin bypass function (called by API layer before setting app.current_user_oid)
-- In practice, admins use a separate DB role or the API bypasses RLS by checking the
-- token's roles claim before running the query. This migration documents the intent.

-- Grant the app DB user (ain_app) usage on relevant types
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ain_app') THEN
    CREATE ROLE ain_app LOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO ain_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ain_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ain_app;

-- Allow ain_app to set the session variable for RLS
GRANT SET ON PARAMETER "app.current_user_oid" TO ain_app;

-- AfriXplore Shared Enum Types
-- Used by field_visits (007), payments (012), and other tables

DO $$ BEGIN
  CREATE TYPE field_visit_outcome AS ENUM (
    'confirmed_deposit',
    'trace_minerals',
    'false_positive',
    'inconclusive',
    'access_denied'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_type AS ENUM (
    'scout_reward',
    'field_bonus',
    'referral',
    'subscription',
    'refund'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_provider AS ENUM (
    'stripe',
    'mpesa',
    'mtn_momo',
    'orange_money',
    'airtel_money',
    'bank_transfer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

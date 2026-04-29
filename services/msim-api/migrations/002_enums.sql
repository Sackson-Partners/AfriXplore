CREATE TYPE digitisation_status AS ENUM (
  'raw',
  'digitised',
  'verified',
  'published'
);

CREATE TYPE mine_status AS ENUM (
  'active',
  'inactive',
  'abandoned',
  'reclaimed',
  'unknown'
);

CREATE TYPE mineral_system_type AS ENUM (
  'orogenic_gold',
  'porphyry_copper',
  'sediment_hosted_copper',
  'iron_oxide_copper_gold',
  'greenstone_belt',
  'kimberlite',
  'pegmatite',
  'vms',
  'other'
);

CREATE TYPE target_status AS ENUM (
  'identified',
  'under_review',
  'approved',
  'in_progress',
  'completed',
  'rejected'
);

CREATE TYPE subscriber_tier AS ENUM (
  'free',
  'starter',
  'pro',
  'enterprise'
);

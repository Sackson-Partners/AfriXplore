-- AfriXplore Core Tables (Foundation)
-- Scouts, subscribers, reports, territories

CREATE TABLE IF NOT EXISTS scouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entra_object_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  country TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  preferred_language TEXT DEFAULT 'en',
  is_active BOOLEAN DEFAULT TRUE,
  total_reports INT DEFAULT 0,
  total_earnings_usd NUMERIC(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scouts_country ON scouts(country);
CREATE INDEX IF NOT EXISTS idx_scouts_location ON scouts USING GIST(location);

CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entra_object_id TEXT UNIQUE,
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('starter','professional','enterprise')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  licensed_territories GEOGRAPHY(MULTIPOLYGON, 4326),
  territory_names TEXT[],
  trial_ends_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscribers_tier ON subscribers(tier);
CREATE INDEX IF NOT EXISTS idx_subscribers_territories ON subscribers USING GIST(licensed_territories);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scout_id UUID NOT NULL REFERENCES scouts(id) ON DELETE CASCADE,
  mineral_type TEXT NOT NULL,
  working_method TEXT NOT NULL,
  estimated_depth_m NUMERIC(8,2),
  estimated_volume_m3 NUMERIC(12,4),
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  country TEXT NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  raw_images_blob_path TEXT,
  notes TEXT,
  source TEXT DEFAULT 'mobile',
  submitted_via TEXT DEFAULT 'app',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','processed','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_scout ON reports(scout_id);
CREATE INDEX IF NOT EXISTS idx_reports_mineral ON reports(mineral_type);
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_reports_country ON reports(country);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

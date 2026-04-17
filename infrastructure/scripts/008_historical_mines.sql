-- AfriXplore Historical Mines Reference Data

CREATE TABLE historical_mines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  name TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT,
  district TEXT,

  location GEOGRAPHY(POINT, 4326) NOT NULL,
  boundary GEOGRAPHY(POLYGON, 4326),

  -- Mineralogy
  primary_commodity TEXT,
  secondary_commodities TEXT[],
  ore_grade TEXT,

  -- History
  operation_start_year INT,
  operation_end_year INT,
  is_active BOOLEAN DEFAULT FALSE,

  -- Source
  data_source TEXT,
  source_url TEXT,

  -- Enrichment
  estimated_reserves_tonnes NUMERIC,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_historical_mines_location ON historical_mines USING GIST(location);
CREATE INDEX idx_historical_mines_country ON historical_mines(country);
CREATE INDEX idx_historical_mines_commodity ON historical_mines(primary_commodity);
CREATE INDEX idx_historical_mines_name_fts ON historical_mines
  USING GIN(to_tsvector('english', name || ' ' || COALESCE(country, '')));

-- Create table for cached match data
CREATE TABLE IF NOT EXISTS cached_matches (
  id SERIAL PRIMARY KEY,
  match_id TEXT UNIQUE NOT NULL,
  region TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for processed stats
CREATE TABLE IF NOT EXISTS processed_stats (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL, -- 'compositions', 'units', 'traits', 'items'
  region TEXT NOT NULL,
  data JSONB NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for region status
CREATE TABLE IF NOT EXISTS region_status (
  region TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_count INTEGER DEFAULT 0,
  last_error TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cached_matches_region ON cached_matches(region);
CREATE INDEX IF NOT EXISTS idx_processed_stats_type_region ON processed_stats(type, region);
CREATE INDEX IF NOT EXISTS idx_processed_stats_last_updated ON processed_stats(last_updated DESC);

-- Insert sample data for all regions
INSERT INTO processed_stats (type, region, data)
VALUES (
  'compositions', 
  'all', 
  '{"compositions":[{"id":"sample-comp","name":"Sample Composition","icon":"/assets/traits/default.png","count":1,"avgPlacement":4.5,"winRate":25,"top4Rate":50,"traits":[],"units":[]}],"summary":{"totalGames":1,"avgPlacement":4.5,"topComps":[]},"region":"all"}'
);

-- Drop existing tables if they exist
DROP TABLE IF EXISTS region_status CASCADE;
DROP TABLE IF EXISTS cached_matches CASCADE;
DROP TABLE IF EXISTS processed_stats CASCADE;

-- Regions table
CREATE TABLE regions (
  region_id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_count INTEGER DEFAULT 0,
  last_error TEXT
);

-- Insert default regions
INSERT INTO regions (region_id, name) VALUES 
  ('all', 'All Regions'),
  ('NA', 'North America'),
  ('EUW', 'Europe West'),
  ('KR', 'Korea'),
  ('BR', 'Brazil'),
  ('JP', 'Japan');

-- Matches table
CREATE TABLE matches (
  match_id TEXT PRIMARY KEY,
  region_id VARCHAR(10) REFERENCES regions(region_id),
  match_data JSONB NOT NULL, -- Keep match data as JSON initially for compatibility
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Units table
CREATE TABLE units (
  unit_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(255) NOT NULL,
  cost INTEGER NOT NULL
);

-- Traits table
CREATE TABLE traits (
  trait_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(255) NOT NULL,
  trait_type VARCHAR(20) NOT NULL -- 'origin' or 'class'
);

-- Items table
CREATE TABLE items (
  item_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(255) NOT NULL,
  category VARCHAR(50)
);

-- Compositions table
CREATE TABLE compositions (
  composition_id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(255) NOT NULL,
  count INTEGER DEFAULT 0,
  avg_placement NUMERIC(5,2),
  win_rate NUMERIC(5,2),
  top4_rate NUMERIC(5,2),
  region_id VARCHAR(10) REFERENCES regions(region_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Composition-Trait junction table
CREATE TABLE composition_traits (
  composition_id VARCHAR(100) REFERENCES compositions(composition_id) ON DELETE CASCADE,
  trait_id VARCHAR(50) REFERENCES traits(trait_id) ON DELETE CASCADE,
  tier INTEGER NOT NULL,
  num_units INTEGER NOT NULL,
  tier_icon VARCHAR(255),
  PRIMARY KEY (composition_id, trait_id)
);

-- Composition-Unit junction table
CREATE TABLE composition_units (
  composition_id VARCHAR(100) REFERENCES compositions(composition_id) ON DELETE CASCADE,
  unit_id VARCHAR(50) REFERENCES units(unit_id) ON DELETE CASCADE,
  count INTEGER DEFAULT 1,
  PRIMARY KEY (composition_id, unit_id)
);

-- Unit-Item junction table (within composition context)
CREATE TABLE unit_items (
  composition_id VARCHAR(100) REFERENCES compositions(composition_id) ON DELETE CASCADE,
  unit_id VARCHAR(50) REFERENCES units(unit_id) ON DELETE CASCADE,
  item_id VARCHAR(50) REFERENCES items(item_id) ON DELETE CASCADE,
  count INTEGER DEFAULT 1,
  PRIMARY KEY (composition_id, unit_id, item_id)
);

-- Placement data
CREATE TABLE placement_data (
  composition_id VARCHAR(100) REFERENCES compositions(composition_id) ON DELETE CASCADE,
  placement INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (composition_id, placement)
);

-- Entity stats table for performance metrics
CREATE TABLE entity_stats (
  entity_id VARCHAR(100) NOT NULL,
  entity_type VARCHAR(20) NOT NULL, -- 'unit', 'trait', 'item', 'composition'
  count INTEGER DEFAULT 0,
  avg_placement NUMERIC(5,2),
  win_rate NUMERIC(5,2),
  top4_rate NUMERIC(5,2),
  play_rate NUMERIC(5,2),
  region_id VARCHAR(10) REFERENCES regions(region_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (entity_id, entity_type, region_id)
);

-- Indexes for performance
CREATE INDEX idx_matches_region ON matches(region_id);
CREATE INDEX idx_compositions_region ON compositions(region_id);
CREATE INDEX idx_entity_stats_region ON entity_stats(region_id);
CREATE INDEX idx_entity_stats_type ON entity_stats(entity_type);
CREATE INDEX idx_compositions_created_at ON compositions(created_at);
CREATE INDEX idx_unit_items_unit ON unit_items(unit_id);
CREATE INDEX idx_unit_items_item ON unit_items(item_id);
CREATE INDEX idx_composition_traits_trait ON composition_traits(trait_id);
CREATE INDEX idx_composition_units_unit ON composition_units(unit_id);

-- Views for easier querying
CREATE OR REPLACE VIEW v_top_compositions AS
SELECT c.*, r.name as region_name
FROM compositions c
JOIN regions r ON c.region_id = r.region_id
ORDER BY c.win_rate DESC, c.count DESC;

CREATE OR REPLACE VIEW v_top_units AS
SELECT e.*, u.name, u.icon, u.cost
FROM entity_stats e
JOIN units u ON e.entity_id = u.unit_id
WHERE e.entity_type = 'unit'
ORDER BY e.win_rate DESC, e.count DESC;

CREATE OR REPLACE VIEW v_top_traits AS
SELECT e.*, t.name, t.icon, t.trait_type
FROM entity_stats e
JOIN traits t ON e.entity_id = t.trait_id
WHERE e.entity_type = 'trait'
ORDER BY e.win_rate DESC, e.count DESC;

CREATE OR REPLACE VIEW v_top_items AS
SELECT e.*, i.name, i.icon, i.category
FROM entity_stats e
JOIN items i ON e.entity_id = i.item_id
WHERE e.entity_type = 'item'
ORDER BY e.win_rate DESC, e.count DESC;

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data(days_to_keep INTEGER)
RETURNS void AS $$
DECLARE
  cutoff_date TIMESTAMP;
BEGIN
  cutoff_date := NOW() - (days_to_keep || ' days')::INTERVAL;
  
  -- Delete old matches
  DELETE FROM matches WHERE created_at < cutoff_date;
  
  -- Delete old compositions and related data
  DELETE FROM compositions WHERE created_at < cutoff_date;
  
  -- Delete old entity stats
  DELETE FROM entity_stats WHERE created_at < cutoff_date;
END;
$$ LANGUAGE plpgsql;

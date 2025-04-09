import { Pool } from 'pg';

// Single pool instance for all connections
let _pool: Pool | null = null;

// Get pool instance
function getPool(): Pool {
  if (!_pool) {
    if (!process.env.NEON_DATABASE_URL) {
      throw new Error('NEON_DATABASE_URL environment variable is not set');
    }
    
    try {
      _pool = new Pool({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        },
        max: 10, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection not established
      });
      
      // Log pool errors
      _pool.on('error', (err) => {
        console.error('Unexpected database pool error:', err);
      });
      
      // Test connection on initialization
      _pool.query('SELECT NOW()').then(() => {
        console.log('Database connection established successfully');
      }).catch((err) => {
        console.error('Database connection test failed:', err);
      });
    } catch (err) {
      console.error('Failed to create database pool:', err);
      throw err;
    }
  }
  return _pool;
}

export async function query(text: string, params: any[] = []) {
  try {
    const pool = getPool();
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) { // Log slow queries
      console.log('Slow query:', { text, duration, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    console.error('Database query error:', error, { text, params: params.slice(0, 2) });
    throw error;
  }
}

// Create tables if they don't exist
export async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    
    // Matches table
    await query(`
      CREATE TABLE IF NOT EXISTS cached_matches (
        id SERIAL PRIMARY KEY,
        match_id TEXT UNIQUE NOT NULL,
        region TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Processed stats table
    await query(`
      CREATE TABLE IF NOT EXISTS processed_stats (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        region TEXT NOT NULL,
        data JSONB NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Region status table
    await query(`
      CREATE TABLE IF NOT EXISTS region_status (
        region TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'active',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        error_count INTEGER DEFAULT 0,
        last_error TEXT
      )
    `);

    // Create indexes for better performance
    await query(`CREATE INDEX IF NOT EXISTS idx_cached_matches_region ON cached_matches(region)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_processed_stats_type_region ON processed_stats(type, region)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_processed_stats_last_updated ON processed_stats(last_updated DESC)`);

    console.log('Database initialized successfully');
    
    // Insert initial sample data if tables are empty
    const hasData = await query('SELECT COUNT(*) FROM processed_stats');
    if (hasData.rows[0].count === '0') {
      await insertSampleData();
    }
    
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Insert sample data for all regions
export async function insertSampleData() {
  try {
    console.log('Inserting sample data...');
    
    // Insert sample data for all regions
    const regions = ['all', 'NA', 'EUW', 'KR', 'BR', 'JP'];
    const sampleData = {
      compositions: [{
        id: 'sample-comp',
        name: 'Sample Composition',
        icon: '/assets/traits/default.png',
        count: 1,
        avgPlacement: 4.5,
        winRate: 25,
        top4Rate: 50,
        traits: [],
        units: []
      }],
      summary: { totalGames: 1, avgPlacement: 4.5, topComps: [] }
    };
    
    // Insert data for all regions
    for (const region of regions) {
      // Add region to the data
      const regionData = {...sampleData, region};
      
      await saveProcessedStats('compositions', region, regionData);
      console.log(`Sample data inserted for region: ${region}`);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to insert sample data:', error);
    throw error;
  }
}

// Get region statuses
export async function getRegionStatuses() {
  try {
    const result = await query('SELECT * FROM region_status');
    return result.rows;
  } catch (error) {
    console.error('Failed to get region statuses:', error);
    return [];
  }
}

// Update region status
export async function updateRegionStatus(region: string, status: string, errorMessage?: string) {
  try {
    if (status === 'error' && errorMessage) {
      await query(
        'INSERT INTO region_status (region, status, last_updated, error_count, last_error) VALUES ($1, $2, NOW(), 1, $3) ' +
        'ON CONFLICT (region) DO UPDATE SET status = $2, last_updated = NOW(), error_count = region_status.error_count + 1, last_error = $3',
        [region, status, errorMessage]
      );
    } else {
      await query(
        'INSERT INTO region_status (region, status, last_updated) VALUES ($1, $2, NOW()) ' +
        'ON CONFLICT (region) DO UPDATE SET status = $2, last_updated = NOW()',
        [region, status]
      );
    }
    return true;
  } catch (error) {
    console.error('Failed to update region status:', error);
    return false;
  }
}

// Save match data
export async function saveMatch(matchId: string, region: string, data: any) {
  try {
    await query(
      'INSERT INTO cached_matches (match_id, region, data) VALUES ($1, $2, $3) ON CONFLICT (match_id) DO NOTHING',
      [matchId, region, JSON.stringify(data)]
    );
    return true;
  } catch (error) {
    console.error('Failed to save match:', error);
    return false;
  }
}

// Get all cached matches
export async function getCachedMatches(region?: string) {
  try {
    let result;
    if (region && region !== 'all') {
      result = await query('SELECT data FROM cached_matches WHERE region = $1', [region]);
    } else {
      result = await query('SELECT data FROM cached_matches');
    }
    return result.rows.map(row => row.data);
  } catch (error) {
    console.error('Failed to get cached matches:', error);
    return [];
  }
}

// Get processed stats with better error handling
export async function getProcessedStats(type: string, region: string = 'all') {
  try {
    // First, check if the table exists
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'processed_stats'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('Table processed_stats does not exist, initializing database');
      await initializeDatabase();
    }
    
    // Now query for the data
    const result = await query(
      'SELECT data FROM processed_stats WHERE type = $1 AND region = $2 ORDER BY last_updated DESC LIMIT 1',
      [type, region]
    );
    
    if (result.rows.length === 0) {
      console.log(`No data found for type=${type}, region=${region}`);
      return null;
    }
    
    return result.rows[0].data;
  } catch (error) {
    console.error(`Error getting processed stats for type=${type}, region=${region}:`, error);
    return null;
  }
}

// Save processed stats
export async function saveProcessedStats(type: string, region: string, data: any) {
  try {
    await query(
      'INSERT INTO processed_stats (type, region, data, last_updated) VALUES ($1, $2, $3, NOW())',
      [type, region, JSON.stringify(data)]
    );
    return true;
  } catch (error) {
    console.error('Failed to save processed stats:', error);
    return false;
  }
}

// Clean up old data
export async function cleanupOldData(daysToKeep: number = 3) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    await query('DELETE FROM cached_matches WHERE created_at < $1', [cutoffDate]);
    
    // Keep only the latest processed stats for each type/region
    await query(`
      DELETE FROM processed_stats 
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, 
                 ROW_NUMBER() OVER (PARTITION BY type, region ORDER BY last_updated DESC) as row_num 
          FROM processed_stats
        ) t 
        WHERE t.row_num <= 2
      )
    `);
    
    return true;
  } catch (error) {
    console.error('Failed to clean up old data:', error);
    return false;
  }
}

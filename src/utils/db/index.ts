import { Pool, PoolClient } from 'pg';
import { ProcessedData, ProcessedMatch, Composition, ProcessedUnit, ProcessedTrait, ProcessedItem } from '@/types';

// Single connection pool with optimized settings
let _pool: Pool | null = null;

// Get optimized pool instance with connection limits
function getPool(): Pool {
  if (!_pool) {
    if (!process.env.NEON_DATABASE_URL) {
      throw new Error('NEON_DATABASE_URL environment variable is not set');
    }
    
    try {
      _pool = new Pool({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20,                     // Increased connection limit
        idleTimeoutMillis: 30000,    // 30 seconds idle timeout
        connectionTimeoutMillis: 5000, // 5 seconds connection timeout
        statement_timeout: 20000,    // 20 seconds statement timeout
        query_timeout: 15000         // 15 seconds query timeout
      });
      
      _pool.on('error', (err) => {
        console.error('Unexpected pool error:', err);
      });
    } catch (err) {
      console.error('Failed to create database pool:', err);
      throw err;
    }
  }
  return _pool;
}

// Execute query with proper connection release
export async function query(text: string, params: any[] = []) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

// Transaction helper with proper error handling
export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  let released = false;
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    client.release();
    released = true;
    return result;
  } catch (e) {
    try {
      if (!released) {
        await client.query('ROLLBACK');
      }
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError);
    } finally {
      if (!released) {
        client.release(true); // Force-close on error
      }
    }
    throw e;
  }
}

// Initialize database with schema
export async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    
    // Read schema file content - in production this would be embedded or in a separate file
    const fs = require('fs');
    const path = require('path');
    let schema: string;
    
    try {
      // Try to read from filesystem (development)
      schema = fs.readFileSync(path.join(process.cwd(), 'schema.sql'), 'utf8');
    } catch (err) {
      // Fallback to hard-coded schema if file not found (production)
      console.log('Schema file not found, using embedded schema');
      schema = `-- Check if regions table exists
      CREATE TABLE IF NOT EXISTS regions (
        region_id VARCHAR(10) PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        error_count INTEGER DEFAULT 0,
        last_error TEXT
      );`;
    }
    
    return withTransaction(async (client) => {
      await client.query(schema);
      
      // Check if regions are populated
      const regions = await client.query('SELECT COUNT(*) FROM regions');
      if (parseInt(regions.rows[0].count) === 0) {
        // Insert default regions
        await client.query(`
          INSERT INTO regions (region_id, name) VALUES 
            ('all', 'All Regions'),
            ('NA', 'North America'),
            ('EUW', 'Europe West'),
            ('KR', 'Korea'),
            ('BR', 'Brazil'),
            ('JP', 'Japan')
          ON CONFLICT (region_id) DO NOTHING
        `);
      }
      
      return true;
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Save processed match data to database
export async function saveMatch(matchId: string, region: string, data: ProcessedMatch) {
  try {
    await query(
      'INSERT INTO matches (match_id, region_id, match_data) VALUES ($1, $2, $3) ON CONFLICT (match_id) DO NOTHING',
      [matchId, region, JSON.stringify(data)]
    );
    return true;
  } catch (error) {
    console.error(`Error saving match ${matchId}:`, error);
    return false;
  }
}

// Batch save matches with optimized chunking
export async function batchSaveMatches(matches: Array<{id: string, region: string, data: any}>, chunkSize = 10) {
  if (!matches.length) return true;
  
  // Split items into smaller chunks to avoid timeouts
  const chunks = [];
  for (let i = 0; i < matches.length; i += chunkSize) {
    chunks.push(matches.slice(i, i + chunkSize));
  }
  
  let successCount = 0;
  
  // Process each chunk in a separate transaction
  for (const chunk of chunks) {
    try {
      await withTransaction(async (client) => {
        // Execute parameterized queries for matches
        const promises = chunk.map(match => 
          client.query(
            'INSERT INTO matches (match_id, region_id, match_data) VALUES($1, $2, $3) ON CONFLICT (match_id) DO NOTHING',
            [match.id, match.region, JSON.stringify(match.data)]
          )
        );
        
        await Promise.all(promises);
        successCount += chunk.length;
      });
    } catch (error) {
      console.error(`Error inserting match chunk:`, error);
    }
  }
  
  console.log(`Match insert completed: ${successCount} successes, ${matches.length - successCount} errors`);
  return successCount > 0;
}

// Save a composition and all related data
async function saveComposition(
  client: PoolClient, 
  composition: Composition, 
  region: string
) {
  // Insert the composition
  await client.query(
    `INSERT INTO compositions 
     (composition_id, name, icon, count, avg_placement, win_rate, top4_rate, region_id) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (composition_id) 
     DO UPDATE SET 
       count = $4, 
       avg_placement = $5, 
       win_rate = $6, 
       top4_rate = $7, 
       region_id = $8`,
    [
      composition.id,
      composition.name,
      composition.icon,
      composition.count || 0,
      composition.avgPlacement || 0,
      composition.winRate || 0,
      composition.top4Rate || 0,
      region
    ]
  );
  
  // Insert traits
  if (composition.traits && composition.traits.length > 0) {
    // First ensure traits exist
    for (const trait of composition.traits) {
      // Determine if origin or class (simplified method)
      const traitType = trait.id.includes('origin') ? 'origin' : 'class';
      
      await client.query(
        `INSERT INTO traits (trait_id, name, icon, trait_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (trait_id) DO NOTHING`,
        [trait.id, trait.name, trait.icon, traitType]
      );
      
      // Add to composition_traits junction
      await client.query(
        `INSERT INTO composition_traits 
         (composition_id, trait_id, tier, num_units, tier_icon) 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (composition_id, trait_id) 
         DO UPDATE SET tier = $3, num_units = $4, tier_icon = $5`,
        [
          composition.id,
          trait.id,
          trait.tier || 0,
          trait.numUnits || 0,
          trait.tierIcon || null
        ]
      );
    }
  }
  
  // Insert units
  if (composition.units && composition.units.length > 0) {
    for (const unit of composition.units) {
      // Ensure unit exists
      await client.query(
        `INSERT INTO units (unit_id, name, icon, cost)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (unit_id) DO NOTHING`,
        [unit.id, unit.name, unit.icon, unit.cost]
      );
      
      // Add to composition_units junction
      await client.query(
        `INSERT INTO composition_units (composition_id, unit_id, count)
         VALUES ($1, $2, $3)
         ON CONFLICT (composition_id, unit_id) DO UPDATE SET count = $3`,
        [composition.id, unit.id, unit.count || 1]
      );
      
      // Handle unit items
      if (unit.items && unit.items.length > 0) {
        for (const item of unit.items) {
          // Ensure item exists
          await client.query(
            `INSERT INTO items (item_id, name, icon, category)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (item_id) DO NOTHING`,
            [item.id, item.name, item.icon, item.category || null]
          );
          
          // Add to unit_items junction
          await client.query(
            `INSERT INTO unit_items (composition_id, unit_id, item_id, count)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (composition_id, unit_id, item_id) DO UPDATE SET count = $4`,
            [composition.id, unit.id, item.id, 1] // Default count to 1
          );
        }
      }
    }
  }
  
  // Insert placement data
  if (composition.placementData && composition.placementData.length > 0) {
    for (const placement of composition.placementData) {
      await client.query(
        `INSERT INTO placement_data (composition_id, placement, count)
         VALUES ($1, $2, $3)
         ON CONFLICT (composition_id, placement) DO UPDATE SET count = $3`,
        [composition.id, placement.placement, placement.count]
      );
    }
  }
  
  // Insert entity stats for the composition itself
  await client.query(
    `INSERT INTO entity_stats 
     (entity_id, entity_type, count, avg_placement, win_rate, top4_rate, play_rate, region_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (entity_id, entity_type, region_id) 
     DO UPDATE SET 
       count = $3, 
       avg_placement = $4, 
       win_rate = $5, 
       top4_rate = $6, 
       play_rate = $7`,
    [
      composition.id,
      'composition',
      composition.count || 0,
      composition.avgPlacement || 0,
      composition.winRate || 0,
      composition.top4Rate || 0,
      composition.playRate || 0,
      region
    ]
  );
}

// Save entity statistics (units, traits, items)
async function saveEntityStats(
  client: PoolClient, 
  entityType: string, 
  entities: Array<ProcessedUnit | ProcessedTrait | ProcessedItem>, 
  region: string
) {
  for (const entity of entities) {
    await client.query(
      `INSERT INTO entity_stats 
       (entity_id, entity_type, count, avg_placement, win_rate, top4_rate, play_rate, region_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (entity_id, entity_type, region_id) 
       DO UPDATE SET 
         count = $3, 
         avg_placement = $4, 
         win_rate = $5, 
         top4_rate = $6, 
         play_rate = $7`,
      [
        entity.id,
        entityType,
        entity.count || 0,
        entity.avgPlacement || 0,
        entity.winRate || 0,
        entity.top4Rate || 0,
        entity.playRate || 0,
        region
      ]
    );
  }
}

// Save processed stats to database in normalized form
export async function saveProcessedStats(
  type: string, 
  region: string, 
  data: any
) {
  try {
    return withTransaction(async (client) => {
      if (type === 'compositions' && data.compositions) {
        // Save each composition and its related data
        for (const comp of data.compositions) {
          await saveComposition(client, comp, region);
        }
      } else if (type === 'units' && data.entities) {
        // Save unit stats
        await saveEntityStats(client, 'unit', data.entities, region);
      } else if (type === 'traits' && data.entities) {
        // Save trait stats
        await saveEntityStats(client, 'trait', data.entities, region);
      } else if (type === 'items' && data.entities) {
        // Save item stats
        await saveEntityStats(client, 'item', data.entities, region);
      }
      
      return true;
    });
  } catch (error) {
    console.error(`Error saving processed stats for ${type} in ${region}:`, error);
    return false;
  }
}

// Optimized batch insertion for processed stats
export async function batchInsert(items: Array<{type: string, region: string, data: any}>, chunkSize = 5) {
  if (!items.length) return true;
  
  // Split items into smaller chunks to avoid timeouts
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  
  let successCount = 0;
  
  // Process each chunk in a separate transaction
  for (const chunk of chunks) {
    try {
      await withTransaction(async (client) => {
        // Process each item in the chunk
        for (const item of chunk) {
          if (item.type === 'compositions' && item.data.compositions) {
            // Save each composition and its related data
            for (const comp of item.data.compositions) {
              await saveComposition(client, comp, item.region);
            }
            successCount++;
          } else if (['units', 'traits', 'items', 'comps'].includes(item.type) && item.data.entities) {
            // Map comps type to composition
            const entityType = item.type === 'comps' ? 'composition' : item.type.slice(0, -1);
            await saveEntityStats(client, entityType, item.data.entities, item.region);
            successCount++;
          }
        }
      });
    } catch (error) {
      console.error(`Error inserting chunk:`, error);
    }
  }
  
  console.log(`Batch insert completed: ${successCount} successes, ${items.length - successCount} errors`);
  return successCount > 0;
}

// Get compositions with related data
export async function getCompositions(region: string = 'all', page: number = 1, limit: number = 20): Promise<ProcessedData | null> {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count for pagination
    const countResult = await query(
      'SELECT COUNT(*) FROM compositions WHERE region_id = $1',
      [region]
    );
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);
    
    // Get compositions with pagination
    const compsResult = await query(
      `SELECT c.*, r.name as region_name
       FROM compositions c
       JOIN regions r ON c.region_id = r.region_id
       WHERE c.region_id = $1
       ORDER BY c.win_rate DESC, c.count DESC
       LIMIT $2 OFFSET $3`,
      [region, limit, offset]
    );
    
    const compositions: Composition[] = [];
    
    // Process each composition
    for (const row of compsResult.rows) {
      // Get composition traits
      const traitsResult = await query(
        `SELECT ct.*, t.name, t.icon, t.trait_type
         FROM composition_traits ct
         JOIN traits t ON ct.trait_id = t.trait_id
         WHERE ct.composition_id = $1
         ORDER BY ct.tier DESC, ct.num_units DESC`,
        [row.composition_id]
      );
      
      const traits: ProcessedTrait[] = traitsResult.rows.map(trait => ({
        id: trait.trait_id,
        name: trait.name,
        icon: trait.icon,
        tier: trait.tier,
        numUnits: trait.num_units,
        tierIcon: trait.tier_icon
      }));
      
      // Get composition units
      const unitsResult = await query(
        `SELECT cu.*, u.name, u.icon, u.cost
         FROM composition_units cu
         JOIN units u ON cu.unit_id = u.unit_id
         WHERE cu.composition_id = $1
         ORDER BY u.cost DESC, cu.count DESC`,
        [row.composition_id]
      );
      
      const units: ProcessedUnit[] = [];
      
      // Process each unit and its items
      for (const unitRow of unitsResult.rows) {
        // Get unit items
        const itemsResult = await query(
          `SELECT ui.*, i.name, i.icon, i.category
           FROM unit_items ui
           JOIN items i ON ui.item_id = i.item_id
           WHERE ui.composition_id = $1 AND ui.unit_id = $2`,
          [row.composition_id, unitRow.unit_id]
        );
        
        const items: ProcessedItem[] = itemsResult.rows.map(item => ({
          id: item.item_id,
          name: item.name,
          icon: item.icon,
          category: item.category
        }));
        
        units.push({
          id: unitRow.unit_id,
          name: unitRow.name,
          icon: unitRow.icon,
          cost: unitRow.cost,
          count: unitRow.count,
          items: items
        });
      }
      
      // Get placement data
      const placementResult = await query(
        'SELECT placement, count FROM placement_data WHERE composition_id = $1 ORDER BY placement',
        [row.composition_id]
      );
      
      const placementData = placementResult.rows.map(p => ({
        placement: p.placement,
        count: p.count
      }));
      
      // Build the composition object
      compositions.push({
        id: row.composition_id,
        name: row.name,
        icon: row.icon,
        count: row.count,
        avgPlacement: row.avg_placement,
        winRate: row.win_rate,
        top4Rate: row.top4_rate,
        traits,
        units,
        placementData
      });
    }
    
    // Get summary data
    const summaryResult = await query(
      'SELECT AVG(avg_placement) as avg_placement, COUNT(*) as total_games FROM compositions WHERE region_id = $1',
      [region]
    );
    
    const summary = {
      totalGames: parseInt(summaryResult.rows[0].total_games) || 0,
      avgPlacement: parseFloat(summaryResult.rows[0].avg_placement) || 0,
      topComps: compositions.slice(0, 5)
    };
    
    return {
      compositions,
      summary,
      region,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages
      }
    };
  } catch (error) {
    console.error(`Error getting compositions:`, error);
    return null;
  }
}

// Get a single composition by ID
export async function getComposition(id: string): Promise<Composition | null> {
  try {
    // Get the composition
    const compResult = await query(
      `SELECT c.*, r.name as region_name
       FROM compositions c
       JOIN regions r ON c.region_id = r.region_id
       WHERE c.composition_id = $1`,
      [id]
    );
    
    if (compResult.rows.length === 0) {
      return null;
    }
    
    const row = compResult.rows[0];
    
    // Get composition traits
    const traitsResult = await query(
      `SELECT ct.*, t.name, t.icon, t.trait_type
       FROM composition_traits ct
       JOIN traits t ON ct.trait_id = t.trait_id
       WHERE ct.composition_id = $1
       ORDER BY ct.tier DESC, ct.num_units DESC`,
      [id]
    );
    
    const traits: ProcessedTrait[] = traitsResult.rows.map(trait => ({
      id: trait.trait_id,
      name: trait.name,
      icon: trait.icon,
      tier: trait.tier,
      numUnits: trait.num_units,
      tierIcon: trait.tier_icon
    }));
    
    // Get composition units
    const unitsResult = await query(
      `SELECT cu.*, u.name, u.icon, u.cost
       FROM composition_units cu
       JOIN units u ON cu.unit_id = u.unit_id
       WHERE cu.composition_id = $1
       ORDER BY u.cost DESC, cu.count DESC`,
      [id]
    );
    
    const units: ProcessedUnit[] = [];
    
    // Process each unit and its items
    for (const unitRow of unitsResult.rows) {
      // Get unit items
      const itemsResult = await query(
        `SELECT ui.*, i.name, i.icon, i.category
         FROM unit_items ui
         JOIN items i ON ui.item_id = i.item_id
         WHERE ui.composition_id = $1 AND ui.unit_id = $2`,
        [id, unitRow.unit_id]
      );
      
      const items: ProcessedItem[] = itemsResult.rows.map(item => ({
        id: item.item_id,
        name: item.name,
        icon: item.icon,
        category: item.category
      }));
      
      units.push({
        id: unitRow.unit_id,
        name: unitRow.name,
        icon: unitRow.icon,
        cost: unitRow.cost,
        count: unitRow.count,
        items: items
      });
    }
    
    // Get placement data
    const placementResult = await query(
      'SELECT placement, count FROM placement_data WHERE composition_id = $1 ORDER BY placement',
      [id]
    );
    
    const placementData = placementResult.rows.map(p => ({
      placement: p.placement,
      count: p.count
    }));
    
    // Build the composition object
    return {
      id: row.composition_id,
      name: row.name,
      icon: row.icon,
      count: row.count,
      avgPlacement: row.avg_placement,
      winRate: row.win_rate,
      top4Rate: row.top4_rate,
      traits,
      units,
      placementData
    };
  } catch (error) {
    console.error(`Error getting composition ${id}:`, error);
    return null;
  }
}

// Get entity data (unit, trait, item)
export async function getEntityData(type: string, id: string, region: string = 'all'): Promise<any | null> {
  try {
    if (!['unit', 'trait', 'item'].includes(type)) {
      throw new Error(`Invalid entity type: ${type}`);
    }
    
    // Get entity stats
    const statsResult = await query(
      `SELECT e.* 
       FROM entity_stats e
       WHERE e.entity_id = $1 AND e.entity_type = $2 AND e.region_id = $3`,
      [id, type, region]
    );
    
    if (statsResult.rows.length === 0) {
      return null;
    }
    
    const stats = statsResult.rows[0];
    
    // Build base entity
    let entity: any = {
      id,
      count: stats.count,
      avgPlacement: stats.avg_placement,
      winRate: stats.win_rate,
      top4Rate: stats.top4_rate,
      playRate: stats.play_rate
    };
    
    // Get related entity data
    if (type === 'unit') {
      // Get unit data
      const unitResult = await query('SELECT * FROM units WHERE unit_id = $1', [id]);
      if (unitResult.rows.length > 0) {
        entity = {
          ...entity,
          name: unitResult.rows[0].name,
          icon: unitResult.rows[0].icon,
          cost: unitResult.rows[0].cost
        };
      }
      
      // Get best items for unit
      const itemsResult = await query(
        `SELECT i.*, COUNT(ui.item_id) as usage_count, 
                AVG(es.win_rate) as avg_win_rate,
                AVG(es.avg_placement) as avg_placement
         FROM items i
         JOIN unit_items ui ON i.item_id = ui.item_id
         JOIN compositions c ON ui.composition_id = c.composition_id
         JOIN entity_stats es ON es.entity_id = c.composition_id AND es.entity_type = 'composition'
         WHERE ui.unit_id = $1 AND c.region_id = $2
         GROUP BY i.item_id, i.name, i.icon, i.category
         ORDER BY avg_win_rate DESC
         LIMIT 10`,
        [id, region]
      );
      
      entity.bestItems = itemsResult.rows.map(item => ({
        id: item.item_id,
        name: item.name,
        icon: item.icon,
        category: item.category,
        stats: {
          count: parseInt(item.usage_count),
          winRate: parseFloat(item.avg_win_rate),
          avgPlacement: parseFloat(item.avg_placement)
        }
      }));
      
      // Get related comps
      const compsResult = await query(
        `SELECT c.*, es.win_rate, es.avg_placement, es.top4_rate, es.count
         FROM compositions c
         JOIN composition_units cu ON c.composition_id = cu.composition_id
         JOIN entity_stats es ON es.entity_id = c.composition_id AND es.entity_type = 'composition'
         WHERE cu.unit_id = $1 AND c.region_id = $2
         ORDER BY es.win_rate DESC
         LIMIT 10`,
        [id, region]
      );
      
      entity.relatedComps = await Promise.all(compsResult.rows.map(async (comp) => {
        // Get traits for the comp
        const traitsResult = await query(
          `SELECT ct.*, t.name, t.icon
           FROM composition_traits ct
           JOIN traits t ON ct.trait_id = t.trait_id
           WHERE ct.composition_id = $1
           ORDER BY ct.tier DESC, ct.num_units DESC
           LIMIT 5`,
          [comp.composition_id]
        );
        
        const traits = traitsResult.rows.map(trait => ({
          id: trait.trait_id,
          name: trait.name,
          icon: trait.icon,
          tier: trait.tier,
          numUnits: trait.num_units,
          tierIcon: trait.tier_icon
        }));
        
        return {
          id: comp.composition_id,
          name: comp.name,
          icon: comp.icon,
          count: comp.count,
          avgPlacement: comp.avg_placement,
          winRate: comp.win_rate,
          top4Rate: comp.top4_rate,
          traits
        };
      }));
      
    } else if (type === 'trait') {
      // Get trait data
      const traitResult = await query('SELECT * FROM traits WHERE trait_id = $1', [id]);
      if (traitResult.rows.length > 0) {
        entity = {
          ...entity,
          name: traitResult.rows[0].name,
          icon: traitResult.rows[0].icon,
          traitType: traitResult.rows[0].trait_type
        };
      }
      
      // Get related comps
      const compsResult = await query(
        `SELECT c.*, es.win_rate, es.avg_placement, es.top4_rate, es.count
         FROM compositions c
         JOIN composition_traits ct ON c.composition_id = ct.composition_id
         JOIN entity_stats es ON es.entity_id = c.composition_id AND es.entity_type = 'composition'
         WHERE ct.trait_id = $1 AND c.region_id = $2
         ORDER BY es.win_rate DESC
         LIMIT 10`,
        [id, region]
      );
      
      entity.relatedComps = await Promise.all(compsResult.rows.map(async (comp) => {
        // Get traits for the comp
        const traitsResult = await query(
          `SELECT ct.*, t.name, t.icon
           FROM composition_traits ct
           JOIN traits t ON ct.trait_id = t.trait_id
           WHERE ct.composition_id = $1
           ORDER BY ct.tier DESC, ct.num_units DESC
           LIMIT 5`,
          [comp.composition_id]
        );
        
        const traits = traitsResult.rows.map(trait => ({
          id: trait.trait_id,
          name: trait.name,
          icon: trait.icon,
          tier: trait.tier,
          numUnits: trait.num_units,
          tierIcon: trait.tier_icon
        }));
        
        return {
          id: comp.composition_id,
          name: comp.name,
          icon: comp.icon,
          count: comp.count,
          avgPlacement: comp.avg_placement,
          winRate: comp.win_rate,
          top4Rate: comp.top4_rate,
          traits
        };
      }));
      
    } else if (type === 'item') {
      // Get item data
      const itemResult = await query('SELECT * FROM items WHERE item_id = $1', [id]);
      if (itemResult.rows.length > 0) {
        entity = {
          ...entity,
          name: itemResult.rows[0].name,
          icon: itemResult.rows[0].icon,
          category: itemResult.rows[0].category
        };
      }
      
      // Get units that use this item
      const unitsResult = await query(
        `SELECT u.*, COUNT(ui.unit_id) as usage_count, 
                AVG(es.win_rate) as avg_win_rate,
                AVG(es.avg_placement) as avg_placement
         FROM units u
         JOIN unit_items ui ON u.unit_id = ui.unit_id
         JOIN compositions c ON ui.composition_id = c.composition_id
         JOIN entity_stats es ON es.entity_id = c.composition_id AND es.entity_type = 'composition'
         WHERE ui.item_id = $1 AND c.region_id = $2
         GROUP BY u.unit_id, u.name, u.icon, u.cost
         ORDER BY avg_win_rate DESC
         LIMIT 10`,
        [id, region]
      );
      
      entity.unitsWithItem = unitsResult.rows.map(unit => ({
        id: unit.unit_id,
        name: unit.name,
        icon: unit.icon,
        cost: unit.cost,
        count: parseInt(unit.usage_count),
        winRate: parseFloat(unit.avg_win_rate),
        avgPlacement: parseFloat(unit.avg_placement)
      }));
      
      // Get related comps
      const compsResult = await query(
        `SELECT DISTINCT c.*, es.win_rate, es.avg_placement, es.top4_rate, es.count
         FROM compositions c
         JOIN unit_items ui ON c.composition_id = ui.composition_id
         JOIN entity_stats es ON es.entity_id = c.composition_id AND es.entity_type = 'composition'
         WHERE ui.item_id = $1 AND c.region_id = $2
         ORDER BY es.win_rate DESC
         LIMIT 10`,
        [id, region]
      );
      
      entity.relatedComps = await Promise.all(compsResult.rows.map(async (comp) => {
        // Get traits for the comp
        const traitsResult = await query(
          `SELECT ct.*, t.name, t.icon
           FROM composition_traits ct
           JOIN traits t ON ct.trait_id = t.trait_id
           WHERE ct.composition_id = $1
           ORDER BY ct.tier DESC, ct.num_units DESC
           LIMIT 5`,
          [comp.composition_id]
        );
        
        const traits = traitsResult.rows.map(trait => ({
          id: trait.trait_id,
          name: trait.name,
          icon: trait.icon,
          tier: trait.tier,
          numUnits: trait.num_units,
          tierIcon: trait.tier_icon
        }));
        
        return {
          id: comp.composition_id,
          name: comp.name,
          icon: comp.icon,
          count: comp.count,
          avgPlacement: comp.avg_placement,
          winRate: comp.win_rate,
          top4Rate: comp.top4_rate,
          traits
        };
      }));
    }
    
    return entity;
  } catch (error) {
    console.error(`Error getting ${type} ${id}:`, error);
    return null;
  }
}

// Get all entities of a specific type
export async function getEntities(type: string, region: string = 'all', page: number = 1, limit: number = 50) {
  try {
    if (!['unit', 'trait', 'item', 'composition'].includes(type)) {
      throw new Error(`Invalid entity type: ${type}`);
    }
    
    const offset = (page - 1) * limit;
    
    // Get total count for pagination
    const countResult = await query(
      'SELECT COUNT(*) FROM entity_stats WHERE entity_type = $1 AND region_id = $2',
      [type, region]
    );
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);
    
    let result;
    
    // Get entities with pagination and type-specific joins
    if (type === 'unit') {
      result = await query(
        `SELECT e.*, u.name, u.icon, u.cost
         FROM entity_stats e
         JOIN units u ON e.entity_id = u.unit_id
         WHERE e.entity_type = $1 AND e.region_id = $2
         ORDER BY e.win_rate DESC, e.count DESC
         LIMIT $3 OFFSET $4`,
        [type, region, limit, offset]
      );
    } else if (type === 'trait') {
      result = await query(
        `SELECT e.*, t.name, t.icon, t.trait_type
         FROM entity_stats e
         JOIN traits t ON e.entity_id = t.trait_id
         WHERE e.entity_type = $1 AND e.region_id = $2
         ORDER BY e.win_rate DESC, e.count DESC
         LIMIT $3 OFFSET $4`,
        [type, region, limit, offset]
      );
    } else if (type === 'item') {
      result = await query(
        `SELECT e.*, i.name, i.icon, i.category
         FROM entity_stats e
         JOIN items i ON e.entity_id = i.item_id
         WHERE e.entity_type = $1 AND e.region_id = $2
         ORDER BY e.win_rate DESC, e.count DESC
         LIMIT $3 OFFSET $4`,
        [type, region, limit, offset]
      );
    } else { // composition
      result = await query(
        `SELECT e.*, c.name, c.icon
         FROM entity_stats e
         JOIN compositions c ON e.entity_id = c.composition_id
         WHERE e.entity_type = $1 AND e.region_id = $2
         ORDER BY e.win_rate DESC, e.count DESC
         LIMIT $3 OFFSET $4`,
        [type, region, limit, offset]
      );
    }
    
    // Map database rows to entities
    const entities = result.rows.map(row => {
      const baseEntity = {
        id: row.entity_id,
        name: row.name,
        icon: row.icon,
        count: row.count,
        avgPlacement: row.avg_placement,
        winRate: row.win_rate,
        top4Rate: row.top4_rate,
        playRate: row.play_rate
      };
      
      // Add type-specific properties
      if (type === 'unit') {
        return {
          ...baseEntity,
          cost: row.cost
        };
      } else if (type === 'trait') {
        return {
          ...baseEntity,
          traitType: row.trait_type
        };
      } else if (type === 'item') {
        return {
          ...baseEntity,
          category: row.category
        };
      }
      
      return baseEntity;
    });
    
    return {
      entities,
      region,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages
      }
    };
  } catch (error) {
    console.error(`Error getting ${type} entities:`, error);
    return null;
  }
}

// Get region statuses
export async function getRegionStatuses() {
  try {
    const result = await query('SELECT * FROM regions');
    return result.rows;
  } catch (error) {
    console.error('Failed to get region statuses:', error);
    return [];
  }
}

// Update region status
export async function updateRegionStatus(region: string, status: string, errorMessage?: string) {
  try {
    if (errorMessage) {
      await query(
        `UPDATE regions SET 
         status = $2, 
         last_updated = NOW(), 
         error_count = error_count + 1, 
         last_error = $3
         WHERE region_id = $1`,
        [region, status, errorMessage]
      );
    } else {
      await query(
        `UPDATE regions SET 
         status = $2, 
         last_updated = NOW(), 
         error_count = 0,
         last_error = NULL
         WHERE region_id = $1`,
        [region, status]
      );
    }
    return true;
  } catch (error) {
    console.error(`Failed to update status for ${region}:`, error);
    return false;
  }
}

// Get cached matches with pagination
export async function getCachedMatches(region?: string, limit = 1000) {
  try {
    let result;
    
    if (region && region !== 'all') {
      result = await query(
        'SELECT match_data FROM matches WHERE region_id = $1 ORDER BY created_at DESC LIMIT $2',
        [region, limit]
      );
    } else {
      result = await query(
        'SELECT match_data FROM matches ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
    }
    
    return result.rows.map(row => row.match_data);
  } catch (error) {
    console.error('Failed to get cached matches:', error);
    return [];
  }
}

// Function for backwards compatibility with old code
export async function getProcessedStats(type: string, region: string = 'all') {
  try {
    if (type === 'compositions') {
      // Use the new getCompositions function
      return getCompositions(region);
    } else {
      // For entity types, use getEntities
      // Map type to singular form for entity_type
      const entityType = type === 'comps' ? 'composition' : type.slice(0, -1);
      return getEntities(entityType, region);
    }
  } catch (error) {
    console.error(`Error getting processed stats: ${error}`);
    return null;
  }
}

// Clean up old data
export async function cleanupOldData(daysToKeep: number = 7) {
  try {
    await query('SELECT cleanup_old_data($1)', [daysToKeep]);
    console.log(`Cleaned up data older than ${daysToKeep} days`);
    return true;
  } catch (error) {
    console.error('Error cleaning up old data:', error);
    throw error;
  }
}

// Insert sample data
export async function insertSampleData() {
  try {
    console.log('Inserting sample data...');
    
    return withTransaction(async (client) => {
      // Sample unit data
      const sampleUnits = [
        { id: 'unit1', name: 'Sample Unit 1', icon: '/assets/units/default.png', cost: 1 },
        { id: 'unit2', name: 'Sample Unit 2', icon: '/assets/units/default.png', cost: 2 },
        { id: 'unit3', name: 'Sample Unit 3', icon: '/assets/units/default.png', cost: 3 }
      ];
      
      // Sample trait data
      const sampleTraits = [
        { id: 'trait1', name: 'Sample Trait 1', icon: '/assets/traits/default.png', trait_type: 'origin' },
        { id: 'trait2', name: 'Sample Trait 2', icon: '/assets/traits/default.png', trait_type: 'class' }
      ];
      
      // Sample item data
      const sampleItems = [
        { id: 'item1', name: 'Sample Item 1', icon: '/assets/items/default.png', category: 'completed' },
        { id: 'item2', name: 'Sample Item 2', icon: '/assets/items/default.png', category: 'completed' }
      ];
      
      // Insert sample units, traits, and items
      for (const unit of sampleUnits) {
        await client.query(
          'INSERT INTO units (unit_id, name, icon, cost) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [unit.id, unit.name, unit.icon, unit.cost]
        );
      }
      
      for (const trait of sampleTraits) {
        await client.query(
          'INSERT INTO traits (trait_id, name, icon, trait_type) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [trait.id, trait.name, trait.icon, trait.trait_type]
        );
      }
      
      for (const item of sampleItems) {
        await client.query(
          'INSERT INTO items (item_id, name, icon, category) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [item.id, item.name, item.icon, item.category]
        );
      }
      
      // Create sample composition
      await client.query(
        `INSERT INTO compositions 
         (composition_id, name, icon, count, avg_placement, win_rate, top4_rate, region_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        ['sample-comp', 'Sample Composition', '/assets/traits/default.png', 100, 4.5, 25.0, 50.0, 'all']
      );
      
      // Add traits to sample composition
      await client.query(
        `INSERT INTO composition_traits 
         (composition_id, trait_id, tier, num_units, tier_icon)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        ['sample-comp', 'trait1', 2, 3, '/assets/traits/default.png']
      );
      
      await client.query(
        `INSERT INTO composition_traits 
         (composition_id, trait_id, tier, num_units, tier_icon)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        ['sample-comp', 'trait2', 1, 2, '/assets/traits/default.png']
      );
      
      // Add units to sample composition
      for (const unit of sampleUnits) {
        await client.query(
          `INSERT INTO composition_units
           (composition_id, unit_id, count)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          ['sample-comp', unit.id, 1]
        );
      }
      
      // Add items to units in composition
      await client.query(
        `INSERT INTO unit_items
         (composition_id, unit_id, item_id, count)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        ['sample-comp', 'unit1', 'item1', 1]
      );
      
      await client.query(
        `INSERT INTO unit_items
         (composition_id, unit_id, item_id, count)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        ['sample-comp', 'unit2', 'item2', 1]
      );
      
      // Add placement data
      for (let i = 1; i <= 8; i++) {
        await client.query(
          `INSERT INTO placement_data
           (composition_id, placement, count)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          ['sample-comp', i, i === 1 ? 25 : (i <= 4 ? 15 : 10)]
        );
      }
      
      // Add entity stats
      // Composition
      await client.query(
        `INSERT INTO entity_stats
         (entity_id, entity_type, count, avg_placement, win_rate, top4_rate, play_rate, region_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        ['sample-comp', 'composition', 100, 4.5, 25.0, 50.0, 10.0, 'all']
      );
      
      // Units
      for (const unit of sampleUnits) {
        await client.query(
          `INSERT INTO entity_stats
           (entity_id, entity_type, count, avg_placement, win_rate, top4_rate, play_rate, region_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT DO NOTHING`,
          [unit.id, 'unit', 50, 4.0, 20.0, 45.0, 8.0, 'all']
        );
      }
      
      // Traits
      for (const trait of sampleTraits) {
        await client.query(
          `INSERT INTO entity_stats
           (entity_id, entity_type, count, avg_placement, win_rate, top4_rate, play_rate, region_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT DO NOTHING`,
          [trait.id, 'trait', 40, 3.8, 22.0, 48.0, 15.0, 'all']
        );
      }
      
      // Items
      for (const item of sampleItems) {
        await client.query(
          `INSERT INTO entity_stats
           (entity_id, entity_type, count, avg_placement, win_rate, top4_rate, play_rate, region_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT DO NOTHING`,
          [item.id, 'item', 30, 3.5, 24.0, 52.0, 5.0, 'all']
        );
      }
      
      // Insert sample data for all regions
      for (const region of ['NA', 'EUW', 'KR', 'BR', 'JP']) {
        // Create region-specific composition
        const regionCompId = `sample-comp-${region.toLowerCase()}`;
        
        await client.query(
          `INSERT INTO compositions 
           (composition_id, name, icon, count, avg_placement, win_rate, top4_rate, region_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT DO NOTHING`,
          [regionCompId, `Sample ${region} Composition`, '/assets/traits/default.png', 80, 4.2, 22.0, 48.0, region]
        );
        
        // Add composition stats
        await client.query(
          `INSERT INTO entity_stats
           (entity_id, entity_type, count, avg_placement, win_rate, top4_rate, play_rate, region_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT DO NOTHING`,
          [regionCompId, 'composition', 80, 4.2, 22.0, 48.0, 9.0, region]
        );
      }
      
      console.log(`Sample data insertion completed`);
      return true;
    });
  } catch (error) {
    console.error('Failed to insert sample data:', error);
    throw error;
  }
}

// Graceful pool shutdown
export async function closePool(timeoutMs: number = 5000): Promise<void> {
  if (!_pool) return;
  
  try {
    // Set a timeout in case pool.end() hangs
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Pool close timed out')), timeoutMs);
    });
    
    // Try graceful shutdown first
    await Promise.race([_pool.end(), timeoutPromise]);
    _pool = null;
    console.log('Pool closed successfully');
  } catch (e) {
    console.error('Error ending pool:', e);
    _pool = null; // Force disconnect
  }
}

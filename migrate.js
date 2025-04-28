// Migration script to move data from the old structure to the new normalized schema
const { Pool } = require('pg');
require('dotenv').config();

console.log('Starting migration from JSON blob to normalized schema');

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('Connected to database. Beginning migration...');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if old tables exist
    console.log('Checking for old tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND 
      table_name IN ('processed_stats', 'cached_matches', 'region_status')
    `);
    
    const oldTables = tablesResult.rows.map(row => row.table_name);
    
    if (oldTables.length === 0) {
      console.log('No old tables found. Migration not needed.');
      await client.query('COMMIT');
      return;
    }
    
    console.log(`Found ${oldTables.length} old tables: ${oldTables.join(', ')}`);
    
    // Migrate region status
    if (oldTables.includes('region_status')) {
      console.log('Migrating region status...');
      const regionsResult = await client.query('SELECT * FROM region_status');
      
      for (const region of regionsResult.rows) {
        await client.query(`
          INSERT INTO regions (region_id, name, status, last_updated, error_count, last_error)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (region_id) DO UPDATE SET
            status = $3,
            last_updated = $4,
            error_count = $5,
            last_error = $6
        `, [
          region.region, 
          region.region, // Use region code as name
          region.status,
          region.last_updated,
          region.error_count || 0,
          region.last_error
        ]);
      }
      console.log(`Migrated ${regionsResult.rows.length} regions`);
    }
    
    // Migrate cached matches
    if (oldTables.includes('cached_matches')) {
      console.log('Migrating cached matches...');
      const matchesResult = await client.query('SELECT * FROM cached_matches LIMIT 1000');
      
      for (const match of matchesResult.rows) {
        await client.query(`
          INSERT INTO matches (match_id, region_id, match_data, created_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (match_id) DO NOTHING
        `, [
          match.match_id,
          match.region,
          match.data,
          match.created_at
        ]);
      }
      console.log(`Migrated ${matchesResult.rows.length} matches`);
    }
    
    // Migrate processed stats
    if (oldTables.includes('processed_stats')) {
      console.log('Migrating processed stats...');
      const statsResult = await client.query("SELECT * FROM processed_stats WHERE type = 'compositions'");
      
      let processedCount = 0;
      for (const stat of statsResult.rows) {
        if (!stat.data || !stat.data.compositions) {
          continue;
        }
        
        console.log(`Processing ${stat.data.compositions.length} compositions for ${stat.region}...`);
        
        // Process each composition
        for (const comp of stat.data.compositions) {
          try {
            // Insert composition
            await client.query(`
              INSERT INTO compositions 
              (composition_id, name, icon, count, avg_placement, win_rate, top4_rate, region_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (composition_id) DO NOTHING
            `, [
              comp.id,
              comp.name,
              comp.icon,
              comp.count || 0,
              comp.avgPlacement || 0,
              comp.winRate || 0,
              comp.top4Rate || 0,
              stat.region
            ]);
            
            // Insert entity stats for the composition itself
            await client.query(`
              INSERT INTO entity_stats 
              (entity_id, entity_type, count, avg_placement, win_rate, top4_rate, play_rate, region_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (entity_id, entity_type, region_id) DO NOTHING
            `, [
              comp.id,
              'composition',
              comp.count || 0,
              comp.avgPlacement || 0,
              comp.winRate || 0,
              comp.top4Rate || 0,
              comp.playRate || 0,
              stat.region
            ]);
            
            // Process traits
            if (comp.traits && comp.traits.length > 0) {
              for (const trait of comp.traits) {
                // Determine trait type
                const traitType = trait.id.includes('origin') ? 'origin' : 'class';
                
                // Insert trait
                await client.query(`
                  INSERT INTO traits (trait_id, name, icon, trait_type)
                  VALUES ($1, $2, $3, $4)
                  ON CONFLICT (trait_id) DO NOTHING
                `, [
                  trait.id,
                  trait.name,
                  trait.icon,
                  traitType
                ]);
                
                // Insert composition_traits relation
                await client.query(`
                  INSERT INTO composition_traits 
                  (composition_id, trait_id, tier, num_units, tier_icon)
                  VALUES ($1, $2, $3, $4, $5)
                  ON CONFLICT (composition_id, trait_id) DO NOTHING
                `, [
                  comp.id,
                  trait.id,
                  trait.tier || 0,
                  trait.numUnits || 0,
                  trait.tierIcon || trait.icon
                ]);
                
                // Insert entity stats for trait
                await client.query(`
                  INSERT INTO entity_stats 
                  (entity_id, entity_type, count, avg_placement, win_rate, top4_rate, play_rate, region_id)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                  ON CONFLICT (entity_id, entity_type, region_id) DO NOTHING
                `, [
                  trait.id,
                  'trait',
                  trait.count || 0,
                  trait.avgPlacement || 0,
                  trait.winRate || 0,
                  trait.top4Rate || 0,
                  trait.playRate || 0,
                  stat.region
                ]);
              }
            }
            
            // Process units
            if (comp.units && comp.units.length > 0) {
              for (const unit of comp.units) {
                // Insert unit
                await client.query(`
                  INSERT INTO units (unit_id, name, icon, cost)
                  VALUES ($1, $2, $3, $4)
                  ON CONFLICT (unit_id) DO NOTHING
                `, [
                  unit.id,
                  unit.name,
                  unit.icon,
                  unit.cost
                ]);
                
                // Insert composition_units relation
                await client.query(`
                  INSERT INTO composition_units (composition_id, unit_id, count)
                  VALUES ($1, $2, $3)
                  ON CONFLICT (composition_id, unit_id) DO NOTHING
                `, [
                  comp.id,
                  unit.id,
                  unit.count || 1
                ]);
                
                // Insert entity stats for unit
                await client.query(`
                  INSERT INTO entity_stats 
                  (entity_id, entity_type, count, avg_placement, win_rate, top4_rate, play_rate, region_id)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                  ON CONFLICT (entity_id, entity_type, region_id) DO NOTHING
                `, [
                  unit.id,
                  'unit',
                  unit.count || 0,
                  unit.avgPlacement || 0,
                  unit.winRate || 0,
                  unit.top4Rate || 0,
                  unit.playRate || 0,
                  stat.region
                ]);
                
                // Process items
                if (unit.items && unit.items.length > 0) {
                  for (const item of unit.items) {
                    // Insert item
                    await client.query(`
                      INSERT INTO items (item_id, name, icon, category)
                      VALUES ($1, $2, $3, $4)
                      ON CONFLICT (item_id) DO NOTHING
                    `, [
                      item.id,
                      item.name,
                      item.icon,
                      item.category || null
                    ]);
                    
                    // Insert unit_items relation
                    await client.query(`
                      INSERT INTO unit_items (composition_id, unit_id, item_id, count)
                      VALUES ($1, $2, $3, $4)
                      ON CONFLICT (composition_id, unit_id, item_id) DO NOTHING
                    `, [
                      comp.id,
                      unit.id,
                      item.id,
                      1
                    ]);
                    
                    // Insert entity stats for item
                    await client.query(`
                      INSERT INTO entity_stats 
                      (entity_id, entity_type, count, avg_placement, win_rate, top4_rate, play_rate, region_id)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                      ON CONFLICT (entity_id, entity_type, region_id) DO NOTHING
                    `, [
                      item.id,
                      'item',
                      item.count || 0,
                      item.avgPlacement || 0,
                      item.winRate || 0,
                      item.top4Rate || 0,
                      item.playRate || 0,
                      stat.region
                    ]);
                  }
                }
              }
            }
            
            // Process placement data
            if (comp.placementData && comp.placementData.length > 0) {
              for (const placement of comp.placementData) {
                await client.query(`
                  INSERT INTO placement_data (composition_id, placement, count)
                  VALUES ($1, $2, $3)
                  ON CONFLICT (composition_id, placement) DO NOTHING
                `, [
                  comp.id,
                  placement.placement,
                  placement.count
                ]);
              }
            }
            
            processedCount++;
          } catch (compError) {
            console.error(`Error processing composition ${comp.id}:`, compError);
          }
        }
      }
      
      console.log(`Successfully migrated ${processedCount} compositions`);
    }
    
    await client.query('COMMIT');
    console.log('Migration complete!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);

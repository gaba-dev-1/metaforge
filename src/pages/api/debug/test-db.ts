import type { NextApiRequest, NextApiResponse } from 'next';
import { query, initializeDatabase } from '@/utils/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Display connection string with sensitive parts masked
    const connStr = process.env.NEON_DATABASE_URL || '';
    const maskedStr = connStr.replace(/(postgres:\/\/[^:]+:)[^@]+(@.+)/, '$1****$2');
    console.log('Connection string:', maskedStr);
    
    // Initialize database
    await initializeDatabase();
    
    // Test simple query
    const result = await query('SELECT NOW() as time');
    
    // Check for tables
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tableNames = tables.rows.map(row => row.table_name);
    
    // Check for data in tables
    let tableStats = [];
    
    if (tableNames.includes('compositions')) {
      const comps = await query('SELECT COUNT(*) as count FROM compositions');
      tableStats.push({ table: 'compositions', count: comps.rows[0].count });
    }
    
    if (tableNames.includes('units')) {
      const units = await query('SELECT COUNT(*) as count FROM units');
      tableStats.push({ table: 'units', count: units.rows[0].count });
    }
    
    if (tableNames.includes('traits')) {
      const traits = await query('SELECT COUNT(*) as count FROM traits');
      tableStats.push({ table: 'traits', count: traits.rows[0].count });
    }
    
    if (tableNames.includes('items')) {
      const items = await query('SELECT COUNT(*) as count FROM items');
      tableStats.push({ table: 'items', count: items.rows[0].count });
    }
    
    if (tableNames.includes('entity_stats')) {
      const stats = await query('SELECT entity_type, COUNT(*) FROM entity_stats GROUP BY entity_type');
      tableStats.push({ table: 'entity_stats', counts: stats.rows });
    }
    
    return res.status(200).json({ 
      success: true, 
      time: result.rows[0].time,
      tables: tableNames,
      tableStats
    });
  } 
  catch (error) {
    console.error("API Test error:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

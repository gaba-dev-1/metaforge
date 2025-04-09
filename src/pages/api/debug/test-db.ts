import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Display connection string with sensitive parts masked
    const connStr = process.env.NEON_DATABASE_URL || '';
    const maskedStr = connStr.replace(/(postgres:\/\/[^:]+:)[^@]+(@.+)/, '$1****$2');
    console.log('Connection string:', maskedStr);
    
    const pool = new Pool({
      connectionString: process.env.NEON_DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    // Test simple query
    const result = await pool.query('SELECT NOW() as time');
    
    // Check for tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tableNames = tables.rows.map(row => row.table_name);
    
    // Check for data in processed_stats if it exists
    let dataCount = [];
    if (tableNames.includes('processed_stats')) {
      const data = await pool.query(`
        SELECT type, region, COUNT(*) 
        FROM processed_stats 
        GROUP BY type, region
      `);
      dataCount = data.rows;
    }
    
    return res.status(200).json({ 
      success: true, 
      time: result.rows[0].time,
      tables: tableNames,
      dataCount
    });
  } 
  catch (error) {
    console.error("API Test error:", error);
    return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
    });
    }
}

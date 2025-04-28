import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeDatabase, insertSampleData } from '@/utils/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Initialize database with schema
    await initializeDatabase();
    
    // Insert sample data
    await insertSampleData();
    
    return res.status(200).json({ 
      success: true,
      message: "Database setup complete with sample data"
    });
  } catch (error) {
    console.error("API Setup error:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

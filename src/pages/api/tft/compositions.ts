import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeDatabase, getCompositions, insertSampleData } from '@/utils/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Initialize database if needed
    await initializeDatabase();
    
    const { 
      region = 'all',
      page = '1',
      limit = '20',
      summary = ''
    } = req.query;
    
    // Parse pagination parameters
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    
    // Get the compositions with pagination
    const compositionsData = await getCompositions(
      region as string, 
      pageNum, 
      limitNum
    );
    
    if (compositionsData) {
      // If summary requested, return just the summary
      if (summary === 'true') {
        // Set cache headers
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json({
          summary: compositionsData.summary,
          region: compositionsData.region
        });
      }
      
      // Set cache headers
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(compositionsData);
    }
    
    // No data - insert sample data
    console.log('No compositions data available, inserting sample data');
    await insertSampleData();
    
    // Get the sample data we just inserted
    const sampleData = await getCompositions(region as string, pageNum, limitNum);
    
    if (sampleData) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(sampleData);
    }
    
    return res.status(404).json({ error: 'No processed data available and failed to create sample data' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

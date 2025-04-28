import type { NextApiRequest, NextApiResponse } from 'next';
import { 
  initializeDatabase,
  getCompositions, 
  getCachedMatches, 
  getRegionStatuses,
  insertSampleData
} from '@/utils/db';
import { ProcessedMatch } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProcessedMatch[] | { error: string }>
) {
  try {
    // Initialize database if needed
    await initializeDatabase();
    
    // Get region parameter
    const { region = 'all' } = req.query;
    
    // First try to get processed data
    const cachedData = await getCompositions(region as string);
    
    if (cachedData && cachedData.compositions.length > 0) {
      // Get region statuses for client display
      const regionStatuses = await getRegionStatuses();
      
      // Set cache headers for better performance
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
      
      // We need to return an array of processed matches for compatibility with existing code
      return res.status(200).json(
        cachedData.compositions.map((comp: any) => ({
          id: comp.id || 'unknown',
          region: region as string || 'unknown',
          participants: [] // Empty participants as we don't need them anymore
        }))
      );
    }
    
    // If no processed data, try returning raw match data
    const matches = await getCachedMatches(region as string);
    
    if (matches && matches.length > 0) {
      // Set cache headers
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(matches);
    }
    
    // No data available - insert sample data and return it
    console.log('No data available, inserting sample data');
    await insertSampleData();
    
    // Get the sample data we just inserted
    const sampleData = await getCompositions(region as string);
    
    if (sampleData && sampleData.compositions.length > 0) {
      return res.status(200).json(
        sampleData.compositions.map((comp: any) => ({
          id: comp.id || 'sample-id',
          region: region as string || 'all',
          participants: [] // Empty participants for sample data
        }))
      );
    }
    
    // If all else fails, return error
    return res.status(404).json({ error: 'No cached data available and failed to create sample data' });
  } catch (error) {
    console.error("API Error:", error);
    
    return res.status(500).json({ 
      error: error instanceof Error ? 
        `Failed to process match data: ${error.message}` : 
        'Unknown error processing match data'
    });
  }
}

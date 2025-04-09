import type { NextApiRequest, NextApiResponse } from 'next';
import { processRegion } from '@/utils/api';
import { processMatchData } from '@/utils/dataProcessing';
import { 
  initializeDatabase, 
  saveProcessedStats, 
  cleanupOldData 
} from '@/utils/db';

// Ensure API key doesn't expire during execution
export const config = {
  maxDuration: 300, // 5 minutes
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify cron secret for security
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Starting data refresh job');
    
    // Initialize database if needed
    await initializeDatabase();
    
    // Process each region with smaller number of matches for refresh
    const regions = ['NA', 'EUW', 'KR', 'BR', 'JP'];
    const matchesPerRegion = 30; // Reduced to avoid rate limits
    const allMatches = [];
    
    for (const region of regions) {
      console.log(`Processing region ${region}`);
      
      // Process region data - this also saves matches to database
      const matches = await processRegion(region as any, matchesPerRegion);
      allMatches.push(...matches);
      
      // Skip processing if insufficient matches
      if (matches.length < 5) {
        console.log(`Insufficient matches for ${region}, skipping stats processing`);
        continue;
      }
      
      // Save region-specific data
      const regionData = processMatchData(matches, region);
      await saveProcessedStats('compositions', region, regionData);
      
      // Process detailed entity data for this region
      const entityTypes = ['units', 'items', 'traits', 'comps'];
      for (const type of entityTypes) {
        await saveProcessedStats(type, region, {
          entities: regionData.compositions,
          region: region
        });
      }
      
      console.log(`Region ${region} processed: ${matches.length} matches`);
    }

    // Skip global processing if insufficient matches
    if (allMatches.length < 20) {
      console.log('Insufficient total matches, skipping global stats processing');
      return res.status(200).json({ 
        success: true,
        message: 'Job completed, but insufficient matches for global stats',
        matchCount: allMatches.length
      });
    }
    
    // Process and save global data
    const globalData = processMatchData(allMatches, 'all');
    await saveProcessedStats('compositions', 'all', globalData);
    
    // Process detailed entity data for global
    const entityTypes = ['units', 'items', 'traits', 'comps'];
    for (const type of entityTypes) {
      await saveProcessedStats(type, 'all', {
        entities: globalData.compositions,
        region: 'all'
      });
    }
    
    // Clean up old data
    await cleanupOldData(7); // Keep data for 7 days
    
    console.log(`Data refresh completed: ${allMatches.length} total matches`);
    
    return res.status(200).json({ 
      success: true,
      matchCount: allMatches.length 
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

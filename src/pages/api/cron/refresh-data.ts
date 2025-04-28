import type { NextApiRequest, NextApiResponse } from 'next';
import { processAllRegions, processAndSaveStats } from '@/utils/dataFetcher';
import { destroyRateLimiters } from '@/utils/rateLimiter';
import { withTransaction, initializeDatabase } from '@/utils/db';

// Set extended execution time
export const config = {
  maxDuration: 300, // 5 minute maximum execution time
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify cron secret for security
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();

  try {
    console.log('🚀 Starting data refresh job');
    
    // Initialize database
    await initializeDatabase();
    
    // Get match data from all regions
    const { matches, regionMatches } = await processAllRegions();
    
    // Process and save stats
    const statItemCount = await processAndSaveStats(regionMatches);
    
    // Clean up resources
    destroyRateLimiters();
    
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    
    return res.status(200).json({ 
      success: true,
      matchCount: matches.length,
      statItemCount,
      durationSeconds,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Cron job error:', error);
    
    // Try to clean up resources even on failure
    try {
      destroyRateLimiters();
    } catch (cleanupError) {
      console.error('Failed to clean up resources:', cleanupError);
    }
    
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

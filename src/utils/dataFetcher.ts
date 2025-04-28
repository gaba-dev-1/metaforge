import { 
  riotApiClient, 
  REGIONS, 
  processBatch,
  fetchWithApiKey
} from './riotApiClient';

import { 
  updateRegionStatus, 
  batchSaveMatches,
  batchInsert
} from './db';

import { processMatchData } from './dataProcessing';
import { ProcessedMatch } from '@/types';

/**
 * Configuration for massive data processing
 * Optimized for 5000+ matches without timeouts
 */
interface DataFetchConfig {
  matchesPerPlayer: number;     // Matches to fetch per player
  playersPerRegion: number;     // Players to process per region
  regionConcurrency: number;    // Max regions to process in parallel
  maxMatchBatchSize: number;    // Max matches to fetch in parallel
  maxStatsBatchSize: number;    // Max stat items to save in one batch
  dbChunkSize: number;          // DB batch chunk size
  processingBatchSize: number;  // Data processing batch size
  timeout: number;              // API request timeout
}

// Define types for API responses
interface LeagueEntry {
  summonerId: string;
  leaguePoints: number;
}

interface LeagueData {
  entries?: LeagueEntry[];
}

interface SummonerData {
  puuid: string;
  id: string;
  accountId?: string;
  name?: string;
  profileIconId?: number;
  revisionDate?: number;
  summonerLevel?: number;
}

interface MatchData {
  metadata: {
    match_id: string;
  };
  info: {
    participants: {
      placement: number;
      units: {
        character_id: string;
        itemNames?: string[];
      }[];
      traits: {
        name: string;
        style: number;
        num_units: number;
      }[];
    }[];
  };
}

interface ApiError {
  status?: number;
  message?: string;
}

// Optimized default configuration for 5000+ matches
const DEFAULT_CONFIG: DataFetchConfig = {
  matchesPerPlayer: 5,         // 5 matches per player
  playersPerRegion: 200,       // 200 players per region 
  regionConcurrency: 2,        // Process 2 regions in parallel
  maxMatchBatchSize: 50,       // Fetch 50 matches in parallel
  maxStatsBatchSize: 10,       // Max 10 stat items per batch
  dbChunkSize: 5,              // Save 5 items per DB transaction
  processingBatchSize: 250,    // Process 250 matches per batch
  timeout: 15000               // 15 second timeout
};

// Region groupings for parallel processing
const REGION_GROUPS = [
  ['NA', 'BR'],  // Group 1 - Americas
  ['EUW'],       // Group 2 - Europe
  ['KR', 'JP']   // Group 3 - Asia
];

/**
 * Process a single region with optimized configuration
 * Capable of handling 1000+ matches per region
 */
export async function processRegion(
  regionKey: string,
  config: Partial<DataFetchConfig> = {}
): Promise<ProcessedMatch[]> {
  // Merge with defaults
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Get region settings
  const region = REGIONS[regionKey];
  if (!region) {
    console.error(`Invalid region: ${regionKey}`);
    return [];
  }
  
  // Get API endpoints
  const API = riotApiClient.getEndpoints(regionKey);
  if (!API) {
    console.error(`Failed to get API endpoints for ${regionKey}`);
    return [];
  }
  
  try {
    // Update region status to processing
    await updateRegionStatus(regionKey, 'processing');
    console.log(`🔍 Processing region ${regionKey}...`);
    const startTime = Date.now();
    
    // Fetch top players from all tiers
    console.log(`⚡ Fetching league data for ${regionKey}...`);
    
    // Get players from challenger, grandmaster, and master tiers
    const [challengerLeague, grandmasterLeague, masterLeague] = await Promise.all([
      fetchWithApiKey<LeagueData>(API.challenger, {timeoutMs: cfg.timeout, priority: 2}),
      fetchWithApiKey<LeagueData>(API.grandmaster, {timeoutMs: cfg.timeout, priority: 2}),
      fetchWithApiKey<LeagueData>(API.master, {timeoutMs: cfg.timeout, priority: 2})
    ]);
    
    const allPlayers = [
      ...(challengerLeague?.entries || []),
      ...(grandmasterLeague?.entries || []),
      ...(masterLeague?.entries || [])
    ];
    
    if (!allPlayers.length) {
      console.warn(`⚠️ No players found for ${regionKey}`);
      await updateRegionStatus(regionKey, 'degraded', 'No players found');
      return [];
    }
    
    // Get top players by LP
    const topPlayers = allPlayers
      .sort((a, b) => b.leaguePoints - a.leaguePoints)
      .slice(0, cfg.playersPerRegion);
      
    console.log(`🏆 Selected ${topPlayers.length} top players from ${regionKey}`);
    
    // Fetch summoners in optimized parallel batches
    console.log(`👤 Fetching ${topPlayers.length} summoners in parallel...`);
    const summoners = await processBatch<LeagueEntry, SummonerData | null>(
      topPlayers,
      regionKey,
      async (player) => {
        try {
          return await fetchWithApiKey<SummonerData>(API.summoner(player.summonerId), {
            timeoutMs: cfg.timeout,
            priority: 2,
          });
        } catch (error) {
          console.warn(`Failed to fetch summoner ${player.summonerId}:`, error);
          return null;
        }
      },
      {
        concurrency: 10,
        continueOnError: true,
        batchSize: 20
      }
    );
    
    // Type guard function to filter out null values
    const validSummoners = summoners.filter((s): s is SummonerData => s !== null);
    
    if (!validSummoners.length) {
      console.warn(`⚠️ No valid summoners for ${regionKey}`);
      await updateRegionStatus(regionKey, 'degraded', 'No valid summoners');
      return [];
    }
    
    // Fetch match lists in parallel batches
    console.log(`🎮 Fetching match lists for ${validSummoners.length} players...`);
    const matchLists = await processBatch<SummonerData, string[]>(
      validSummoners,
      regionKey,
      async (summoner) => {
        try {
          return await fetchWithApiKey<string[]>(API.matches(summoner.puuid, cfg.matchesPerPlayer), {
            timeoutMs: cfg.timeout,
            priority: 1
          });
        } catch (error) {
          console.warn(`Failed to fetch matches for ${summoner.puuid}:`, error);
          return [];
        }
      },
      {
        concurrency: 10,
        continueOnError: true,
        batchSize: 20
      }
    );
    
    // Efficiently deduplicate match IDs
    const uniqueMatchIds = Array.from(
      new Set(matchLists.flat().filter(Boolean))
    );
    
    console.log(`🎯 Found ${uniqueMatchIds.length} unique matches for ${regionKey}`);
    if (!uniqueMatchIds.length) {
      await updateRegionStatus(regionKey, 'degraded', 'No matches found');
      return [];
    }
    
    // Fetch match details in optimized batches with progress tracking
    console.log(`⚙️ Fetching match details for ${uniqueMatchIds.length} matches...`);
    const allMatches: MatchData[] = [];
    
    // Process in smaller batches to avoid memory issues
    for (let i = 0; i < uniqueMatchIds.length; i += cfg.processingBatchSize) {
      const batchIds = uniqueMatchIds.slice(i, i + cfg.processingBatchSize);
      console.log(`Processing batch ${i/cfg.processingBatchSize + 1}/${Math.ceil(uniqueMatchIds.length/cfg.processingBatchSize)}: ${batchIds.length} matches`);
      
      const batchMatches = await processBatch<string, MatchData | null>(
        batchIds,
        regionKey,
        async (matchId) => {
          try {
            return await fetchWithApiKey<MatchData>(API.matchDetails(matchId), {
              timeoutMs: cfg.timeout,
              priority: 1
            });
          } catch (error) {
            const apiError = error as ApiError;
            if (apiError && apiError.status === 404) {
              // Match not found, ignore silently
              return null;
            }
            console.warn(`Failed to fetch match ${matchId}:`, error);
            return null;
          }
        },
        {
          concurrency: 20,  // Higher concurrency for faster processing
          continueOnError: true,
          batchSize: cfg.maxMatchBatchSize
        }
      );
      
      // Add valid matches to results
      const validMatches = batchMatches.filter((match): match is MatchData => match !== null);
      allMatches.push(...validMatches);
      
      // Save this batch to database right away to prevent memory issues
      const processedBatchMatches = validMatches.map(match => ({
        id: match.metadata.match_id,
        region: regionKey,
        participants: match.info.participants.map((p) => ({
          placement: p.placement,
          units: p.units.map((u) => ({
            name: u.character_id,
            itemNames: u.itemNames || []
          })),
          traits: p.traits
            .filter((t) => t.style > 0)
            .map((t) => ({
              name: t.name,
              tier_current: t.style,
              num_units: t.num_units
            }))
        }))
      }));
      
      // Save batch to database
      const matchesToSave = processedBatchMatches.map(match => ({
        id: match.id,
        region: regionKey,
        data: match
      }));
      
      console.log(`Saving batch of ${matchesToSave.length} matches to database...`);
      await batchSaveMatches(matchesToSave, cfg.dbChunkSize);
      
      // Small pause between batches
      if (i + cfg.processingBatchSize < uniqueMatchIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (!allMatches.length) {
      console.warn(`⚠️ No valid matches for ${regionKey}`);
      await updateRegionStatus(regionKey, 'degraded', 'No valid matches');
      return [];
    }
    
    // Process matches into analysis format
    const processedMatches = allMatches.map(match => ({
      id: match.metadata.match_id,
      region: regionKey,
      participants: match.info.participants.map((p) => ({
        placement: p.placement,
        units: p.units.map((u) => ({
          name: u.character_id,
          itemNames: u.itemNames || []
        })),
        traits: p.traits
          .filter((t) => t.style > 0)
          .map((t) => ({
            name: t.name,
            tier_current: t.style,
            num_units: t.num_units
          }))
      }))
    }));
    
    // Update region status
    await updateRegionStatus(regionKey, 'active');
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`✅ Region ${regionKey} processed: ${processedMatches.length} matches in ${duration}s`);
    
    return processedMatches;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error processing region ${regionKey}:`, error);
    await updateRegionStatus(regionKey, 'error', errorMessage);
    return [];
  }
}

/**
 * Process all regions in optimized parallel groups
 * Designed to handle 5000+ matches total
 */
export async function processAllRegions(
  config: Partial<DataFetchConfig> = {}
): Promise<{
  matches: ProcessedMatch[],
  regionMatches: Record<string, ProcessedMatch[]>
}> {
  const allMatches: ProcessedMatch[] = [];
  const regionMatches: Record<string, ProcessedMatch[]> = {};
  
  // Process each region group in parallel
  console.log(`⭐ Processing ${REGION_GROUPS.length} region groups in parallel...`);
  
  await Promise.all(REGION_GROUPS.map(async (group) => {
    console.log(`⭐ Processing group: ${group.join(', ')}...`);
    
    // Process regions in this group sequentially
    for (const region of group) {
      const matches = await processRegion(region, config);
      
      // Store results
      regionMatches[region] = matches;
      allMatches.push(...matches);
      
      // Wait between regions in same group
      if (group.indexOf(region) < group.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }));
  
  console.log(`📊 Total matches collected: ${allMatches.length}`);
  return { matches: allMatches, regionMatches };
}

/**
 * Process match data and save stats in optimized batches
 * Handles large data volumes efficiently with chunking
 */
export async function processAndSaveStats(
  regionMatches: Record<string, ProcessedMatch[]>,
  config: Partial<DataFetchConfig> = {}
): Promise<number> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Process global and region statistics in batches
  const statsBatch = [];
  let totalStats = 0;
  
  // Process global stats
  const globalMatches = Object.values(regionMatches).flat();
  if (globalMatches.length >= 100) {
    console.log(`🌐 Processing global stats with ${globalMatches.length} matches...`);
    const globalData = processMatchData(globalMatches, 'all');
    
    // Add global stats to batch
    statsBatch.push({
      type: 'compositions', 
      region: 'all', 
      data: globalData
    });
    totalStats++;
    
    // Add entity data
    ['units', 'items', 'traits', 'comps'].forEach(type => {
      statsBatch.push({
        type, 
        region: 'all', 
        data: {
          entities: globalData.compositions,
          region: 'all'
        }
      });
      totalStats++;
    });
  }
  
  // Process regional stats
  for (const [region, matches] of Object.entries(regionMatches)) {
    if (matches.length < 50) continue;
    
    console.log(`🔄 Processing stats for ${region} (${matches.length} matches)...`);
    const processedData = processMatchData(matches, region);
    
    // Add regional stats to batch
    statsBatch.push({
      type: 'compositions', 
      region, 
      data: processedData
    });
    totalStats++;
    
    // Add entity data
    ['units', 'items', 'traits', 'comps'].forEach(type => {
      statsBatch.push({
        type, 
        region, 
        data: {
          entities: processedData.compositions,
          region
        }
      });
      totalStats++;
    });
  }
  
  // Save stats in optimized batches
  if (statsBatch.length > 0) {
    console.log(`💾 Saving ${statsBatch.length} stat items in batches...`);
    
    // Split into smaller batches
    for (let i = 0; i < statsBatch.length; i += cfg.maxStatsBatchSize) {
      const batch = statsBatch.slice(i, i + cfg.maxStatsBatchSize);
      console.log(`Saving batch ${Math.floor(i/cfg.maxStatsBatchSize) + 1}/${Math.ceil(statsBatch.length/cfg.maxStatsBatchSize)}: ${batch.length} items`);
      
      await batchInsert(batch, cfg.dbChunkSize);
      
      // Pause between batches
      if (i + cfg.maxStatsBatchSize < statsBatch.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  return totalStats;
}

/**
 * Complete processing pipeline optimized for 5000+ matches
 * Uses batching and chunking throughout to prevent timeouts
 */
export async function refreshData(
  config: Partial<DataFetchConfig> = {}
): Promise<{
  matchCount: number;
  statItemCount: number;
  durationSeconds: number;
}> {
  const startTime = Date.now();
  
  try {
    // Process all regions
    console.log('🚀 Starting full data refresh...');
    const { matches, regionMatches } = await processAllRegions(config);
    
    // Process and save stats
    console.log(`📊 Processing statistics for ${matches.length} matches...`);
    const statItemCount = await processAndSaveStats(regionMatches, config);
    
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    console.log(`✅ Data refresh completed: ${matches.length} matches, ${statItemCount} stat items in ${durationSeconds}s`);
    
    return {
      matchCount: matches.length,
      statItemCount,
      durationSeconds
    };
  } catch (error) {
    console.error('❌ Data refresh failed:', error);
    
    // Return partial results on error
    return {
      matchCount: 0,
      statItemCount: 0,
      durationSeconds: Math.round((Date.now() - startTime) / 1000)
    };
  }
}

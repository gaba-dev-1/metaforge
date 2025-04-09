import { acquireRateLimit } from '@/utils/rateLimiter';
import { saveMatch, updateRegionStatus } from '@/utils/db';
import { ProcessedMatch } from '@/types';

// Define region endpoints
export const REGIONS: Record<string, any> = {
  NA: { 
    master: 'https://na1.api.riotgames.com/tft/league/v1/master', 
    summoner: 'https://na1.api.riotgames.com/tft/summoner/v1/summoners',
    routing: 'na1',
    continental: 'americas',
    status: 'active'
  },
  EUW: { 
    master: 'https://euw1.api.riotgames.com/tft/league/v1/master', 
    summoner: 'https://euw1.api.riotgames.com/tft/summoner/v1/summoners',
    routing: 'euw1',
    continental: 'europe',
    status: 'active'
  },
  KR: { 
    master: 'https://kr.api.riotgames.com/tft/league/v1/master', 
    summoner: 'https://kr.api.riotgames.com/tft/summoner/v1/summoners',
    routing: 'kr',
    continental: 'asia',
    status: 'active'
  },
  BR: { 
    master: 'https://br1.api.riotgames.com/tft/league/v1/master', 
    summoner: 'https://br1.api.riotgames.com/tft/summoner/v1/summoners',
    routing: 'br1',
    continental: 'americas',
    status: 'active'
  },
  JP: { 
    master: 'https://jp1.api.riotgames.com/tft/league/v1/master', 
    summoner: 'https://jp1.api.riotgames.com/tft/summoner/v1/summoners',
    routing: 'jp1',
    continental: 'asia',
    status: 'active'
  }
};

// Define RegionKey type here to match the one in api.ts
type RegionKey = keyof typeof REGIONS;

// Define interface for API endpoints
interface ApiEndpoints {
  master: string;
  summoner: (id: string) => string;
  matches: (puuid: string) => string;
  matchDetails: (id: string) => string;
}

// Build API endpoints for a region
export const getApiEndpoints = (regionKey: RegionKey): ApiEndpoints | null => {
  const region = REGIONS[regionKey];
  if (!region) return null;
  
  return {
    master: region.master,
    summoner: (id: string) => `${region.summoner}/${id}`,
    matches: (puuid: string) => `https://${region.continental}.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?count=20`,
    matchDetails: (id: string) => `https://${region.continental}.api.riotgames.com/tft/match/v1/matches/${id}`
  };
};

// Define interface for fetch options
interface FetchOptions extends RequestInit {
  maxRetries?: number;
  baseDelay?: number;
  timeout?: number;
}

// Typed fetch function with API key
export const fetchWithApiKey = async (url: string, options: FetchOptions = {}): Promise<any> => {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 1000; // 1 second

  // Determine region for rate limiting
  let region = 'na1'; // Default to NA
  
  // Extract region from URL
  if (url.includes('na1.api.riotgames.com')) region = 'na1';
  else if (url.includes('euw1.api.riotgames.com')) region = 'euw1';
  else if (url.includes('kr.api.riotgames.com')) region = 'kr';
  else if (url.includes('br1.api.riotgames.com')) region = 'br1';
  else if (url.includes('jp1.api.riotgames.com')) region = 'jp1';
  else if (url.includes('americas.api.riotgames.com')) region = 'americas';
  else if (url.includes('europe.api.riotgames.com')) region = 'europe';
  else if (url.includes('asia.api.riotgames.com')) region = 'asia';
  
  // Apply rate limiting
  await acquireRateLimit(region);
  
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);
      
      // Check if API key is set
      if (!process.env.RIOT_API_KEY) {
        throw new Error('RIOT_API_KEY is not set in environment variables');
      }
      
      const response = await fetch(url, {
        headers: { 'X-Riot-Token': process.env.RIOT_API_KEY },
        signal: controller.signal,
        ...options
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return await response.json();
      }
      
      // Handle specific error cases
      if (response.status === 429) {
        // Rate limit - get retry-after header or use exponential backoff
        const retryAfter = response.headers.get('Retry-After') || Math.pow(2, retries) * baseDelay;
        console.warn(`Rate limit hit for ${url}, retrying after ${retryAfter}ms`);
        await new Promise(resolve => setTimeout(resolve, Number(retryAfter)));
        retries++;
        continue;
      }
      
      if (response.status === 504) {
        // Gateway timeout - common with EUW
        console.warn(`Gateway timeout for ${url}, retry ${retries + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * baseDelay));
        retries++;
        continue;
      }
      
      if (response.status >= 500) {
        // Server error - retry with backoff
        console.error(`Server error ${response.status} for ${url}, retry ${retries + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * baseDelay));
        retries++;
        continue;
      }
      
      // API key error
      if (response.status === 403 || response.status === 401) {
        console.error(`API key error (${response.status}) for ${url}`);
        throw new Error(`Invalid Riot API key (${response.status})`);
      }
      
      // Other error, log and return null
      console.error(`Error fetching ${url}: ${response.status}`);
      return null;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.error(`Request timeout for ${url}, retry ${retries + 1}/${maxRetries}`);
      } else {
        console.error(`Failed to fetch ${url}:`, error);
      }
      
      // Implement exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * baseDelay));
      retries++;
    }
  }
  
  console.error(`Max retries (${maxRetries}) exceeded for ${url}`);
  return null;
};

// Define interface for league entries and summoners
interface LeagueEntry {
  summonerId: string;
  leaguePoints: number;
}

interface League {
  entries: LeagueEntry[];
}

interface Summoner {
  puuid: string;
  id: string;
}

// Process one region with rate limiting and better error handling
export const processRegion = async (regionKey: RegionKey, matchesPerRegion: number = 50): Promise<ProcessedMatch[]> => {
  const API = getApiEndpoints(regionKey);
  if (!API) return [];
  
  console.log(`Processing region ${regionKey}...`);
  
  try {
    // Update region status to processing
    await updateRegionStatus(regionKey as string, 'processing');
    
    // Fetch master league
    const league = await fetchWithApiKey(API.master, { 
      maxRetries: 3, 
      timeout: 15000 
    }) as League | null;
    
    if (!league?.entries?.length) {
      console.log(`No league data for ${regionKey}`);
      await updateRegionStatus(regionKey as string, 'degraded', 'No league data available');
      return [];
    }
    
    // Get top players
    const players = league.entries
      .sort((a, b) => b.leaguePoints - a.leaguePoints)
      .slice(0, 4); // Get 4 instead of 3 for resilience
    
    if (!players.length) {
      console.log(`No players found for ${regionKey}`);
      await updateRegionStatus(regionKey as string, 'degraded', 'No players found');
      return [];
    }
    
    // Fetch summoner data with more aggressive timeouts 
    const summonerPromises = players.map(p => 
      fetchWithApiKey(API.summoner(p.summonerId), { 
        timeout: 8000, 
        maxRetries: 2 
      })
    );
    
    const summoners = (await Promise.all(summonerPromises)).filter(Boolean) as Summoner[];
    
    if (!summoners.length) {
      console.log(`No summoner data for ${regionKey}`);
      await updateRegionStatus(regionKey as string, 'degraded', 'No summoner data available');
      return [];
    }
    
    // Fetch match lists with circuit breaker pattern
    let successfulMatches = 0;
    const matchListPromises: string[][] = [];
    
    for (const summoner of summoners) {
      if (successfulMatches >= 2) break; // We have enough match data
      
      const matchList = await fetchWithApiKey(API.matches(summoner.puuid), {
        timeout: 10000,
        maxRetries: 2
      }) as string[] | null;
      
      if (matchList && matchList.length) {
        matchListPromises.push(matchList);
        successfulMatches++;
      }
    }
    
    const matchLists = matchListPromises.filter(Boolean);
    
    // Get unique match IDs
    const allMatchIds = matchLists.flat();
    const uniqueMatches = [...new Set(allMatchIds)].slice(0, matchesPerRegion);
    
    if (!uniqueMatches.length) {
      console.log(`No matches found for ${regionKey}`);
      await updateRegionStatus(regionKey as string, 'degraded', 'No matches found');
      return [];
    }
    
    console.log(`Fetching ${uniqueMatches.length} matches for ${regionKey}...`);
    
    // Fetch match details in smaller batches to avoid rate limits
    const matches: any[] = [];
    const batchSize = 4;
    
    for (let i = 0; i < uniqueMatches.length; i += batchSize) {
      const batchIds = uniqueMatches.slice(i, i + batchSize);
      const batchPromises = batchIds.map(id => 
        fetchWithApiKey(API.matchDetails(id), {
          timeout: 8000,
          maxRetries: 2
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter(Boolean);
      matches.push(...validResults);
      
      // Add a small delay between batches
      if (i + batchSize < uniqueMatches.length) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      // Save each match to database
      for (let j = 0; j < validResults.length; j++) {
        const match = validResults[j];
        if (match && match.metadata?.match_id) {
          await saveMatch(match.metadata.match_id, regionKey as string, match);
        }
      }
    }
    
    // Update region status to active
    await updateRegionStatus(regionKey as string, 'active');
    
    // Process match data
    return matches.map(match => ({
      id: match.metadata.match_id,
      region: regionKey,
      participants: match.info.participants.map((p: any) => ({
        placement: p.placement,
        units: p.units.map((u: any) => ({
          name: u.character_id,
          itemNames: u.itemNames || []
        })),
        traits: p.traits
          .filter((t: any) => t.style > 0)
          .map((t: any) => ({
            name: t.name,
            tier_current: t.style,
            num_units: t.num_units
          }))
      }))
    }));
  } catch (error) {
    console.error(`Error processing region ${regionKey}:`, error);
    // Update region status to error
    await updateRegionStatus(
      regionKey as string, 
      'error', 
      error instanceof Error ? error.message : 'Unknown error'
    );
    return [];
  }
};

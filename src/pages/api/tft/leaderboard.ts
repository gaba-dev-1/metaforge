import type { NextApiRequest, NextApiResponse } from 'next';
import { LeaderboardEntry } from '@/types/auth';

// Riot API key
const RIOT_API_KEY = process.env.RIOT_API_KEY || '';

// Log helper function
const logError = (message: string, error?: any) => {
  console.error(`[TFT/LEADERBOARD] ${message}`, error);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get region from query
    const { region = 'na1' } = req.query;
    
    // Check API key
    if (!RIOT_API_KEY) {
      return res.status(500).json({ error: 'RIOT_API_KEY is not set' });
    }
    
    // Set region routing value
    const regionMapping: Record<string, string> = {
      'na': 'na1',
      'na1': 'na1',
      'euw': 'euw1',
      'euw1': 'euw1',
      'kr': 'kr',
      'jp': 'jp1',
      'br': 'br1',
      'br1': 'br1',
      'las': 'la2',
      'la2': 'la2',
      'lan': 'la1',
      'la1': 'la1',
      'eune': 'eun1',
      'eun1': 'eun1',
      'tr': 'tr1',
      'tr1': 'tr1',
      'oc': 'oc1',
      'oc1': 'oc1',
      'ru': 'ru',
    };
    
    const validRegion = regionMapping[region as string] || 'na1';
    
    // Map regional API endpoints to routing region for account API
    const routingRegionMapping: Record<string, string> = {
      'na1': 'americas',
      'br1': 'americas',
      'la1': 'americas',
      'la2': 'americas',
      'euw1': 'europe',
      'eun1': 'europe',
      'tr1': 'europe',
      'ru': 'europe',
      'kr': 'asia',
      'jp1': 'asia',
      'oc1': 'sea'
    };
    
    const routingRegion = routingRegionMapping[validRegion] || 'americas';
    
    // Get challenger players from Riot API
    try {
      // Try challenger league first
      const challengerResponse = await fetch(
        `https://${validRegion}.api.riotgames.com/tft/league/v1/challenger`,
        {
          headers: {
            'X-Riot-Token': RIOT_API_KEY
          }
        }
      );
      
      // Handle responses for all possible tiers
      if (!challengerResponse.ok) {
        // Try grandmaster if challenger fails
        const grandmasterResponse = await fetch(
          `https://${validRegion}.api.riotgames.com/tft/league/v1/grandmaster`,
          {
            headers: {
              'X-Riot-Token': RIOT_API_KEY
            }
          }
        );
        
        if (!grandmasterResponse.ok) {
          // Try master if grandmaster fails
          const masterResponse = await fetch(
            `https://${validRegion}.api.riotgames.com/tft/league/v1/master`,
            {
              headers: {
                'X-Riot-Token': RIOT_API_KEY
              }
            }
          );
          
          if (!masterResponse.ok) {
            logError(`Failed to fetch leaderboard data for ${validRegion}: ${masterResponse.statusText}`);
            return res.status(masterResponse.status).json({ error: 'Failed to fetch leaderboard data' });
          }
          
          const masterData = await masterResponse.json();
          const entries = masterData.entries || [];
          
          if (!entries.length) {
            return res.status(404).json({ error: 'No leaderboard data found' });
          }
          
          // Pre-process the entries first
          const sortedEntries = entries
            .sort((a: any, b: any) => b.leaguePoints - a.leaguePoints)
            .slice(0, 100);
          
          // Now enrich with player name/tag data
          const leaderboard = await enrichLeaderboardEntries(
            sortedEntries, 
            'MASTER', 
            validRegion, 
            routingRegion
          );
          
          // Cache result for 5 minutes
          res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
          
          return res.status(200).json(leaderboard);
        }
        
        const grandmasterData = await grandmasterResponse.json();
        const gmEntries = grandmasterData.entries || [];
        
        if (!gmEntries.length) {
          return res.status(404).json({ error: 'No leaderboard data found' });
        }
        
        // Pre-process the entries first
        const sortedGmEntries = gmEntries
          .sort((a: any, b: any) => b.leaguePoints - a.leaguePoints)
          .slice(0, 100);
        
        // Now enrich with player name/tag data  
        const gmLeaderboard = await enrichLeaderboardEntries(
          sortedGmEntries, 
          'GRANDMASTER', 
          validRegion, 
          routingRegion
        );
        
        // Cache result for 5 minutes
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        
        return res.status(200).json(gmLeaderboard);
      }
      
      const data = await challengerResponse.json();
      const entries = data.entries || [];
      
      if (!entries.length) {
        return res.status(404).json({ error: 'No leaderboard data found' });
      }
      
      // Pre-process the entries first
      const sortedEntries = entries
        .sort((a: any, b: any) => b.leaguePoints - a.leaguePoints)
        .slice(0, 100);
      
      // Now enrich with player name/tag data
      const leaderboard = await enrichLeaderboardEntries(
        sortedEntries, 
        'CHALLENGER', 
        validRegion, 
        routingRegion
      );
      
      // Cache result for 5 minutes
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      
      return res.status(200).json(leaderboard);
    } catch (error) {
      logError("Riot API Error", error);
      return res.status(500).json({ error: 'Failed to fetch leaderboard data' });
    }
  } catch (error) {
    logError("Leaderboard API Error", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
  
  // Helper function to enrich leaderboard entries with player names and tags
  async function enrichLeaderboardEntries(
    entries: any[], 
    tier: string, 
    region: string,
    routingRegion: string
  ): Promise<LeaderboardEntry[]> {
    try {
      // First, get PUUIDs for all summoners by batching requests
      const summonerPromises = entries.map(async (entry: any, index: number) => {
        try {
          const summonerResponse = await fetch(
            `https://${region}.api.riotgames.com/tft/summoner/v1/summoners/${entry.summonerId}`,
            {
              headers: {
                'X-Riot-Token': RIOT_API_KEY
              }
            }
          );
          
          if (!summonerResponse.ok) {
            return null;
          }
          
          const summonerData = await summonerResponse.json();
          return {
            ...entry,
            rank: index + 1,
            puuid: summonerData.puuid,
            profileIconId: summonerData.profileIconId
          };
        } catch (error) {
          logError(`Error fetching summoner data for ${entry.summonerId}`, error);
          return null;
        }
      });
      
      const summonersWithPuuid = (await Promise.all(summonerPromises)).filter(Boolean);
      
      // Now get account info for each summoner with valid PUUID
      const accountPromises = summonersWithPuuid.map(async (summoner: any) => {
        try {
          const accountResponse = await fetch(
            `https://${routingRegion}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${summoner.puuid}`,
            {
              headers: {
                'X-Riot-Token': RIOT_API_KEY
              }
            }
          );
          
          if (!accountResponse.ok) {
            // If we can't get account info, return a basic entry
            return {
              summonerId: summoner.summonerId,
              summonerName: summoner.summonerName || "Unknown",
              tagLine: "",
              rank: summoner.rank,
              leaguePoints: summoner.leaguePoints || 0,
              wins: summoner.wins || 0,
              losses: summoner.losses || 0,
              tier: tier,
              division: "",
              profileIconId: summoner.profileIconId,
              region: region
            };
          }
          
          const accountData = await accountResponse.json();
          
          return {
            summonerId: summoner.summonerId,
            summonerName: accountData.gameName || summoner.summonerName,
            tagLine: accountData.tagLine || "",
            rank: summoner.rank,
            leaguePoints: summoner.leaguePoints || 0,
            wins: summoner.wins || 0,
            losses: summoner.losses || 0,
            tier: tier,
            division: "",
            profileIconId: summoner.profileIconId,
            region: region
          };
        } catch (error) {
          logError(`Error fetching account data for ${summoner.puuid}`, error);
          
          // Return basic data if account fetch fails
          return {
            summonerId: summoner.summonerId,
            summonerName: summoner.summonerName || "Unknown",
            tagLine: "",
            rank: summoner.rank,
            leaguePoints: summoner.leaguePoints || 0,
            wins: summoner.wins || 0,
            losses: summoner.losses || 0,
            tier: tier,
            division: "",
            profileIconId: summoner.profileIconId,
            region: region
          };
        }
      });
      
      const enrichedEntries = await Promise.all(accountPromises);
      return enrichedEntries as LeaderboardEntry[];
    } catch (error) {
      logError("Error enriching leaderboard entries", error);
      
      // Fall back to basic entries if enrichment fails
      return entries.map((entry: any, index: number) => ({
        summonerId: entry.summonerId || "",
        summonerName: entry.summonerName || "Unknown",
        tagLine: "",
        rank: index + 1,
        leaguePoints: entry.leaguePoints || 0,
        wins: entry.wins || 0,
        losses: entry.losses || 0,
        tier: tier,
        division: "",
        region: region
      }));
    }
  }
}

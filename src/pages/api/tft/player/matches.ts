import type { NextApiRequest, NextApiResponse } from 'next';
import { MatchHistoryEntry } from '@/types/auth';

// Riot API key
const RIOT_API_KEY = process.env.RIOT_API_KEY || '';

// Log helper function
const logError = (message: string, error?: any) => {
  console.error(`[TFT/PLAYER/MATCHES] ${message}`, error);
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
    // Get PUUID from query
    const { puuid, region = 'americas', count = '10' } = req.query;
    
    if (!puuid) {
      return res.status(400).json({ error: 'PUUID is required' });
    }
    
    // Check API key
    if (!RIOT_API_KEY) {
      return res.status(500).json({ error: 'RIOT_API_KEY is not set' });
    }
    
    // Set region routing value
    const regionRouting = region === 'kr' || region === 'jp1' ? 'asia' : 
                          region === 'euw1' ? 'europe' : 
                          'americas';
    
    // Get match IDs from Riot API
    try {
      // First get match IDs
      const matchIdsResponse = await fetch(
        `https://${regionRouting}.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?count=${count}`,
        {
          headers: {
            'X-Riot-Token': RIOT_API_KEY
          }
        }
      );
      
      if (!matchIdsResponse.ok) {
        logError(`Failed to fetch match IDs: ${matchIdsResponse.statusText}`);
        return res.status(matchIdsResponse.status).json({ error: 'Failed to fetch match IDs' });
      }
      
      const matchIds = await matchIdsResponse.json();
      
      if (!matchIds.length) {
        return res.status(200).json([]);
      }
      
      // Fetch match details for each match
      const matchDetails = await Promise.all(
        matchIds.map(async (matchId: string) => {
          try {
            const matchResponse = await fetch(
              `https://${regionRouting}.api.riotgames.com/tft/match/v1/matches/${matchId}`,
              {
                headers: {
                  'X-Riot-Token': RIOT_API_KEY
                }
              }
            );
            
            if (!matchResponse.ok) {
              logError(`Failed to fetch match details for ${matchId}: ${matchResponse.statusText}`);
              return null;
            }
            
            return await matchResponse.json();
          } catch (error) {
            logError(`Failed to fetch match ${matchId}`, error);
            return null;
          }
        })
      );
      
      // Process match details to get player data
      const matchArray = matchDetails.filter(Boolean);
      const processedMatches = matchArray.map(match => {
        // Find participant with the given PUUID
        const participant = match.info.participants.find((p: any) => p.puuid === puuid);
        
        if (!participant) {
          return null;
        }
        
        return {
          matchId: match.metadata.match_id,
          queueId: match.info.queue_id,
          gameType: match.info.tft_game_type,
          gameCreation: match.info.game_datetime,
          gameDuration: match.info.game_length,
          gameVersion: match.info.game_version,
          mapId: match.info.tft_set_number,
          placement: participant.placement,
          level: participant.level,
          augments: participant.augments || [],
          traits: participant.traits || [],
          units: participant.units || [],
          companions: participant.companion
        };
      }).filter(Boolean) as MatchHistoryEntry[];
      
      // Cache result for 5 minutes
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      
      return res.status(200).json(processedMatches);
    } catch (error) {
      logError("Riot API Error", error);
      return res.status(500).json({ error: 'Failed to fetch match history' });
    }
  } catch (error) {
    logError("Match History API Error", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

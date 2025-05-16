import type { NextApiRequest, NextApiResponse } from 'next';
import { PlayerStats } from '@/types/auth';

// Riot API key
const RIOT_API_KEY = process.env.RIOT_API_KEY || '';

// Log helper function
const logError = (message: string, error?: any) => {
  console.error(`[TFT/PLAYER/STATS] ${message}`, error);
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
    // Get summoner ID from query
    const { summonerId, region = 'na1' } = req.query;
    
    if (!summonerId) {
      return res.status(400).json({ error: 'Summoner ID is required' });
    }
    
    // Check API key
    if (!RIOT_API_KEY) {
      return res.status(500).json({ error: 'RIOT_API_KEY is not set' });
    }
    
    // Get region endpoint
    const regionEndpoint = region === 'kr' ? 'kr' : 
                           region === 'jp1' ? 'jp1' :
                           region === 'euw1' ? 'euw1' : 
                           'na1';
    
    // Get player stats from Riot API
    try {
      const response = await fetch(
        `https://${regionEndpoint}.api.riotgames.com/tft/league/v1/entries/by-summoner/${summonerId}`,
        {
          headers: {
            'X-Riot-Token': RIOT_API_KEY
          }
        }
      );
      
      if (!response.ok) {
        logError(`Failed to fetch player stats: ${response.statusText}`);
        return res.status(response.status).json({ error: 'Failed to fetch player stats' });
      }
      
      const data = await response.json();
      
      // Find ranked TFT entry
      const rankedEntry = data.find((entry: any) => entry.queueType === 'RANKED_TFT');
      
      if (!rankedEntry) {
        return res.status(404).json({ error: 'No ranked TFT stats found' });
      }
      
      // Calculate win rate
      const wins = rankedEntry.wins || 0;
      const losses = rankedEntry.losses || 0;
      const totalGames = wins + losses;
      const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
      
      // Format player stats
      const playerStats: PlayerStats = {
        summonerId: rankedEntry.summonerId || '',
        summonerName: rankedEntry.summonerName || '',
        tagLine: '', // Not available in this API
        tier: rankedEntry.tier || '',
        rank: rankedEntry.rank || '',
        leaguePoints: rankedEntry.leaguePoints || 0,
        wins,
        losses,
        winRate,
        hotStreak: rankedEntry.hotStreak || false,
        veteran: rankedEntry.veteran || false,
        freshBlood: rankedEntry.freshBlood || false,
        inactive: rankedEntry.inactive || false,
        miniSeries: rankedEntry.miniSeries
      };
      
      // Cache result for 5 minutes
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      
      return res.status(200).json(playerStats);
    } catch (error) {
      logError("Riot API Error", error);
      return res.status(500).json({ error: 'Failed to fetch player stats' });
    }
  } catch (error) {
    logError("Player Stats API Error", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

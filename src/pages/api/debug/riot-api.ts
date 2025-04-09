import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check if API key is set
    if (!process.env.RIOT_API_KEY) {
      return res.status(400).json({ 
        error: "RIOT_API_KEY not set in environment variables" 
      });
    }
    
    // Test API connection
    console.log("Testing with key:", `${process.env.RIOT_API_KEY.substring(0, 8)}...`);
    
    const response = await fetch('https://na1.api.riotgames.com/tft/league/v1/master', {
      headers: { 'X-Riot-Token': process.env.RIOT_API_KEY }
    });
    
    if (response.ok) {
      const data = await response.json();
      return res.status(200).json({ 
        success: true,
        entries: data.entries?.length || 0
      });
    } else {
      return res.status(response.status).json({
        error: `API returned ${response.status}: ${response.statusText}`,
        details: await response.text()
      });
    }
  } 
  catch (error) {
    console.error("API Test error:", error);
    return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
    });
    }
}

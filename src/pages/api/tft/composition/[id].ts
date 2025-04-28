import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeDatabase, getComposition } from '@/utils/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Initialize database if needed
    await initializeDatabase();
    
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid composition ID' });
    }
    
    // Get the composition by ID
    const composition = await getComposition(id);
    
    if (composition) {
      // Set cache headers
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(composition);
    }
    
    return res.status(404).json({ error: 'Composition not found' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

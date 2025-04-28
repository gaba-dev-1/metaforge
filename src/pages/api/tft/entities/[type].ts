import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeDatabase, getEntities, getEntityData, insertSampleData } from '@/utils/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Initialize database if needed
    await initializeDatabase();
    
    const { 
      type, 
      id, 
      region = 'all',
      page = '1',
      limit = '50'
    } = req.query;
    
    // Validate type
    const validTypes = ['units', 'items', 'traits', 'comps'];
    if (!type || !validTypes.includes(type as string)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }
    
    // Convert plural to singular for the database
    const entityType = type === 'comps' ? 'composition' : (type as string).slice(0, -1);
    
    // Parse pagination parameters
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    
    // If ID is provided, get specific entity
    if (id) {
      const entityData = await getEntityData(entityType, id as string, region as string);
      
      if (entityData) {
        // Set cache headers
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json(entityData);
      }
      
      return res.status(404).json({ error: `${entityType} not found` });
    }
    
    // Otherwise, get list of entities with pagination
    const entities = await getEntities(entityType, region as string, pageNum, limitNum);
    
    if (entities) {
      // Set cache headers
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(entities);
    }
    
    // No data - insert sample data
    console.log(`No ${type} data available, inserting sample data`);
    await insertSampleData();
    
    // Get the sample data we just inserted
    const sampleData = await getEntities(entityType, region as string, pageNum, limitNum);
    
    if (sampleData) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(sampleData);
    }
    
    return res.status(404).json({ error: `No ${type} data available and failed to create sample data` });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

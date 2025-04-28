/**
 * High-performance API client for Riot Games API with advanced retry, batching, and throttling
 */
import {
  acquireRateLimit,
  releaseRateLimit,
  recordRateLimitMetrics,
  calculateBackoff,
  getRetryConfig,
  ROUTING_REGIONS,
  REGION_TO_CONTINENTAL
} from './rateLimiter';

// API response cache with TTLs
interface CacheEntry<T> {
  data: T;
  expires: number;
}

// Request options with advanced settings
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
  priority?: number;
  maxRetries?: number;
  bypassCache?: boolean;
  cacheTtlMs?: number;
  tags?: string[];
}

// Regional endpoints
export interface RegionalEndpoints {
  master: string;
  grandmaster: string;  // Added endpoint
  challenger: string;   // Added endpoint
  summoner: (id: string) => string;
  summonerByName: (name: string) => string;
  matches: (puuid: string, count?: number) => string;
  matchDetails: (id: string) => string;
  league: (queue: string) => string;
}

// API response with metadata
export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  duration: number;
  fromCache: boolean;
  retries: number;
}

// Region configurations
export const REGIONS: Record<string, {
  id: string;
  shortName: string;
  displayName: string;
  routing: string;
  continental: string;
  concurrency: number;
  batchSize: number;
}> = {
  'NA': {
    id: 'NA',
    shortName: 'na',
    displayName: 'North America',
    routing: 'na1',
    continental: 'americas',
    concurrency: 6,
    batchSize: 10
  },
  'EUW': {
    id: 'EUW',
    shortName: 'euw',
    displayName: 'Europe West',
    routing: 'euw1',
    continental: 'europe',
    concurrency: 6,
    batchSize: 10
  },
  'KR': {
    id: 'KR',
    shortName: 'kr',
    displayName: 'Korea',
    routing: 'kr',
    continental: 'asia',
    concurrency: 6,
    batchSize: 10
  },
  'BR': {
    id: 'BR',
    shortName: 'br',
    displayName: 'Brazil',
    routing: 'br1',
    continental: 'americas',
    concurrency: 4,
    batchSize: 8
  },
  'JP': {
    id: 'JP',
    shortName: 'jp',
    displayName: 'Japan',
    routing: 'jp1',
    continental: 'asia',
    concurrency: 4,
    batchSize: 8
  }
};

/**
 * High-performance Riot API client with advanced features
 */
export class RiotApiClient {
  private apiKey: string;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private inFlightRequests: Map<string, Promise<any>> = new Map();
  private metrics: {
    requests: number;
    cacheHits: number;
    errors: Record<number, number>;
    totalDuration: number;
    batchedRequests: number;
    lastUpdated: number;
  };
  private static instance: RiotApiClient;
  
  private constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.RIOT_API_KEY || '';
    this.metrics = {
      requests: 0,
      cacheHits: 0,
      errors: {},
      totalDuration: 0,
      batchedRequests: 0,
      lastUpdated: Date.now()
    };
    
    // Clean up cache every minute
    setInterval(() => this.cleanupCache(), 60000);
  }
  
  public static getInstance(apiKey?: string): RiotApiClient {
    if (!RiotApiClient.instance) {
      RiotApiClient.instance = new RiotApiClient(apiKey);
    }
    return RiotApiClient.instance;
  }
  
  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} expired cache entries`);
    }
  }
  
  /**
   * Generate cache key from URL and options
   */
  private getCacheKey(url: string, options?: RequestOptions): string {
    if (!options) return url;
    
    // Include method and sorted tags in cache key
    const method = options.method || 'GET';
    const tags = options.tags?.sort().join(',') || '';
    
    return `${method}:${url}:${tags}`;
  }
  
  /**
   * Extract routing region from URL
   */
  private getRoutingRegion(url: string): string {
    // Extract region from URL
    let region = 'na1'; // Default
    
    if (url.includes('na1.api.riotgames.com')) region = 'na1';
    else if (url.includes('euw1.api.riotgames.com')) region = 'euw1';
    else if (url.includes('kr.api.riotgames.com')) region = 'kr';
    else if (url.includes('br1.api.riotgames.com')) region = 'br1';
    else if (url.includes('jp1.api.riotgames.com')) region = 'jp1';
    else if (url.includes('americas.api.riotgames.com')) region = 'americas';
    else if (url.includes('europe.api.riotgames.com')) region = 'europe';
    else if (url.includes('asia.api.riotgames.com')) region = 'asia';
    
    return region;
  }
  
  /**
   * Check if an API key is valid
   */
  public isValidApiKey(): boolean {
    return typeof this.apiKey === 'string' && this.apiKey.startsWith('RGAPI-') && this.apiKey.length > 20;
  }
  
  /**
   * Set or update API key
   */
  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
  
  /**
   * Create API endpoints for a region
   */
  public getEndpoints(regionKey: string): RegionalEndpoints | null {
    const region = REGIONS[regionKey];
    if (!region) return null;
    
    return {
      master: `https://${region.routing}.api.riotgames.com/tft/league/v1/master`,
      grandmaster: `https://${region.routing}.api.riotgames.com/tft/league/v1/grandmaster`,  // Added endpoint
      challenger: `https://${region.routing}.api.riotgames.com/tft/league/v1/challenger`,    // Added endpoint
      summoner: (id: string) => `https://${region.routing}.api.riotgames.com/tft/summoner/v1/summoners/${id}`,
      summonerByName: (name: string) => `https://${region.routing}.api.riotgames.com/tft/summoner/v1/summoners/by-name/${encodeURIComponent(name)}`,
      matches: (puuid: string, count: number = 100) => 
        `https://${region.continental}.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?count=${count}`,
      matchDetails: (id: string) => 
        `https://${region.continental}.api.riotgames.com/tft/match/v1/matches/${id}`,
      league: (queue: string) => 
        `https://${region.routing}.api.riotgames.com/tft/league/v1/${queue}`
    };
  }
  
  /**
   * Make a request with advanced retry, caching, and rate limiting
   */
  public async request<T>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    if (!this.apiKey) {
      throw new Error('API key not set');
    }
    
    const startTime = Date.now();
    const region = this.getRoutingRegion(url);
    const cacheKey = this.getCacheKey(url, options);
    const retryConfig = getRetryConfig(region);
    const maxRetries = options.maxRetries || retryConfig.maxRetries;
    const timeoutMs = options.timeoutMs || 10000;
    const cacheTtlMs = options.cacheTtlMs || 300000; // 5 min default
    
    // Check cache first unless bypass is explicitly set
    if (!options.bypassCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        this.metrics.cacheHits++;
        this.metrics.lastUpdated = Date.now();
        
        return {
          data: cached.data,
          status: 200,
          headers: { 'x-cache': 'HIT' },
          duration: 0,
          fromCache: true,
          retries: 0
        };
      }
    }
    
    // Check for in-flight requests to deduplicate identical concurrent calls
    const inFlight = this.inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight.then(response => ({
        ...response,
        fromCache: true, // Not technically from cache, but also not a new request
        headers: { ...response.headers, 'x-cache': 'INFLIGHT' }
      }));
    }
    
    // Create the actual request promise
    const requestPromise = this.executeRequest<T>(url, options, region, maxRetries, timeoutMs);
    
    // Store in-flight request
    this.inFlightRequests.set(cacheKey, requestPromise);
    
    try {
      const response = await requestPromise;
      
      // Cache successful responses
      if (response.status >= 200 && response.status < 300) {
        this.cache.set(cacheKey, {
          data: response.data,
          expires: Date.now() + cacheTtlMs
        });
      }
      
      return response;
    } finally {
      // Remove from in-flight requests
      this.inFlightRequests.delete(cacheKey);
    }
  }
  
  /**
   * Execute request with retries and rate limiting
   */
  private async executeRequest<T>(
    url: string, 
    options: RequestOptions, 
    region: string, 
    maxRetries: number,
    timeoutMs: number
  ): Promise<ApiResponse<T>> {
    this.metrics.requests++;
    this.metrics.lastUpdated = Date.now();
    
    const startTime = Date.now();
    let retries = 0;
    let lastError: Error | null = null;
    let lastStatus = 0;
    
    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers: {
        'X-Riot-Token': this.apiKey,
        'Accept': 'application/json',
        ...options.headers
      }
    };
    
    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Content-Type': 'application/json'
      };
    }
    
    // Execute with retries
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let controller: AbortController | null = null;
      let timeoutId: NodeJS.Timeout | null = null;
      
      try {
        // Apply rate limiting
        try {
          await acquireRateLimit(region, timeoutMs, options.priority);
        } catch (rateLimitError) {
          // If we can't get a rate limit token, we'll still try once
          console.warn(`Rate limit acquisition failed, proceeding anyway: ${rateLimitError}`);
        }
        
        // Set up timeout
        controller = new AbortController();
        timeoutId = setTimeout(() => {
          if (controller) controller.abort();
        }, timeoutMs);
        
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal
        });
        
        // Extract response headers
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });
        
        // Clear timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        // Status tracking
        lastStatus = response.status;
        
        // Handle successful response
        if (response.ok) {
          // Parse JSON response
          const data = await response.json();
          
          // Record metrics
          releaseRateLimit(region);
          const duration = Date.now() - startTime;
          this.metrics.totalDuration += duration;
          recordRateLimitMetrics(region, true, duration, retries);
          
          return {
            data,
            status: response.status,
            headers,
            duration,
            fromCache: false,
            retries
          };
        }
        
        // Handle rate limiting with Retry-After header
        if (response.status === 429) {
          const retryAfter = headers['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : calculateBackoff(attempt, region, 429);
          
          console.warn(`Rate limited (429) for ${url}, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          retries++;
          continue;
        }
        
        // Handle server errors
        if (response.status >= 500) {
          const waitTime = calculateBackoff(attempt, region, response.status);
          
          console.warn(`Server error ${response.status} for ${url}, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          retries++;
          continue;
        }
        
        // Fatal API errors (don't retry)
        if (response.status === 403 || response.status === 401) {
          console.error(`API key error (${response.status}) for ${url}`);
          throw new Error(`Invalid Riot API key (${response.status})`);
        }
        
        // Handle resource not found with empty result
        if (response.status === 404) {
          console.warn(`Resource not found (404) for ${url}`);
          
          // Record metrics
          releaseRateLimit(region);
          const duration = Date.now() - startTime;
          this.metrics.totalDuration += duration;
          recordRateLimitMetrics(region, true, duration, retries);
          
          // Return empty data with 404 status
          return {
            data: null as any,
            status: 404,
            headers,
            duration,
            fromCache: false,
            retries
          };
        }
        
        // Other client errors - don't retry
        console.error(`Client error ${response.status} for ${url}`);
        throw new Error(`API error ${response.status}: ${await response.text()}`);
        
      } catch (error) {
        // Clean up timeout if it exists
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        // Handle abort error
        if (error instanceof Error && error.name === 'AbortError') {
          console.error(`Request timeout for ${url}, retry ${attempt + 1}/${maxRetries}`);
          lastError = new Error(`Request timeout after ${timeoutMs}ms`);
        } else {
          console.error(`Failed to fetch ${url}:`, error);
          lastError = error instanceof Error ? error : new Error(String(error));
        }
        
        // Record error in metrics
        if (!this.metrics.errors[lastStatus]) {
          this.metrics.errors[lastStatus] = 0;
        }
        this.metrics.errors[lastStatus]++;
        
        // Only retry if not the last attempt
        if (attempt < maxRetries) {
          const waitTime = calculateBackoff(attempt, region, lastStatus);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
        } else {
          // Record failed metrics
          const duration = Date.now() - startTime;
          recordRateLimitMetrics(region, false, duration, retries);
          
          throw lastError;
        }
      }
    }
    
    // If we exhausted all retries
    throw lastError || new Error(`Max retries (${maxRetries}) exceeded for ${url}`);
  }
  
  /**
   * Process items in batches with controlled concurrency
   */
  public async processBatch<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    options: {
      batchSize?: number;
      concurrency?: number;
      continueOnError?: boolean;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<R[]> {
    const batchSize = options.batchSize || 10;
    const concurrency = options.concurrency || 4;
    const continueOnError = options.continueOnError || false;
    const results: (R | null)[] = new Array(items.length).fill(null);
    
    // Process in sequential batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, Math.min(i + batchSize, items.length));
      const batchIndexes = Array.from(
        { length: batch.length }, 
        (_, index) => i + index
      );
      
      try {
        // Process up to 'concurrency' items at once
        const batchResults = await this.processWithConcurrency<T, R>(
          batch,
          batchIndexes,
          processor,
          concurrency,
          continueOnError
        );
        
        // Record results
        batchResults.forEach((result, batchIndex) => {
          if (result !== undefined) {
            results[i + batchIndex] = result;
          }
        });
        
        // Report progress
        if (options.onProgress) {
          options.onProgress(Math.min(i + batchSize, items.length), items.length);
        }
        
        // Small pause between batches to avoid overwhelming the API
        if (i + batchSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        if (!continueOnError) {
          throw error;
        }
        console.error(`Error processing batch ${i}/${items.length}:`, error);
      }
    }
    
    // Filter out null results if we're continuing on error
    return continueOnError
      ? results.filter((r): r is R => r !== null)
      : (results as R[]);
  }
  
  /**
   * Process items with controlled concurrency
   */
  private async processWithConcurrency<T, R>(
    items: T[],
    indexes: number[],
    processor: (item: T, index: number) => Promise<R>,
    concurrency: number,
    continueOnError: boolean
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let active = 0;
    let nextIndex = 0;
    let errors: Error[] = [];
    
    // Use Promise to control the flow
    return new Promise((resolve, reject) => {
      // Function to start processing an item
      const startNextItem = () => {
        if (nextIndex >= items.length) return;
        
        const index = nextIndex++;
        const originalIndex = indexes[index];
        active++;
        
        processor(items[index], originalIndex)
          .then(result => {
            results[index] = result;
            active--;
            startNextItem();
            
            // Check if we're done
            if (active === 0 && nextIndex >= items.length) {
              if (errors.length > 0 && !continueOnError) {
                reject(errors[0]);
              } else {
                resolve(results.filter(r => r !== undefined));
              }
            }
          })
          .catch(error => {
            active--;
            errors.push(error);
            
            if (!continueOnError) {
              // If we don't continue on error, reject with the first error
              reject(error);
            } else {
              // Otherwise, try the next item
              startNextItem();
              
              // Check if we're done
              if (active === 0 && nextIndex >= items.length) {
                resolve(results.filter(r => r !== undefined));
              }
            }
          });
      };
      
      // Start up to 'concurrency' items
      for (let i = 0; i < Math.min(concurrency, items.length); i++) {
        startNextItem();
      }
      
      // Handle empty batch
      if (items.length === 0) {
        resolve([]);
      }
    });
  }
  
  /**
   * Get API client metrics
   */
  public getMetrics() {
    return { ...this.metrics };
  }
  
  /**
   * Reset metrics
   */
  public resetMetrics() {
    this.metrics = {
      requests: 0,
      cacheHits: 0,
      errors: {},
      totalDuration: 0,
      batchedRequests: 0,
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Clear the entire cache
   */
  public clearCache() {
    this.cache.clear();
  }
  
  /**
   * Get cache stats
   */
  public getCacheStats() {
    const now = Date.now();
    const total = this.cache.size;
    let expired = 0;
    
    for (const entry of this.cache.values()) {
      if (entry.expires < now) {
        expired++;
      }
    }
    
    return {
      total,
      expired,
      active: total - expired,
      hitRate: this.metrics.requests > 0 
        ? (this.metrics.cacheHits / this.metrics.requests) * 100
        : 0
    };
  }
}

// Export singleton instance
export const riotApiClient = RiotApiClient.getInstance();

// Simplified functions for common operations
export async function fetchWithApiKey<T>(url: string, options?: RequestOptions): Promise<T> {
  const response = await riotApiClient.request<T>(url, options);
  return response.data;
}

export function getApiEndpoints(regionKey: string) {
  return riotApiClient.getEndpoints(regionKey);
}

// Process items in batches with optimal settings
export async function processBatch<T, R>(
  items: T[],
  regionKey: string,
  processor: (item: T, index: number) => Promise<R>,
  options: {
    batchSize?: number;
    concurrency?: number;
    continueOnError?: boolean;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  // Get region-specific settings
  const region = REGIONS[regionKey];
  const batchSize = options.batchSize || region?.batchSize || 10;
  const concurrency = options.concurrency || region?.concurrency || 4;
  
  return riotApiClient.processBatch(items, processor, {
    ...options,
    batchSize,
    concurrency
  });
}

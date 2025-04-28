/**
 * Advanced Rate Limiter with adaptive throttling, metrics, and per-region configuration
 * Optimized for Riot Games TFT API rate limits
 */

// Interface for rate limit configuration
interface RateLimitConfig {
  window: number;      // Window in milliseconds
  limit: number;       // Maximum requests in window
  optimistic?: boolean; // Whether to allow requests optimistically
}

// Interface for region configuration 
interface RegionConfig {
  shortTerm: RateLimitConfig;
  longTerm: RateLimitConfig;
  retryConfig?: RetryConfig;
  // Method-specific limits
  methods?: {
    [method: string]: RateLimitConfig;
  };
}

// Interface for retry configuration
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
}

// Limiter status metrics
interface LimiterMetrics {
  capacity: number;        // Total capacity (max requests)
  active: number;          // Currently active requests
  queued: number;          // Queued requests
  dropped: number;         // Dropped requests (exceeded retry)
  avgLatency: number;      // Average latency in ms
  successRate: number;     // Success rate percentage
  retries: number;         // Total retry count
  lastUpdated: number;     // Timestamp of last update
}

/**
 * Advanced bucket-based rate limiter with adaptive handling
 */
export class BucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private pendingPromises: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timestamp: number;
    timeout: NodeJS.Timeout | null;
  }> = [];
  
  private refillIntervalId: NodeJS.Timeout | null = null;
  private metrics: LimiterMetrics;
  private disabled = false;
  private name: string;
  private adaptiveFactor = 1.0;
  
  constructor(
    private readonly config: RateLimitConfig,
    name: string = "default"
  ) {
    this.tokens = config.limit;
    this.lastRefill = Date.now();
    this.name = name;
    
    this.metrics = {
      capacity: config.limit,
      active: 0,
      queued: 0,
      dropped: 0,
      avgLatency: 0,
      successRate: 100,
      retries: 0,
      lastUpdated: Date.now()
    };
    
    // Auto-refill tokens
    this.refillIntervalId = setInterval(() => this.refillTokens(), Math.min(config.window / 10, 500));
  }
  
  /**
   * Refill tokens based on elapsed time and process queue
   */
  private refillTokens(): void {
    if (this.disabled) return;
    
    const now = Date.now();
    const timeElapsed = now - this.lastRefill;
    const refillAmount = (timeElapsed / this.config.window) * this.config.limit;
    
    if (refillAmount > 0) {
      this.tokens = Math.min(this.config.limit, this.tokens + refillAmount);
      this.lastRefill = now;
    }
    
    this.processQueue();
  }
  
  /**
   * Process pending request queue
   */
  private processQueue(): void {
    if (this.disabled || this.pendingPromises.length === 0 || this.tokens < 1) return;
    
    // Sort by timestamp (oldest first)
    this.pendingPromises.sort((a, b) => a.timestamp - b.timestamp);
    
    while (this.tokens >= 1 && this.pendingPromises.length > 0) {
      const pending = this.pendingPromises.shift();
      if (pending) {
        this.tokens -= 1;
        this.metrics.queued--;
        this.metrics.active++;
        
        if (pending.timeout) {
          clearTimeout(pending.timeout);
        }
        
        pending.resolve();
      }
    }
    
    this.metrics.lastUpdated = Date.now();
  }
  
  /**
   * Acquire a rate limit token
   * @param timeoutMs Maximum time to wait in ms
   * @param priority Priority of the request (higher = more important)
   */
  async acquire(timeoutMs: number = 60000, priority: number = 1): Promise<void> {
    if (this.disabled) return Promise.resolve();
    
    // If optimistic mode is enabled and we're within the limit, allow immediately
    if (this.config.optimistic && this.tokens >= 1) {
      this.tokens -= 1;
      this.metrics.active++;
      this.metrics.lastUpdated = Date.now();
      return Promise.resolve();
    }
    
    // Check if expected wait time exceeds timeout
    const expectedWaitTime = this.getEstimatedWaitTime();
    if (expectedWaitTime > timeoutMs) {
      this.metrics.dropped++;
      this.metrics.lastUpdated = Date.now();
      return Promise.reject(
        new Error(`Rate limit wait time ${expectedWaitTime}ms exceeds timeout ${timeoutMs}ms in ${this.name}`)
      );
    }
    
    return new Promise<void>((resolve, reject) => {
      const now = Date.now();
      let timeoutId: NodeJS.Timeout | null = null;
      
      // Create timeout handler
      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          // Remove from queue if still pending
          this.pendingPromises = this.pendingPromises.filter(p => p.resolve !== resolve);
          this.metrics.dropped++;
          this.metrics.queued--;
          this.metrics.lastUpdated = Date.now();
          reject(new Error(`Rate limit timeout after ${timeoutMs}ms in ${this.name}`));
        }, timeoutMs);
      }
      
      // Add to pending queue
      this.pendingPromises.push({
        resolve,
        reject,
        timestamp: now - (priority * 1000), // Higher priority = earlier timestamp
        timeout: timeoutId
      });
      
      this.metrics.queued++;
      this.metrics.lastUpdated = Date.now();
      
      // Try to process immediately
      this.processQueue();
    });
  }
  
  /**
   * Release a token (used when a request is completed)
   */
  release(): void {
    if (this.disabled) return;
    
    this.metrics.active = Math.max(0, this.metrics.active - 1);
    this.metrics.lastUpdated = Date.now();
    
    // Don't add tokens beyond limit
    if (this.tokens < this.config.limit) {
      this.tokens += 0.5; // Partial token return to handle overlapping requests
    }
    
    this.processQueue();
  }
  
  /**
   * Record request metrics
   */
  recordMetrics(success: boolean, latencyMs: number, retries: number = 0): void {
    if (this.disabled) return;
    
    // Update success rate with exponential moving average
    const alpha = 0.1; // Weight for new data point
    const currentSuccessRate = success ? 100 : 0;
    this.metrics.successRate = (1 - alpha) * this.metrics.successRate + alpha * currentSuccessRate;
    
    // Update average latency with exponential moving average
    this.metrics.avgLatency = (1 - alpha) * this.metrics.avgLatency + alpha * latencyMs;
    
    // Update retries
    this.metrics.retries += retries;
    
    // Adjust adaptive factor based on metrics
    this.updateAdaptiveFactor();
    
    this.metrics.lastUpdated = Date.now();
  }
  
  /**
   * Update the adaptive throttling factor
   */
  private updateAdaptiveFactor(): void {
    // Adjust based on success rate
    if (this.metrics.successRate < 70) {
      this.adaptiveFactor = Math.max(0.5, this.adaptiveFactor - 0.1);
    } else if (this.metrics.successRate > 95 && this.metrics.active < this.config.limit * 0.8) {
      this.adaptiveFactor = Math.min(1.2, this.adaptiveFactor + 0.05);
    }
  }
  
  /**
   * Get estimated wait time in ms
   */
  getEstimatedWaitTime(): number {
    if (this.disabled || this.tokens >= 1) return 0;
    
    const queuePosition = this.pendingPromises.length;
    const tokensNeeded = queuePosition + 1 - this.tokens;
    
    if (tokensNeeded <= 0) return 0;
    
    // Calculate time until enough tokens will be available
    const refillRate = this.config.limit / this.config.window;
    return (tokensNeeded / refillRate) * this.adaptiveFactor;
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): LimiterMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Enable or disable this limiter
   */
  setEnabled(enabled: boolean): void {
    this.disabled = !enabled;
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.refillIntervalId) {
      clearInterval(this.refillIntervalId);
      this.refillIntervalId = null;
    }
    
    // Reject all pending requests
    this.pendingPromises.forEach(p => {
      if (p.timeout) {
        clearTimeout(p.timeout);
      }
      p.reject(new Error(`Rate limiter ${this.name} destroyed`));
    });
    
    this.pendingPromises = [];
    this.metrics.dropped += this.metrics.queued;
    this.metrics.queued = 0;
    this.metrics.active = 0;
  }
  
  /**
   * Reset limiter state
   */
  reset(): void {
    this.tokens = this.config.limit;
    this.lastRefill = Date.now();
    this.adaptiveFactor = 1.0;
  }
}

// Updated Region configurations for Riot API with more accurate limits
export const ROUTING_REGIONS: Record<string, RegionConfig> = {
  // Regional APIs with updated limits based on actual Riot API limits
  'na1': {
    // Short-term: Based on tft/match endpoint (250 per 10s)
    shortTerm: { window: 10000, limit: 200, optimistic: true }, // Conservative 80% of actual limit
    // Long-term: Based on tft/summoner endpoint (1600 per 1min)
    longTerm: { window: 60000, limit: 1200 }, // Conservative 75% of actual limit
    retryConfig: { maxRetries: 3, baseDelay: 1000, maxDelay: 10000, jitter: true },
    // Method-specific limits
    methods: {
      'challenger': { window: 10000, limit: 24 }, // 30 per 10s * 80%
      'grandmaster': { window: 10000, limit: 24 }, // 30 per 10s * 80%
      'master': { window: 10000, limit: 24 }, // 30 per 10s * 80%
      'entries': { window: 10000, limit: 200 }, // 250 per 10s * 80%
      'matches': { window: 10000, limit: 480 } // 600 per 10s * 80%
    }
  },
  'euw1': {
    shortTerm: { window: 10000, limit: 200, optimistic: true },
    longTerm: { window: 60000, limit: 1200 },
    retryConfig: { maxRetries: 3, baseDelay: 1000, maxDelay: 10000, jitter: true },
    methods: {
      'challenger': { window: 10000, limit: 24 },
      'grandmaster': { window: 10000, limit: 24 },
      'master': { window: 10000, limit: 24 },
      'entries': { window: 10000, limit: 200 },
      'matches': { window: 10000, limit: 480 }
    }
  },
  'kr': {
    shortTerm: { window: 10000, limit: 200, optimistic: true },
    longTerm: { window: 60000, limit: 1200 },
    retryConfig: { maxRetries: 3, baseDelay: 1000, maxDelay: 10000, jitter: true },
    methods: {
      'challenger': { window: 10000, limit: 24 },
      'grandmaster': { window: 10000, limit: 24 },
      'master': { window: 10000, limit: 24 },
      'entries': { window: 10000, limit: 200 },
      'matches': { window: 10000, limit: 480 }
    }
  },
  'br1': {
    shortTerm: { window: 10000, limit: 200, optimistic: true },
    longTerm: { window: 60000, limit: 1200 },
    retryConfig: { maxRetries: 3, baseDelay: 1000, maxDelay: 10000, jitter: true },
    methods: {
      'challenger': { window: 10000, limit: 24 },
      'grandmaster': { window: 10000, limit: 24 },
      'master': { window: 10000, limit: 24 },
      'entries': { window: 10000, limit: 200 },
      'matches': { window: 10000, limit: 480 }
    }
  },
  'jp1': {
    shortTerm: { window: 10000, limit: 200, optimistic: true },
    longTerm: { window: 60000, limit: 1200 },
    retryConfig: { maxRetries: 3, baseDelay: 1000, maxDelay: 10000, jitter: true },
    methods: {
      'challenger': { window: 10000, limit: 24 },
      'grandmaster': { window: 10000, limit: 24 },
      'master': { window: 10000, limit: 24 },
      'entries': { window: 10000, limit: 200 },
      'matches': { window: 10000, limit: 480 }
    }
  },
  
  // Continental APIs (separate rate limits)
  'americas': {
    shortTerm: { window: 10000, limit: 200, optimistic: true },
    longTerm: { window: 60000, limit: 1200 },
    retryConfig: { maxRetries: 5, baseDelay: 2000, maxDelay: 20000, jitter: true },
    methods: {
      'matches': { window: 10000, limit: 480 } // 600 per 10s * 80%
    }
  },
  'europe': {
    shortTerm: { window: 10000, limit: 200, optimistic: true },
    longTerm: { window: 60000, limit: 1200 },
    retryConfig: { maxRetries: 5, baseDelay: 2000, maxDelay: 20000, jitter: true },
    methods: {
      'matches': { window: 10000, limit: 480 }
    }
  },
  'asia': {
    shortTerm: { window: 10000, limit: 200, optimistic: true },
    longTerm: { window: 60000, limit: 1200 },
    retryConfig: { maxRetries: 5, baseDelay: 2000, maxDelay: 20000, jitter: true },
    methods: {
      'matches': { window: 10000, limit: 480 }
    }
  }
};

// Map regions to their continental routing value
export const REGION_TO_CONTINENTAL: Record<string, string> = {
  'na1': 'americas',
  'br1': 'americas',
  'euw1': 'europe',
  'kr': 'asia',
  'jp1': 'asia'
};

// Region display mapping
export const REGION_DISPLAY: Record<string, string> = {
  'na1': 'NA',
  'euw1': 'EUW',
  'kr': 'KR',
  'br1': 'BR',
  'jp1': 'JP',
  'americas': 'Americas',
  'europe': 'Europe',
  'asia': 'Asia'
};

// Create and manage all rate limiters
class RateLimiterService {
  private limiters: Record<string, {
    shortTerm: BucketRateLimiter,
    longTerm: BucketRateLimiter,
    methods: Record<string, BucketRateLimiter>
  }> = {};
  
  private globalRetryMetrics: {
    attempts: number;
    successes: number;
    failures: number;
    lastUpdated: number;
  } = {
    attempts: 0,
    successes: 0,
    failures: 0,
    lastUpdated: Date.now()
  };
  
  private static instance: RateLimiterService;
  
  private constructor() {
    // Initialize limiters for all regions
    Object.entries(ROUTING_REGIONS).forEach(([region, config]) => {
      const isDevelopment = process.env.NODE_ENV !== 'production';
      
      // In development, increase limits
      const devMultiplier = isDevelopment ? 2 : 1;
      
      this.limiters[region] = {
        shortTerm: new BucketRateLimiter({
          window: config.shortTerm.window,
          limit: config.shortTerm.limit * devMultiplier,
          optimistic: config.shortTerm.optimistic
        }, `${region}-short`),
        
        longTerm: new BucketRateLimiter({
          window: config.longTerm.window,
          limit: config.longTerm.limit * devMultiplier,
          optimistic: false
        }, `${region}-long`),
        
        methods: {}
      };
      
      // Initialize method-specific limiters
      if (config.methods) {
        Object.entries(config.methods).forEach(([method, methodConfig]) => {
          this.limiters[region].methods[method] = new BucketRateLimiter({
            window: methodConfig.window,
            limit: methodConfig.limit * devMultiplier,
            optimistic: methodConfig.optimistic || false
          }, `${region}-${method}`);
        });
      }
      
      // In development, disable if requested
      if (isDevelopment && process.env.DISABLE_RATE_LIMITS === 'true') {
        this.limiters[region].shortTerm.setEnabled(false);
        this.limiters[region].longTerm.setEnabled(false);
        Object.values(this.limiters[region].methods).forEach(limiter => {
          limiter.setEnabled(false);
        });
      }
    });
  }
  
  public static getInstance(): RateLimiterService {
    if (!RateLimiterService.instance) {
      RateLimiterService.instance = new RateLimiterService();
    }
    return RateLimiterService.instance;
  }
  
  /**
   * Acquire a rate limit for a specific region
   * @param region The routing region (na1, euw1, etc.)
   * @param timeoutMs Timeout in milliseconds
   * @param priority Priority (higher = more important)
   * @param method Optional specific API method ('challenger', 'matches', etc.)
   */
  public async acquire(
    region: string, 
    timeoutMs: number = 60000, 
    priority: number = 1,
    method?: string
  ): Promise<void> {
    const normalizedRegion = region.toLowerCase();
    const limiter = this.limiters[normalizedRegion] || this.limiters['na1']; // Default to NA
    
    try {
      this.globalRetryMetrics.attempts++;
      
      // Check method-specific limiter if applicable
      if (method && limiter.methods[method]) {
        try {
          await limiter.methods[method].acquire(timeoutMs, priority + 1);
        } catch (methodError) {
          console.warn(`Method-specific rate limit exceeded for ${method} in ${region}, continuing with global checks`);
        }
      }
      
      // Try short-term limit with longer timeout
      try {
        await limiter.shortTerm.acquire(Math.min(timeoutMs, 10000), priority);
      } catch (shortTermError) {
        // This is normal behavior - don't warn, just fall back to long-term
      }
      
      // Always check long-term limit
      await limiter.longTerm.acquire(timeoutMs, priority);
      
      this.globalRetryMetrics.successes++;
      this.globalRetryMetrics.lastUpdated = Date.now();
      
      return Promise.resolve();
    } catch (error) {
      this.globalRetryMetrics.failures++;
      this.globalRetryMetrics.lastUpdated = Date.now();
      
      console.warn(`Rate limit exceeded for ${region}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Release rate limit tokens for a region
   * Should be called after a successful API call
   */
  public release(region: string, method?: string): void {
    const normalizedRegion = region.toLowerCase();
    const limiter = this.limiters[normalizedRegion] || this.limiters['na1'];
    
    // Release method-specific limiter if applicable
    if (method && limiter.methods[method]) {
      limiter.methods[method].release();
    }
    
    limiter.shortTerm.release();
    limiter.longTerm.release();
  }
  
  /**
   * Record metrics for a request to a region
   */
  public recordMetrics(
    region: string, 
    success: boolean, 
    latencyMs: number, 
    retries: number = 0,
    method?: string
  ): void {
    const normalizedRegion = region.toLowerCase();
    const limiter = this.limiters[normalizedRegion] || this.limiters['na1'];
    
    // Record for method-specific limiter if applicable
    if (method && limiter.methods[method]) {
      limiter.methods[method].recordMetrics(success, latencyMs, retries);
    }
    
    limiter.shortTerm.recordMetrics(success, latencyMs, retries);
    limiter.longTerm.recordMetrics(success, latencyMs, retries);
  }
  
  /**
   * Get rate limit metrics for all regions
   */
  public getMetrics(): Record<string, {
    shortTerm: LimiterMetrics;
    longTerm: LimiterMetrics;
    methods: Record<string, LimiterMetrics>;
  }> {
    const metrics: Record<string, any> = {};
    
    Object.entries(this.limiters).forEach(([region, limiter]) => {
      const methodMetrics: Record<string, LimiterMetrics> = {};
      
      // Collect method-specific metrics
      Object.entries(limiter.methods).forEach(([method, methodLimiter]) => {
        methodMetrics[method] = methodLimiter.getMetrics();
      });
      
      metrics[region] = {
        shortTerm: limiter.shortTerm.getMetrics(),
        longTerm: limiter.longTerm.getMetrics(),
        methods: methodMetrics
      };
    });
    
    return metrics;
  }
  
  /**
   * Get retry metrics
   */
  public getRetryMetrics() {
    return { ...this.globalRetryMetrics };
  }
  
  /**
   * Get the retry configuration for a region
   */
  public getRetryConfig(region: string): RetryConfig {
    const normalizedRegion = region.toLowerCase();
    const config = ROUTING_REGIONS[normalizedRegion]?.retryConfig || {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      jitter: true
    };
    
    return config;
  }
  
  /**
   * Calculate a backoff delay with jitter
   */
  public calculateBackoff(attempt: number, region: string, statusCode: number = 0): number {
    const config = this.getRetryConfig(region);
    
    // Base delay calculation
    let delay = Math.min(
      config.maxDelay,
      config.baseDelay * Math.pow(1.5, attempt)
    );
    
    // Adjust for status code
    if (statusCode === 429) {
      delay = Math.min(config.maxDelay, delay * 2); // Double for rate limits
    } else if (statusCode >= 500) {
      delay = Math.min(config.maxDelay, delay * 1.5); // 1.5x for server errors
    }
    
    // Add jitter if configured
    if (config.jitter) {
      // Add ±30% randomness
      const jitterFactor = 0.7 + (Math.random() * 0.6);
      delay = Math.floor(delay * jitterFactor);
    }
    
    return delay;
  }
  
  /**
   * Clean up all rate limiters
   */
  public destroy(): void {
    Object.values(this.limiters).forEach(limiter => {
      limiter.shortTerm.destroy();
      limiter.longTerm.destroy();
      Object.values(limiter.methods).forEach(methodLimiter => {
        methodLimiter.destroy();
      });
    });
  }
}

// Export singleton instance
export const rateLimiterService = RateLimiterService.getInstance();

// Helper functions for API requests
export async function acquireRateLimit(
  region: string, 
  timeoutMs?: number, 
  priority?: number,
  method?: string
): Promise<void> {
  return rateLimiterService.acquire(region, timeoutMs, priority, method);
}

export function releaseRateLimit(region: string, method?: string): void {
  rateLimiterService.release(region, method);
}

export function recordRateLimitMetrics(
  region: string, 
  success: boolean, 
  latencyMs: number, 
  retries: number = 0,
  method?: string
): void {
  rateLimiterService.recordMetrics(region, success, latencyMs, retries, method);
}

export function calculateBackoff(attempt: number, region: string, statusCode: number = 0): number {
  return rateLimiterService.calculateBackoff(attempt, region, statusCode);
}

export function getRetryConfig(region: string): RetryConfig {
  return rateLimiterService.getRetryConfig(region);
}

export function getRegionMetrics() {
  return rateLimiterService.getMetrics();
}

export function getGlobalRetryMetrics() {
  return rateLimiterService.getRetryMetrics();
}

export function destroyRateLimiters(): void {
  rateLimiterService.destroy();
}

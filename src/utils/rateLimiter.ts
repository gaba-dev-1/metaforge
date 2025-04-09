export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private timestamps: number[] = [];
  private pendingPromises: { resolve: () => void }[] = [];
  private intervalId: NodeJS.Timeout | null = null;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Start cleanup interval
    this.intervalId = setInterval(() => this.cleanup(), windowMs);
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Remove expired timestamps
    this.timestamps = this.timestamps.filter(time => time > windowStart);
    
    // Check if we can resolve pending promises
    this.checkPending();
  }

  private checkPending(): void {
    // If we have capacity and pending requests, resolve the oldest one
    while (this.timestamps.length < this.maxRequests && this.pendingPromises.length > 0) {
      const pending = this.pendingPromises.shift();
      if (pending) {
        this.timestamps.push(Date.now());
        pending.resolve();
      }
    }
  }

  async acquire(): Promise<void> {
    // Clean up old timestamps first
    const now = Date.now();
    const windowStart = now - this.windowMs;
    this.timestamps = this.timestamps.filter(time => time > windowStart);
    
    // If we haven't reached the limit, allow the request
    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(now);
      return Promise.resolve();
    }
    
    // Otherwise, queue it
    return new Promise<void>(resolve => {
      this.pendingPromises.push({ resolve });
    });
  }

  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

// Create rate limiters for each region
const regionLimiters: Record<string, { 
  shortTerm: RateLimiter, 
  longTerm: RateLimiter 
}> = {};

const regions = ['na1', 'euw1', 'kr', 'br1', 'jp1', 'americas', 'europe', 'asia'];

// Initialize rate limiters for each region
regions.forEach(region => {
  regionLimiters[region] = {
    shortTerm: new RateLimiter(1000, 20),  // 20 requests per second
    longTerm: new RateLimiter(120000, 100) // 100 requests per 2 minutes
  };
});

// Utility function to acquire both rate limiters
export async function acquireRateLimit(region: string): Promise<void> {
  const limiter = regionLimiters[region] || regionLimiters['na1']; // Default to NA if unknown region
  
  // Need to acquire both rate limits
  await limiter.shortTerm.acquire();
  await limiter.longTerm.acquire();
}

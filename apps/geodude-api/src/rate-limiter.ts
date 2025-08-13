// Rate limiting utility for API endpoints
// Implements token bucket algorithm per key_id with TTL cleanup

export interface RateLimitConfig {
  rps: number;        // tokens per second
  burst: number;      // maximum burst capacity
  retryAfter: number; // seconds to wait before retry
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  remaining: number;
}

export class RateLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number; lastSeen: number }> = new Map();
  private readonly config: RateLimitConfig;
  private readonly cleanupThreshold: number = 5000; // cleanup when map exceeds this size
  private readonly idleTimeout: number = 2 * 60 * 1000; // 2 minutes

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request is allowed for the given key_id
   */
  tryConsume(keyId: string): RateLimitResult {
    const now = Date.now();
    const bucket = this.buckets.get(keyId);

    if (!bucket) {
      // First request for this key_id
      this.buckets.set(keyId, {
        tokens: this.config.burst - 1,
        lastRefill: now,
        lastSeen: now
      });

      // Trigger cleanup if map is getting large
      if (this.buckets.size > this.cleanupThreshold) {
        this.cleanup();
      }

      return {
        allowed: true,
        remaining: this.config.burst - 1
      };
    }

    // Update last seen timestamp
    bucket.lastSeen = now;

    // Refill tokens based on time passed
    const timePassed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.config.rps;
    
    bucket.tokens = Math.min(this.config.burst, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if we have enough tokens
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: bucket.tokens
      };
    }

    // Rate limited
    const timeToNextToken = (1 - bucket.tokens) / this.config.rps;
    const retryAfter = Math.ceil(timeToNextToken);

    return {
      allowed: false,
      retryAfter: Math.min(retryAfter, this.config.retryAfter),
      remaining: 0
    };
  }

  /**
   * Clean up idle entries and old buckets
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [keyId, bucket] of this.buckets.entries()) {
      if (now - bucket.lastSeen > this.idleTimeout) {
        toDelete.push(keyId);
      }
    }

    // Remove idle entries
    for (const keyId of toDelete) {
      this.buckets.delete(keyId);
    }

    // Log cleanup if significant
    if (toDelete.length > 0) {
      console.log(`Rate limiter cleanup: removed ${toDelete.length} idle entries`);
    }
  }

  /**
   * Get current stats for monitoring
   */
  getStats(): { activeBuckets: number; totalCapacity: number } {
    return {
      activeBuckets: this.buckets.size,
      totalCapacity: this.buckets.size * this.config.burst
    };
  }

  /**
   * Reset all buckets (useful for testing)
   */
  reset(): void {
    this.buckets.clear();
  }
}

/**
 * Create a rate limiter instance from environment variables
 */
export function createRateLimiter(env?: any): RateLimiter {
  // For Cloudflare Workers, env vars are passed via bindings
  // Default values if not provided
  const rps = 10;
  const burst = 50;
  const retryAfter = 5;

  return new RateLimiter({ rps, burst, retryAfter });
}

// Metrics manager for rolling 5-minute observability
// Tracks ingestion success/failure, latency, and error breakdowns

export enum ErrorCode {
  HMAC_FAILED = 'hmac_failed',
  REPLAY = 'replay',
  RATE_LIMITED = 'rate_limited',
  SCHEMA_INVALID = 'schema_invalid',
  CORS_BLOCKED = 'cors_blocked',
  CONTENT_TYPE_INVALID = 'content_type_invalid',
  SIZE_EXCEEDED = 'size_exceeded',
  ORIGIN_DENIED = 'origin_denied',
  UNKNOWN = 'unknown'
}

export interface MetricsRecord {
  keyId?: string;
  projectId?: number;
  latencyMs?: number;
  ok: boolean;
  error?: ErrorCode;
}

export interface Bucket {
  tsMin: number;                    // Minute timestamp (floor to minute)
  total: number;                    // Total requests in this minute
  latency: number[];                // Sampled latencies (reservoir sample)
  errors: Record<ErrorCode, number>; // Error counts by type
  byKey: Map<string, number>;       // Error counts by key_id
  byProject: Map<number, number>;   // Error counts by project_id
}

export interface MetricsSnapshot {
  total: number;
  errorRate: number;
  p50: number;
  p95: number;
  byError: Record<ErrorCode, number>;
  topErrorKeys: Array<{ key_id: string; count: number }>;
  topErrorProjects: Array<{ project_id: number; count: number }>;
}

export class MetricsManager {
  private static instance: MetricsManager;
  private buckets: Bucket[] = [];
  private readonly maxBuckets = 5;           // 5-minute rolling window
  private readonly maxLatencySamples = 500;  // Reservoir sample size per bucket
  private lastRotation: number = 0;

  private constructor() {
    this.initializeBuckets();
  }

  static getInstance(): MetricsManager {
    if (!MetricsManager.instance) {
      MetricsManager.instance = new MetricsManager();
    }
    return MetricsManager.instance;
  }

  /**
   * Initialize empty buckets for the rolling window
   */
  private initializeBuckets(): void {
    const now = this.getCurrentMinute();
    this.buckets = [];
    
    for (let i = 0; i < this.maxBuckets; i++) {
      this.buckets.push({
        tsMin: now - (i * 60 * 1000),
        total: 0,
        latency: [],
        errors: this.createEmptyErrorCounts(),
        byKey: new Map(),
        byProject: new Map()
      });
    }
    
    this.lastRotation = now;
  }

  /**
   * Create empty error count object
   */
  private createEmptyErrorCounts(): Record<ErrorCode, number> {
    const counts: Record<ErrorCode, number> = {} as Record<ErrorCode, number>;
    Object.values(ErrorCode).forEach(code => {
      counts[code] = 0;
    });
    return counts;
  }

  /**
   * Get current minute timestamp (floored to minute)
   */
  private getCurrentMinute(): number {
    return Math.floor(Date.now() / (60 * 1000)) * 60 * 1000;
  }

  /**
   * Rotate buckets if a new minute has started
   */
  private rotateBucketsIfNeeded(): void {
    const now = this.getCurrentMinute();
    
    if (now > this.lastRotation) {
      // Remove oldest bucket and add new one
      this.buckets.pop();
      this.buckets.unshift({
        tsMin: now,
        total: 0,
        latency: [],
        errors: this.createEmptyErrorCounts(),
        byKey: new Map(),
        byProject: new Map()
      });
      
      this.lastRotation = now;
    }
  }

  /**
   * Get the current (most recent) bucket
   */
  private getCurrentBucket(): Bucket {
    this.rotateBucketsIfNeeded();
    return this.buckets[0];
  }

  /**
   * Add latency sample using reservoir sampling
   */
  private addLatencySample(bucket: Bucket, latencyMs: number): void {
    if (bucket.latency.length < this.maxLatencySamples) {
      bucket.latency.push(latencyMs);
    } else {
      // Reservoir sampling: replace with probability maxLatencySamples / total
      const randomIndex = Math.floor(Math.random() * bucket.latency.length);
      if (randomIndex < this.maxLatencySamples) {
        bucket.latency[randomIndex] = latencyMs;
      }
    }
  }

  /**
   * Record a metrics event
   */
  record(record: MetricsRecord): void {
    const bucket = this.getCurrentBucket();
    
    // Increment total count
    bucket.total++;
    
    // Add latency sample if provided
    if (record.latencyMs !== undefined) {
      this.addLatencySample(bucket, record.latencyMs);
    }
    
    // Handle errors
    if (!record.ok && record.error) {
      // Increment error count
      bucket.errors[record.error]++;
      
      // Track by key_id if available
      if (record.keyId) {
        const currentCount = bucket.byKey.get(record.keyId) || 0;
        bucket.byKey.set(record.keyId, currentCount + 1);
      }
      
      // Track by project_id if available
      if (record.projectId) {
        const currentCount = bucket.byProject.get(record.projectId) || 0;
        bucket.byProject.set(record.projectId, currentCount + 1);
      }
    }
  }

  /**
   * Get snapshot of last 5 minutes
   */
  snapshot5m(): MetricsSnapshot {
    this.rotateBucketsIfNeeded();
    
    let total = 0;
    const byError: Record<ErrorCode, number> = this.createEmptyErrorCounts();
    const byKey = new Map<string, number>();
    const byProject = new Map<number, number>();
    const allLatencies: number[] = [];
    
    // Aggregate across all buckets
    for (const bucket of this.buckets) {
      total += bucket.total;
      
      // Sum error counts
      Object.entries(bucket.errors).forEach(([code, count]) => {
        byError[code as ErrorCode] += count;
      });
      
      // Sum by key
      bucket.byKey.forEach((count, keyId) => {
        const current = byKey.get(keyId) || 0;
        byKey.set(keyId, current + count);
      });
      
      // Sum by project
      bucket.byProject.forEach((count, projectId) => {
        const current = byProject.get(projectId) || 0;
        byProject.set(projectId, current + count);
      });
      
      // Collect latencies
      allLatencies.push(...bucket.latency);
    }
    
    // Calculate error rate
    const errorRate = total > 0 ? Object.values(byError).reduce((sum, count) => sum + count, 0) / total : 0;
    
    // Calculate percentiles
    const p50 = this.calculatePercentile(allLatencies, 50);
    const p95 = this.calculatePercentile(allLatencies, 95);
    
    // Get top error keys
    const topErrorKeys = Array.from(byKey.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([keyId, count]) => ({ key_id: keyId, count }));
    
    // Get top error projects
    const topErrorProjects = Array.from(byProject.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([projectId, count]) => ({ project_id: projectId, count }));
    
    return {
      total,
      errorRate,
      p50,
      p95,
      byError,
      topErrorKeys,
      topErrorProjects
    };
  }

  /**
   * Calculate percentile from array of numbers
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    
    if (index < 0) return sorted[0];
    if (index >= sorted.length) return sorted[sorted.length - 1];
    
    return sorted[index];
  }

  /**
   * Get metrics for a specific project (last 5 minutes)
   */
  snapshot5mForProject(projectId: number): MetricsSnapshot | null {
    this.rotateBucketsIfNeeded();
    
    let total = 0;
    const byError: Record<ErrorCode, number> = this.createEmptyErrorCounts();
    const byKey = new Map<string, number>();
    const allLatencies: number[] = [];
    
    // Aggregate across all buckets for this project
    for (const bucket of this.buckets) {
      // Count total requests for this project (approximate - we don't track success by project)
      // For now, we'll return null if we can't provide project-specific totals
      // This is a TODO for future enhancement
      
      // Sum error counts for this project
      const projectErrorCount = bucket.byProject.get(projectId) || 0;
      if (projectErrorCount > 0) {
        // Add to total errors (approximate)
        Object.entries(bucket.errors).forEach(([code, count]) => {
          byError[code as ErrorCode] += count;
        });
        
        // Sum by key for this project
        bucket.byKey.forEach((count, keyId) => {
          const current = byKey.get(keyId) || 0;
          byKey.set(keyId, current + count);
        });
        
        // Collect latencies (approximate - we don't track success latency by project)
        allLatencies.push(...bucket.latency);
      }
    }
    
    // For v1, return null if we can't provide meaningful project-specific data
    // This will be enhanced in future versions
    return null;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.initializeBuckets();
  }

  /**
   * Get current bucket count for debugging
   */
  getBucketCount(): number {
    return this.buckets.length;
  }
}

/**
 * Circuit Breaker for Workers AI Classification (Phase 2)
 * Automatically disables AI layer if error rate is too high
 */

const CIRCUIT_BREAKER_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const CIRCUIT_BREAKER_ERROR_THRESHOLD = 0.10; // 10% error rate
const CIRCUIT_BREAKER_MIN_SAMPLES = 20; // Minimum calls before opening

export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export type CircuitBreakerStats = {
  state: CircuitBreakerState;
  total_calls: number;
  errors: number;
  error_rate: number;
  window_start: string;
  last_error?: string;
};

/**
 * Circuit breaker implementation using KV for state
 */
export class CircuitBreaker {
  private kvKey = 'circuit_breaker:classifier_ai';
  private kv: any;

  constructor(kv: any) {
    this.kv = kv;
  }

  /**
   * Check if circuit is open (AI disabled)
   */
  async isOpen(): Promise<boolean> {
    const stats = await this.getStats();
    return stats.state === 'open';
  }

  /**
   * Get current circuit breaker stats
   */
  async getStats(): Promise<CircuitBreakerStats> {
    const raw = await this.kv.get(this.kvKey);
    if (!raw) {
      return this.getDefaultStats();
    }

    try {
      const stats = JSON.parse(raw);
      const windowAge = Date.now() - new Date(stats.window_start).getTime();

      // Reset window if too old
      if (windowAge > CIRCUIT_BREAKER_WINDOW_MS) {
        return this.getDefaultStats();
      }

      return stats;
    } catch {
      return this.getDefaultStats();
    }
  }

  /**
   * Record a successful call
   */
  async recordSuccess(): Promise<void> {
    const stats = await this.getStats();
    stats.total_calls += 1;
    stats.error_rate = stats.errors / stats.total_calls;

    // Auto-close if half-open and success
    if (stats.state === 'half_open') {
      stats.state = 'closed';
      console.log('[CIRCUIT_BREAKER] Closed after successful call');
    }

    await this.saveStats(stats);
  }

  /**
   * Record a failed call
   */
  async recordError(error: string): Promise<void> {
    const stats = await this.getStats();
    stats.total_calls += 1;
    stats.errors += 1;
    stats.error_rate = stats.errors / stats.total_calls;
    stats.last_error = error;

    // Open circuit if error rate exceeds threshold
    if (
      stats.total_calls >= CIRCUIT_BREAKER_MIN_SAMPLES &&
      stats.error_rate >= CIRCUIT_BREAKER_ERROR_THRESHOLD &&
      stats.state !== 'open'
    ) {
      stats.state = 'open';
      console.error(`[CIRCUIT_BREAKER] Opened due to high error rate: ${(stats.error_rate * 100).toFixed(1)}%`);
      
      // Log alert
      console.log(JSON.stringify({
        type: 'circuit_breaker_opened',
        error_rate: stats.error_rate,
        total_calls: stats.total_calls,
        errors: stats.errors,
        last_error: error
      }));
    }

    await this.saveStats(stats);
  }

  /**
   * Manually reset circuit breaker (admin action)
   */
  async reset(): Promise<void> {
    const stats = this.getDefaultStats();
    stats.state = 'half_open'; // Try again cautiously
    await this.saveStats(stats);
    console.log('[CIRCUIT_BREAKER] Manually reset to half-open');
  }

  /**
   * Save stats to KV
   */
  private async saveStats(stats: CircuitBreakerStats): Promise<void> {
    await this.kv.put(this.kvKey, JSON.stringify(stats), {
      expirationTtl: Math.ceil(CIRCUIT_BREAKER_WINDOW_MS / 1000)
    });
  }

  /**
   * Get default stats (closed state)
   */
  private getDefaultStats(): CircuitBreakerStats {
    return {
      state: 'closed',
      total_calls: 0,
      errors: 0,
      error_rate: 0,
      window_start: new Date().toISOString()
    };
  }
}

/**
 * Helper to check if AI classification should run
 */
export async function shouldUseAI(kv: any): Promise<boolean> {
  const breaker = new CircuitBreaker(kv);
  const isOpen = await breaker.isOpen();
  
  if (isOpen) {
    console.log('[CIRCUIT_BREAKER] AI classification disabled due to open circuit');
    return false;
  }
  
  return true;
}


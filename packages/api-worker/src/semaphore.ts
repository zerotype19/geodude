/**
 * Lightweight Semaphore for Pool Limits
 * Controls concurrent execution of external calls
 */

export class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      if (next) {
        next();
      }
    } else {
      this.permits++;
    }
  }

  async withPermit<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  get availablePermits(): number {
    return this.permits;
  }

  get queueLength(): number {
    return this.waitQueue.length;
  }
}

// Global semaphores for audit processing
export const CONNECTOR_SEMAPHORE = new Semaphore(2); // Max 2 concurrent connector calls
export const RENDER_SEMAPHORE = new Semaphore(1);   // Max 1 concurrent render call

/**
 * Utility function to run with connector semaphore
 */
export async function withConnectorSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  return CONNECTOR_SEMAPHORE.withPermit(fn);
}

/**
 * Utility function to run with render semaphore
 */
export async function withRenderSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  return RENDER_SEMAPHORE.withPermit(fn);
}

export class RateLimiter {
  private tokens: number;
  private ts: number;
  
  constructor(private capacity = 3, private perMs = 1000) {
    this.tokens = capacity;
    this.ts = Date.now();
  }
  
  async take() {
    for (;;) {
      const now = Date.now();
      const refill = ((now - this.ts) / this.perMs) * this.capacity;
      this.tokens = Math.min(this.capacity, this.tokens + refill);
      this.ts = now;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }
}


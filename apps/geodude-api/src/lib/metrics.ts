type KV = KVNamespace;

export class MetricsManager {
  constructor(private kv: KV | undefined) {}

  async increment(name: string): Promise<void> {
    if (!this.kv) return;
    
    try {
      const key = `${name}:${Math.floor(Date.now() / (5 * 60 * 1000))}`;
      const current = await this.kv.get(key) || "0";
      const count = parseInt(current) + 1;
      await this.kv.put(key, count.toString(), { expirationTtl: 300 });
    } catch (e) {
      console.error(`Failed to increment metric ${name}:`, e);
    }
  }

  async getMetric(name: string): Promise<number> {
    if (!this.kv) return 0;
    
    try {
      const key = `${name}:${Math.floor(Date.now() / (5 * 60 * 1000))}`;
      const value = await this.kv.get(key);
      return value ? parseInt(value) : 0;
    } catch (e) {
      console.error(`Failed to get metric ${name}:`, e);
      return 0;
    }
  }
}

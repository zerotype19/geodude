type KV = KVNamespace;

export async function ipRateLimit(
  kv: KV | undefined,
  ip: string,
  endpoint: string,
  limit: number,        // e.g. 120
  windowSec: number,    // e.g. 60
  metrics?: { increment: (name: string) => void }
): Promise<{ ok: boolean; remaining: number; resetAt: number }> {
  if (!kv) throw new Error("RL binding missing");
  const now = Date.now();
  const key = `rl:ip:${ip}:${endpoint}`;
  const raw = await kv.get(key, { type: "json" }) as any | null;

  if (!raw || now >= raw.resetAt) {
    const resetAt = now + windowSec * 1000;
    await kv.put(key, JSON.stringify({ count: 1, resetAt }), { expirationTtl: windowSec + 5 });
    metrics?.increment("ip_rl_allow_5m");
    return { ok: true, remaining: limit - 1, resetAt };
  }

  const count = (raw.count || 0) + 1;
  if (count > limit) {
    metrics?.increment("ip_rl_block_5m");
    return { ok: false, remaining: 0, resetAt: raw.resetAt };
  }

  raw.count = count;
  const remainingTtl = Math.ceil((raw.resetAt - now) / 1000) + 5;
  // Ensure TTL is at least 60 seconds (Cloudflare requirement)
  const safeTtl = Math.max(remainingTtl, 60);
  await kv.put(key, JSON.stringify(raw), { expirationTtl: safeTtl });
  metrics?.increment("ip_rl_allow_5m");
  return { ok: true, remaining: limit - count, resetAt: raw.resetAt };
}

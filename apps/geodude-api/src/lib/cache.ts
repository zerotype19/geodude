/* Minimal JSON cache helpers + project versioning */

type KV = KVNamespace;

const KEY_VERSION = (projectId: string) => `v:${projectId}`;

export async function getProjectVersion(kv: KV, projectId: string): Promise<number> {
  if (!kv) return 0;
  const v = await kv.get(KEY_VERSION(projectId));
  return v ? Number(v) || 0 : 0;
}

export async function bumpProjectVersion(kv: KV, projectId: string): Promise<number> {
  if (!kv) return 0;
  const now = Date.now(); // use timestamp as monotonic "version"
  await kv.put(KEY_VERSION(projectId), String(now));
  return now;
}

export async function getOrSetJSON<T>(
  kv: KV,
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
  env?: { CACHE_OFF?: string; metrics?: (name: string) => void }
): Promise<T> {
  if (!kv || env?.CACHE_OFF === "1") {
    env?.metrics?.("cache_bypass_5m");
    return compute();
  }
  const hit = await kv.get(key);
  if (hit) {
    env?.metrics?.("cache_hit_5m");
    try { return JSON.parse(hit) as T; } catch { /* fallthrough */ }
  }
  const value = await compute();
  // size guard
  try {
    const str = JSON.stringify(value);
    if (str.length <= (env as any)?.CACHE_PAYLOAD_LIMIT_BYTES ?? 50_000) {
      await kv.put(key, str, { expirationTtl: ttlSeconds });
      env?.metrics?.(hit ? "cache_overwrite_5m" : "cache_miss_5m");
    } else {
      env?.metrics?.("cache_skip_oversize_5m");
    }
  } catch {
    env?.metrics?.("cache_store_error_5m");
  }
  return value;
}

/* Robust JSON cache helpers + project versioning */

type CacheKV = KVNamespace;

// Project version bump (invalidation)
export async function bumpProjectVersion(
  kv: CacheKV | undefined,
  projectId: string
): Promise<number> {
  if (!kv) throw new Error("CACHE binding missing");
  const k = `pv:${projectId}`;
  const now = Date.now();
  await kv.put(k, String(now)); // no TTL (evergreen)
  return now;
}

export async function getProjectVersion(
  kv: CacheKV | undefined,
  projectId: string
): Promise<string> {
  if (!kv) throw new Error("CACHE binding missing");
  return (await kv.get(`pv:${projectId}`)) ?? "0";
}

export async function cacheGetJSON(
  kv: CacheKV | undefined,
  key: string
): Promise<any | null> {
  if (!kv) throw new Error("CACHE binding missing");
  try {
    // Cloudflare KV supports { type: "json" }
    const val = await kv.get(key, { type: "json" });
    return val ?? null;
  } catch (e) {
    // increment cache_error_5m if metrics available
    return null;
  }
}

export async function cachePutJSON(
  kv: CacheKV | undefined,
  key: string,
  value: any,
  ttlSeconds: number
): Promise<void> {
  if (!kv) throw new Error("CACHE binding missing");
  try {
    // Trim very large payloads (guard)
    const str = JSON.stringify(value);
    if (str.length > 50_000) {
      // increment cache_skip_oversize_5m
      return;
    }
    await kv.put(key, str, { expirationTtl: Math.max(1, Math.floor(ttlSeconds)) });
  } catch (e) {
    // increment cache_error_5m
  }
}

export async function getOrSetJSON<T>(
  kv: CacheKV | undefined,
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
  opts?: { bypass?: boolean; metrics?: (kind: "hit"|"miss"|"bypass") => void }
): Promise<T> {
  if (!kv) throw new Error("CACHE binding missing");
  if (opts?.bypass) {
    opts.metrics?.("bypass");
    return await compute();
  }
  // GET
  const hit = await cacheGetJSON(kv, key);
  if (hit !== null) {
    opts?.metrics?.("hit");
    return hit as T;
  }
  // MISS → compute + PUT
  const val = await compute();
  await cachePutJSON(kv, key, val, ttlSeconds);
  opts?.metrics?.("miss");
  return val;
}

// Legacy compatibility - keep old function names
export const getProjectVersionLegacy = getProjectVersion;
export const bumpProjectVersionLegacy = bumpProjectVersion;

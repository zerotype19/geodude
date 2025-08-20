/**
 * Cache utilities for response caching and project version invalidation
 */

export async function getOrSetJSON(
  cache: KVNamespace, 
  key: string, 
  ttl: number, 
  fn: () => Promise<unknown>
) {
  const hit = await cache.get(key);
  if (hit) return JSON.parse(hit);

  const data = await fn();

  // only cache small payloads
  const raw = JSON.stringify(data);
  if (raw.length <= 50_000) {
    await cache.put(key, raw, { expirationTtl: ttl });
  }
  return data;
}

export async function getProjectVersion(cache: KVNamespace, projectId: string) {
  return (await cache.get(`v:${projectId}`)) ?? "0";
}

export async function bumpProjectVersion(cache: KVNamespace, projectId: string) {
  const next = (parseInt(await getProjectVersion(cache, projectId)) || 0) + 1;
  await cache.put(`v:${projectId}`, String(next));
  return next;
}

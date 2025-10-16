/**
 * Feature flag resolver with KV override support
 * Resolution order: KV override → env default → fallback
 */

export async function getFlag(env: Env, key: string, fallback = "false"): Promise<boolean> {
  try {
    // Try KV override first
    const kv = await env.KV_RULES?.get(`flags/${key}`);
    if (kv !== null) {
      return kv.toLowerCase() === "true";
    }
  } catch (error) {
    console.warn(`[Flags] KV lookup failed for ${key}:`, error);
  }

  // Fall back to environment variable
  const envValue = env[`FF_${key.toUpperCase()}`] as string;
  if (envValue !== undefined) {
    return envValue.toLowerCase() === "true";
  }

  // Final fallback
  return fallback.toLowerCase() === "true";
}

export async function getAuditV21Scoring(env: Env): Promise<boolean> {
  return getFlag(env, "audit_v21_scoring", "false");
}

export async function getCrawlSitemapDepth1(env: Env): Promise<boolean> {
  return getFlag(env, "crawl_sitemap_depth1", "false");
}

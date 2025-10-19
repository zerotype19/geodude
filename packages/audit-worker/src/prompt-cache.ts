/**
 * LLM Prompt Cache Management
 * Scalable tier for contextual prompt service
 */

import { Env } from './index';
import { buildLLMQueryPrompts } from './prompts';

const CACHE_TTL_DAYS = 7;
const KV_TTL_SECONDS = 7 * 86400; // 7 days

export interface PromptCacheEntry {
  id: string;
  domain: string;
  project_id: string | null;
  site_type: string | null;
  brand: string | null;
  lang: string | null;
  primary_entities: string; // JSON
  user_intents: string;     // JSON
  branded_prompts: string;  // JSON
  nonbranded_prompts: string; // JSON
  envelope: string | null;
  prompt_gen_version: string;
  updated_at: string;
}

/**
 * Normalize domain for consistent cache keys
 */
function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, '').replace(/\/$/, '');
}

/**
 * Build KV key with optional project_id namespacing for multi-tenant isolation
 */
function buildCacheKey(domain: string, projectId?: string): string {
  const normDomain = normalizeDomain(domain);
  if (projectId) {
    return `llm_prompts:${projectId}:${normDomain}`;
  }
  return `llm_prompts:${normDomain}`;
}

/**
 * Save prompt set to D1 cache and KV hot cache
 */
export async function savePromptCache(env: Env, domain: string, promptData: any, projectId?: string): Promise<void> {
  const normDomain = normalizeDomain(domain);
  const id = crypto.randomUUID();
  
  console.log(`[PROMPT_CACHE] Saving cache for ${normDomain}`);
  
  // Save to D1 (canonical record) with realism score
  const realismScore = promptData.realismScoreAvg ?? 0.85;
  
  await env.DB.prepare(`
    INSERT OR REPLACE INTO llm_prompt_cache 
    (id, domain, project_id, site_type, brand, lang, primary_entities, user_intents, 
     branded_prompts, nonbranded_prompts, envelope, prompt_gen_version, realism_score_avg, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    id,
    normDomain,
    projectId || null,
    promptData.meta?.site_type || null,
    promptData.meta?.brand || null,
    promptData.meta?.lang || null,
    JSON.stringify(promptData.meta?.primary_entities || []),
    JSON.stringify(promptData.meta?.user_intents || []),
    JSON.stringify(promptData.branded || []),
    JSON.stringify(promptData.nonBranded || []),
    promptData.envelope || null,
    promptData.meta?.prompt_gen_version || 'v2-contextual',
    realismScore
  ).run();
  
  // Save to KV (hot cache) with project namespacing
  const kvKey = buildCacheKey(normDomain, projectId || undefined);
  const kvValue = JSON.stringify({
    domain: normDomain,
    project_id: projectId || null,
    branded: promptData.branded,
    nonBranded: promptData.nonBranded,
    envelope: promptData.envelope,
    meta: promptData.meta,
    cached_at: new Date().toISOString()
  });
  
  await env.PROMPT_CACHE.put(kvKey, kvValue, {
    expirationTtl: KV_TTL_SECONDS
  });
  
  console.log(`[PROMPT_CACHE] WRITE ${normDomain} (project: ${projectId || 'none'})`);
}

/**
 * Get prompt set from cache (KV first, then D1)
 * Returns null if not found or expired
 * Enhanced with logging for observability
 */
export async function getPromptCache(env: Env, domain: string, projectId?: string): Promise<any | null> {
  const startTime = Date.now();
  const normDomain = normalizeDomain(domain);
  
  // Try KV first (fastest) with project namespacing
  const kvKey = buildCacheKey(normDomain, projectId);
  const kvValue = await env.PROMPT_CACHE.get(kvKey);
  
  if (kvValue) {
    const latency = Date.now() - startTime;
    console.log(`[PROMPT_CACHE] ${normDomain} HIT (KV) latency=${latency}ms`);
    return JSON.parse(kvValue);
  }
  
  // Fallback to D1
  const cached = await env.DB.prepare(`
    SELECT * FROM llm_prompt_cache WHERE domain = ?
  `).bind(normDomain).first<PromptCacheEntry>();
  
  if (!cached) {
    const latency = Date.now() - startTime;
    console.log(`[PROMPT_CACHE] ${normDomain} MISS latency=${latency}ms`);
    return null;
  }
  
  // Check freshness (7 days)
  const updatedAt = new Date(cached.updated_at).getTime();
  const now = Date.now();
  const ageMs = now - updatedAt;
  const ageDays = ageMs / 86400000;
  
  if (ageDays > CACHE_TTL_DAYS) {
    const latency = Date.now() - startTime;
    console.log(`[PROMPT_CACHE] ${normDomain} STALE (${ageDays.toFixed(1)}d) latency=${latency}ms`);
    return null;
  }
  
  const latency = Date.now() - startTime;
  console.log(`[PROMPT_CACHE] ${normDomain} HIT (D1) latency=${latency}ms`);
  
  // Reconstruct response from D1
  const response = {
    domain: cached.domain,
    project_id: cached.project_id,
    branded: JSON.parse(cached.branded_prompts),
    nonBranded: JSON.parse(cached.nonbranded_prompts),
    envelope: cached.envelope,
    meta: {
      brand: cached.brand,
      lang: cached.lang,
      site_type: cached.site_type,
      primary_entities: JSON.parse(cached.primary_entities),
      user_intents: JSON.parse(cached.user_intents),
      prompt_gen_version: cached.prompt_gen_version
    },
    cached_at: cached.updated_at
  };
  
  // Backfill KV for next time with project namespacing
  const backfillKey = buildCacheKey(normDomain, cached.project_id || undefined);
  await env.PROMPT_CACHE.put(backfillKey, JSON.stringify(response), {
    expirationTtl: KV_TTL_SECONDS
  });
  
  return response;
}

/**
 * Build and cache prompts for a domain
 * Used after audit completion and during refresh
 */
export async function buildAndCachePrompts(env: Env, domain: string, projectId?: string): Promise<any> {
  console.log(`[PROMPT_CACHE] Building prompts for ${domain}`);
  
  const promptData = await buildLLMQueryPrompts(env, domain);
  
  if (promptData && (promptData.branded.length > 0 || promptData.nonBranded.length > 0)) {
    await savePromptCache(env, domain, promptData, projectId);
  }
  
  return promptData;
}

/**
 * Get oldest N cache entries for refresh
 */
export async function getStalePromptCache(env: Env, limit: number = 100): Promise<string[]> {
  const stale = await env.DB.prepare(`
    SELECT domain FROM llm_prompt_cache
    ORDER BY updated_at ASC
    LIMIT ?
  `).bind(limit).all();
  
  return (stale.results || []).map((r: any) => r.domain);
}

/**
 * Agent-ready: Get cached prompts with full fallback chain
 * KV → D1 → rebuild if missing
 * This ensures the Agent always gets fresh domain intelligence
 */
export async function getCachedPrompts(env: Env, domain: string, projectId?: string): Promise<any> {
  // Try cache first
  const cached = await getPromptCache(env, domain, projectId);
  if (cached) {
    return cached;
  }
  
  // Cache miss - rebuild and cache
  console.log(`[PROMPT_CACHE] Agent requested ${domain}, building fresh`);
  return await buildAndCachePrompts(env, domain, projectId);
}

/**
 * Update prompt intelligence index with citation coverage stats
 * Called after citation runs complete
 */
export async function updatePromptIndex(env: Env, opts: {
  domain: string;
  projectId?: string;
  brand?: string;
  siteType?: string;
  primaryEntities?: string[];
  avgCoverage?: number;
  totalCitations?: number;
  totalQueries?: number;
}): Promise<void> {
  const { domain, projectId, brand, siteType, primaryEntities, avgCoverage, totalCitations, totalQueries } = opts;
  const normDomain = normalizeDomain(domain);
  
  await env.DB.prepare(`
    INSERT OR REPLACE INTO llm_prompt_index 
    (id, domain, project_id, brand, site_type, primary_entities, 
     avg_llm_coverage, total_citations, total_queries, last_cited_at, updated_at)
    VALUES (
      COALESCE((SELECT id FROM llm_prompt_index WHERE domain = ?), ?),
      ?, ?, ?, ?, ?,
      COALESCE(?, (SELECT avg_llm_coverage FROM llm_prompt_index WHERE domain = ?)),
      COALESCE(?, (SELECT total_citations FROM llm_prompt_index WHERE domain = ?)),
      COALESCE(?, (SELECT total_queries FROM llm_prompt_index WHERE domain = ?)),
      datetime('now'),
      datetime('now')
    )
  `).bind(
    normDomain, crypto.randomUUID(),
    normDomain, projectId || null, brand || null, siteType || null,
    JSON.stringify(primaryEntities || []),
    avgCoverage || null, normDomain,
    totalCitations || null, normDomain,
    totalQueries || null, normDomain
  ).run();
  
  console.log(`[PROMPT_INDEX] Updated ${normDomain} (coverage: ${avgCoverage}%)`);
}

/**
 * Get related domains by entity for Agent semantic search
 */
export async function getRelatedDomains(env: Env, entity: string, limit: number = 20): Promise<any[]> {
  // SQLite JSON search for entity in primary_entities array
  const results = await env.DB.prepare(`
    SELECT domain, brand, site_type, primary_entities, avg_llm_coverage, last_cited_at
    FROM llm_prompt_index
    WHERE primary_entities LIKE ?
    ORDER BY avg_llm_coverage DESC, last_cited_at DESC
    LIMIT ?
  `).bind(`%"${entity}"%`, limit).all();
  
  return (results.results || []).map((r: any) => ({
    domain: r.domain,
    brand: r.brand,
    site_type: r.site_type,
    primary_entities: JSON.parse(r.primary_entities),
    avg_llm_coverage: r.avg_llm_coverage,
    last_cited_at: r.last_cited_at
  }));
}


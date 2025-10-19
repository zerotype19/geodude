/**
 * LLM Prompt Generation API (with read-through cache + AI mode)
 * GET /api/llm/prompts?domain=example.com&mode=rules|ai|blended
 */

import { Env } from '../index';
import { getPromptCache, buildAndCachePrompts } from '../prompt-cache';
import { generateAiPrompts, type PromptGenInput } from '../prompts/promptGeneratorAI';
import { blendPrompts } from '../prompts/promptBlender';
import { buildBrandAliases } from '../prompts/brandAliases';
import { buildMinimalContext } from '../prompts/coldStartContext';
import { buildLLMQueryPrompts, getHomepageContext } from '../prompts';
import { BLENDED_USES_V4 } from '../config';

// Simple circuit breaker for AI prompts
const AI_CIRCUIT_BREAKER = {
  failures: 0,
  lastCheck: Date.now(),
  threshold: 5,
  allow() {
    // Reset counter every 5 minutes
    if (Date.now() - this.lastCheck > 300000) {
      this.failures = 0;
      this.lastCheck = Date.now();
    }
    return this.failures < this.threshold;
  },
  recordFailure() {
    this.failures++;
  },
  recordSuccess() {
    this.failures = Math.max(0, this.failures - 1);
  }
};

export async function handleGetLLMPrompts(env: Env, request: Request) {
  const u = new URL(request.url);
  const domain = u.searchParams.get('domain');
  const forceRefresh = u.searchParams.get('refresh') === 'true' || u.searchParams.get('nocache') === '1';
  const mode = (u.searchParams.get('mode') || 'blended').toLowerCase() as 'rules' | 'ai' | 'blended';
  const langOverride = u.searchParams.get('lang') || null;
  const regionOverride = u.searchParams.get('region') || null;
  const personaOverride = u.searchParams.get('persona') as 'consumer' | 'merchant' | 'developer' | 'investor' | null;
  const ttlOverride = u.searchParams.get('ttl') ? parseInt(u.searchParams.get('ttl')!) : null;
  
  if (!domain) {
    return new Response(JSON.stringify({ error: 'Missing domain parameter' }), { 
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  try {
    // Get rule-based prompts (always needed for fallback and blending)
    let rulePrompts: any;
    
    if (!forceRefresh) {
      const cached = await getPromptCache(env, domain);
      if (cached) {
        rulePrompts = cached;
        console.log(`[LLM_PROMPTS] Serving rules from cache for ${domain}`);
      }
    }
    
    if (!rulePrompts) {
      console.log(`[LLM_PROMPTS] Building fresh rule prompts for ${domain}`);
      rulePrompts = await buildAndCachePrompts(env, domain);
    }
    
    // Note: Cold-start is now handled internally by buildLLMQueryPrompts
    // No need for separate cold-start check here

    // Mode: rules-only (existing behavior)
    if (mode === 'rules') {
      return new Response(JSON.stringify({
        ...rulePrompts,
        source: 'rules',
        realism_score: 0.4
      }), {
        headers: { 
          'content-type': 'application/json',
          'x-cache': forceRefresh ? 'miss' : 'hit',
          'cache-control': 'public, max-age=3600'
        }
      });
    }

    // Mode: blended (default) - Use V4 with MSS V2 industry detection
    if (BLENDED_USES_V4 && (mode === 'blended' || !mode)) {
      console.log(`[LLM_PROMPTS] Using V4 pipeline for ${domain}`);
      try {
        // Call buildLLMQueryPrompts which has V4 with the hot patch and cold-start support
        const v4Result = await buildLLMQueryPrompts(env, domain);
        
        return new Response(JSON.stringify({
          ...v4Result,
          source: v4Result.meta?.prompt_gen_version?.includes('cold-start') ? 'v4-cold-start' : 'v4-blended',
          industry: v4Result.meta?.industry || 'default',
          template_version: v4Result.meta?.template_version || 'v1.0',
          realism_target: v4Result.meta?.realism_target || 0.62,
          realism_score: v4Result.realismScoreAvg || 0.78
        }), {
          headers: { 
            'content-type': 'application/json',
            'x-cache': forceRefresh ? 'miss' : 'hit',
            'cache-control': 'public, max-age=3600'
          }
        });
      } catch (error) {
        console.error(`[LLM_PROMPTS] V4 pipeline failed for ${domain}:`, error);
        return new Response(JSON.stringify({ 
          error: 'V4 pipeline failed',
          domain,
          message: (error as any).message
        }), { 
          status: 500,
          headers: { 'content-type': 'application/json' }
        });
      }
    }

    // Legacy path (only if BLENDED_USES_V4=false): AI or blended (Phase 2)
    const aiInput: PromptGenInput = {
      domain,
      brand: rulePrompts.meta?.brand || domain.replace(/^www\./, ''),
      site_type: rulePrompts.meta?.site_type || null,
      industry: rulePrompts.meta?.industry || null,
      purpose: rulePrompts.meta?.purpose || 'inform',
      category_terms: rulePrompts.meta?.category_terms || [],
      nav_terms: rulePrompts.meta?.nav_terms || [],
      lang: langOverride || rulePrompts.meta?.lang || 'en',
      region: regionOverride || rulePrompts.meta?.region || 'US',
      brand_kind: rulePrompts.meta?.brand_kind || null,
      persona_override: personaOverride,
      site_confidence: rulePrompts.meta?.site_confidence || null
    };

    const aiRes = await generateAiPrompts(env, AI_CIRCUIT_BREAKER, aiInput, ttlOverride);

    if (aiRes.branded.length + aiRes.nonBranded.length > 0) {
      AI_CIRCUIT_BREAKER.recordSuccess();
    } else {
      AI_CIRCUIT_BREAKER.recordFailure();
    }

    // Mode: ai-only
    if (mode === 'ai') {
      const industry = rulePrompts.meta?.industry ?? aiRes.meta?.industry ?? 'default';
      const template_version = rulePrompts.meta?.template_version ?? aiRes.meta?.template_version ?? 'v1.0';
      const realism_target = rulePrompts.meta?.realism_target ?? (industry === 'default' ? 0.62 : 0.74);
      
      return new Response(JSON.stringify({
        ...aiRes,
        meta: rulePrompts.meta,
        source: 'ai',
        realism_score: 0.7,
        industry,
        template_version,
        realism_target,
        qualityGate: aiRes.qualityGate ?? null
      }), {
        headers: { 
          'content-type': 'application/json',
          'x-cache': aiRes.cached ? 'hit' : 'miss',
          'cache-control': 'public, max-age=3600'
        }
      });
    }

    // Legacy blended mode (only if BLENDED_USES_V4=false)
    const aliases = buildBrandAliases(domain, rulePrompts.meta?.brand || null);
    const realismHint = 0.75;
    
    const blended = blendPrompts(
      aiRes, 
      { 
        branded: rulePrompts.branded, 
        nonBranded: rulePrompts.nonBranded 
      },
      realismHint,
      aliases
    );

    const industry = rulePrompts.meta?.industry ?? 'default';
    const template_version = rulePrompts.meta?.template_version ?? 'v1.0';
    const realism_target = industry === 'default' ? 0.62 : 0.74;
    
    return new Response(JSON.stringify({
      ...blended,
      meta: rulePrompts.meta,
      model: aiRes.model,
      ai_cached: aiRes.cached,
      aliases: aliases,
      industry,
      template_version,
      realism_target,
      qualityGate: blended.qualityGate ?? null,
      source: 'legacy-blended'
    }), {
      headers: { 
        'content-type': 'application/json',
        'x-cache': forceRefresh ? 'miss' : (aiRes.cached ? 'hit' : 'miss'),
        'cache-control': 'public, max-age=3600'
      }
    });

  } catch (error: any) {
    console.error('[LLM_PROMPTS] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate prompts',
      message: error.message 
    }), { 
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}


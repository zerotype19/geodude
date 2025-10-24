/**
 * Industry Resolution & Locking
 * 
 * Resolves industry once per audit and prevents mutations
 */

import { getDomainRules, getDefaultIndustry } from '../config/loader';
import type { IndustryKey, HeuristicVote } from '../config/industry-packs.schema';
import { mapLegacyToV2, getAncestorSlugs } from '../config/industry-taxonomy-v2';

export interface IndustryLock {
  value: IndustryKey;
  source: 'override' | 'domain_rules' | 'heuristics' | 'ai_worker' | 'ai_worker_medium_conf' | 'default';
  locked: true;
  votes?: HeuristicVote[];  // For logging/debugging
  confidence?: number;  // AI classifier confidence (0.0-1.0)
  ancestors?: string[];  // Hierarchical path (e.g., ["health.pharma.brand", "health.pharma", "health"])
  metadata?: {
    alts?: Array<{ slug: string; conf: number }>;  // Alternative classifications
    heuristics_agree?: boolean;  // Did heuristics agree with AI?
    schema_boost?: number;  // Schema-based confidence boost
    fusion_applied?: boolean;  // Was fusion logic applied?
  };
}

export interface IndustrySignals {
  domain: string;
  homepageTitle?: string;
  homepageH1?: string;
  schemaTypes?: string[];
  keywords?: string[];
  navTerms?: string[];
}

/**
 * Ensure industry key is a V2 hierarchical slug
 * Maps legacy flat keys (e.g., 'pharmaceutical') to V2 slugs (e.g., 'health.pharma.brand')
 */
function ensureV2Slug(industryKey: string): IndustryKey {
  // Check if already a V2 slug (contains a dot)
  if (industryKey.includes('.')) {
    return industryKey as IndustryKey;
  }
  
  // Map legacy to V2
  return mapLegacyToV2(industryKey) as IndustryKey;
}

/**
 * Calculate schema boost based on industry-specific schema.org types
 * Returns a confidence boost (0-0.10) if schema matches industry
 */
function calculateSchemaBoost(industry: IndustryKey, schemaTypes: string[]): number {
  if (!schemaTypes || schemaTypes.length === 0) return 0;
  
  // Import taxonomy
  const { INDUSTRY_TAXONOMY } = require('../config/industry-taxonomy');
  const industryConfig = INDUSTRY_TAXONOMY[industry];
  if (!industryConfig) return 0;
  
  const schemaLower = schemaTypes.map(s => s.toLowerCase());
  
  // Check if any schema type matches expected types for this industry
  const hasMatch = schemaLower.some(type => 
    industryConfig.schemaTypes.some((expected: string) => 
      type.includes(expected.toLowerCase()) || expected.toLowerCase().includes(type)
    )
  );
  
  return hasMatch ? 0.10 : 0;  // +10% boost if schema matches (increased from 5%)
}

/**
 * Heuristic voting based on signals
 */
function heuristicsVote(signals: IndustrySignals): HeuristicVote[] {
  const votes: HeuristicVote[] = [];
  
  const text = [
    signals.homepageTitle,
    signals.homepageH1,
    ...(signals.schemaTypes || []),
    ...(signals.keywords || []),
    ...(signals.navTerms || [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  
  // Import taxonomy for anti-keyword checking
  const { INDUSTRY_TAXONOMY } = require('../config/industry-taxonomy');
  
  /**
   * Helper to check if text contains anti-keywords for given industry
   */
  const hasAntiKeywords = (industry: string): boolean => {
    const industryConfig = INDUSTRY_TAXONOMY[industry];
    if (!industryConfig) return false;
    return industryConfig.antiKeywords.some((antiKeyword: string) => 
      text.includes(antiKeyword.toLowerCase())
    );
  };

  // Automotive OEM signals
  if (/\b(build & price|msrp|dealer|warranty|trim|rav4|tacoma|iihs|nhtsa|towing|cargo)\b/.test(text) && !hasAntiKeywords('automotive_oem')) {
    const score = (text.match(/\b(build|msrp|dealer|trim|iihs|nhtsa)/g) || []).length / 10;
    votes.push({
      key: 'automotive_oem',
      score: Math.min(1, score + 0.3),
      signals: ['build_price', 'dealer', 'safety']
    });
  }

  // Retail signals
  if (/\b(shipping|returns|cart|checkout|in stock|store locator)\b/.test(text) && !hasAntiKeywords('retail')) {
    const score = (text.match(/\b(shipping|returns|cart|checkout)/g) || []).length / 8;
    votes.push({
      key: 'retail',
      score: Math.min(1, score + 0.2),
      signals: ['shipping', 'returns', 'cart']
    });
  }

  // Financial services
  if (/\b(apr|rates|mortgage|loan|insurance|account|branch|atm)\b/.test(text) && !hasAntiKeywords('financial_services')) {
    const score = (text.match(/\b(apr|rates|loan|insurance)/g) || []).length / 8;
    votes.push({
      key: 'financial_services',
      score: Math.min(1, score + 0.2),
      signals: ['rates', 'accounts', 'branch']
    });
  }

  // Healthcare Provider (but NOT pharmaceutical, insurance, devices)
  if (/\b(appointments|doctors|patient|medical|hospital|clinic)\b/.test(text) && !hasAntiKeywords('healthcare_provider')) {
    const score = (text.match(/\b(appointments|doctors|patient)/g) || []).length / 8;
    votes.push({
      key: 'healthcare_provider',
      score: Math.min(1, score + 0.2),
      signals: ['appointments', 'doctors']
    });
  }
  
  // Pharmaceutical (new explicit check)
  if (/\b(fda approved|prescription|clinical trial|drug|medication|vaccine|pharmaceutical)\b/.test(text) && !hasAntiKeywords('pharmaceutical')) {
    const score = (text.match(/\b(fda approved|prescription|drug|vaccine)/g) || []).length / 6;
    votes.push({
      key: 'pharmaceutical',
      score: Math.min(1, score + 0.3),
      signals: ['fda', 'prescription', 'drug']
    });
  }

  // Travel (air)
  if (/\b(flight|baggage|miles|fare|airline|routes)\b/.test(text) && !hasAntiKeywords('travel_air')) {
    const score = (text.match(/\b(flight|baggage|fare)/g) || []).length / 8;
    votes.push({
      key: 'travel_air',
      score: Math.min(1, score + 0.2),
      signals: ['flights', 'baggage']
    });
  }

  // Travel & Tourism (hotels, attractions, destinations)
  if (/\b(hotel|vacation|things to do|attractions|visit|tourism|travel guide|restaurants?|destination)\b/.test(text) && !hasAntiKeywords('travel_hotels')) {
    const score = (text.match(/\b(hotel|vacation|visit|tourism|attractions|things to do)/g) || []).length / 6;
    votes.push({
      key: 'travel_hotels',
      score: Math.min(1, score + 0.35), // Higher base score for strong tourism signals
      signals: ['hotels', 'vacation', 'attractions']
    });
  }

  return votes.sort((a, b) => b.score - a.score);
}

/**
 * Resolve industry with precedence:
 * 1. Explicit override (project/audit)
 * 2. Domain rules (from config)
 * 3. Heuristics vote
 * 4. AI Classifier (if enabled and needed)
 * 5. Default industry
 */
export async function resolveIndustry(ctx: {
  audit?: { industry?: IndustryKey; industry_source?: string };
  project?: { industry_override?: IndustryKey | null };
  override?: IndustryKey | null;
  signals: IndustrySignals;
  env?: any;  // For AI classifier
  root_url?: string;
  site_description?: string;
}): Promise<IndustryLock> {
  // 1. Explicit override
  if (ctx.override) {
    const v2Slug = ensureV2Slug(ctx.override);
    return {
      value: v2Slug,
      source: 'override',
      locked: true,
      ancestors: getAncestorSlugs(v2Slug)
    };
  }

  // 2. Project-level override
  if (ctx.project?.industry_override) {
    const v2Slug = ensureV2Slug(ctx.project.industry_override);
    return {
      value: v2Slug,
      source: 'override',
      locked: true,
      ancestors: getAncestorSlugs(v2Slug)
    };
  }

  // 3. Already locked in audit
  if (ctx.audit?.industry) {
    const v2Slug = ensureV2Slug(ctx.audit.industry);
    return {
      value: v2Slug,
      source: (ctx.audit.industry_source as any) || 'override',
      locked: true,
      ancestors: getAncestorSlugs(v2Slug)
    };
  }

  const domain = ctx.signals.domain.toLowerCase();

  // 4. Domain rules (whitelist - no AI needed)
  const domainRules = getDomainRules();
  const byDomain = domainRules[domain];
  if (byDomain) {
    const v2Slug = ensureV2Slug(byDomain as string);
    return {
      value: v2Slug,
      source: 'domain_rules',
      locked: true,
      ancestors: getAncestorSlugs(v2Slug),
      confidence: 1.0  // Domain rules are 100% confident
    };
  }

  // 5. Heuristics (run but don't return yet - used for fusion)
  const votes = heuristicsVote(ctx.signals);
  const heuristicsResult = votes.length > 0 && votes[0].score > 0.4 ? votes[0] : null;
  
  // 6. AI Classifier (PRIMARY - always call if available)
  const shouldCallAI = ctx.env?.FEATURE_INDUSTRY_AI_CLASSIFY !== '0' && ctx.root_url;
  let aiResult: { industry_key: IndustryKey; confidence: number } | null = null;
  
  if (shouldCallAI) {
    try {
      const { classifyIndustry } = await import('./industry-classifier');
      const result = await Promise.race([
        classifyIndustry({
          domain,
          root_url: ctx.root_url!,
          site_description: ctx.site_description || '',
          project_id: 'default',
          crawl_budget: { homepage: true, timeout_ms: 5000 },
        }),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('AI classifier timeout')), 8000)),
      ]);

      if (result && result.primary.confidence > 0) {
        aiResult = {
          industry_key: result.primary.industry_key,
          confidence: result.primary.confidence
        };
        
        // 🔥 LOWERED THRESHOLD: 0.35 (was 0.40)
        if (result.primary.confidence >= 0.35) {
          const source = result.primary.confidence >= 0.70 ? 'ai_worker' : 'ai_worker_medium_conf';
          
          // 🔥 SCHEMA BOOST: Increase confidence if schema types match industry
          const schemaTypes = ctx.signals.schemaTypes || [];
          const schemaBoost = calculateSchemaBoost(result.primary.industry_key, schemaTypes);
          const boostedAI = Math.min(1.0, result.primary.confidence + schemaBoost);
          
          // 🔥 FUSION: Boost confidence if heuristics agrees
          const heuristicsAgrees = heuristicsResult?.key === result.primary.industry_key;
          const finalConfidence = heuristicsAgrees 
            ? Math.min(1.0, boostedAI + 0.15)  // +15% if heuristics agrees
            : boostedAI;
          
          console.log(`[INDUSTRY_AI] ${domain} → ${result.primary.industry_key} (conf: ${result.primary.confidence.toFixed(3)}, schema: +${schemaBoost.toFixed(2)}, final: ${finalConfidence.toFixed(3)}, heuristics: ${heuristicsAgrees ? 'agrees' : 'differs'}, source: ${source})`);
          
          // Cache high-confidence results to KV
          if (finalConfidence >= 0.70 && ctx.env?.DOMAIN_RULES_KV) {
            try {
              const doc = await ctx.env.DOMAIN_RULES_KV.get('industry_packs_json', 'json') as any || { industry_rules: { domains: {} }, packs: {} };
              doc.industry_rules = doc.industry_rules || {};
              doc.industry_rules.domains = doc.industry_rules.domains || {};
              doc.industry_rules.domains[domain] = result.primary.industry_key;
              await ctx.env.DOMAIN_RULES_KV.put('industry_packs_json', JSON.stringify(doc));
              console.log(`[INDUSTRY_AI] Cached ${domain} → ${result.primary.industry_key} to KV (boosted conf: ${finalConfidence.toFixed(3)})`);
            } catch (kvErr) {
              console.error('[INDUSTRY_AI KV ERROR]', kvErr);
            }
          }
          
          const v2Slug = ensureV2Slug(result.primary.industry_key as string);
          return {
            value: v2Slug,
            source,
            locked: true,
            confidence: finalConfidence,
            ancestors: getAncestorSlugs(v2Slug),
            metadata: {
              alts: result.alts?.slice(0, 3).map(alt => ({
                slug: ensureV2Slug(alt.industry_key as string),
                conf: alt.confidence
              })),
              heuristics_agree: heuristicsAgrees,
              schema_boost: schemaBoost,
              fusion_applied: heuristicsAgrees
            },
            votes
          };
        } else {
          console.log(`[INDUSTRY_AI] ${domain} → ${result.primary.industry_key} (conf: ${result.primary.confidence.toFixed(3)}) - below threshold (0.35), trying heuristics`);
        }
      }
    } catch (aiErr: any) {
      console.log(`[INDUSTRY_AI] Failed for ${domain}: ${aiErr.message || aiErr}`);
    }
  }
  
  // 7. Heuristics fallback (only if AI unavailable or too low confidence)
  if (heuristicsResult && heuristicsResult.score >= 0.5) {
    const v2Slug = ensureV2Slug(heuristicsResult.key as string);
    console.log(`[INDUSTRY_HEURISTICS] ${domain} → ${heuristicsResult.key} (score: ${heuristicsResult.score.toFixed(3)}, AI: ${aiResult ? `${aiResult.industry_key} @ ${aiResult.confidence.toFixed(3)}` : 'unavailable'})`);
    return {
      value: v2Slug,
      source: 'heuristics',
      locked: true,
      ancestors: getAncestorSlugs(v2Slug),
      votes: votes.slice(0, 3),
      confidence: heuristicsResult.score
    };
  }

  // 8. Default fallback
  const defaultIndustry = getDefaultIndustry();
  const v2Slug = ensureV2Slug(defaultIndustry) as IndustryKey;
  console.log(`[INDUSTRY_DEFAULT] ${domain} → ${defaultIndustry} (AI: ${aiResult ? `${aiResult.confidence.toFixed(3)}` : 'N/A'}, heuristics: ${heuristicsResult ? heuristicsResult.score.toFixed(3) : 'N/A'})`);
  return {
    value: v2Slug,
    source: 'default',
    locked: true,
    ancestors: getAncestorSlugs(v2Slug),
    votes,
    confidence: aiResult?.confidence || heuristicsResult?.score
  };
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : 'https://' + url);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return url.toLowerCase().replace(/^www\./, '');
  }
}


/**
 * Industry Resolution & Locking
 * 
 * Resolves industry once per audit and prevents mutations
 */

import { getDomainRules, getDefaultIndustry } from '../config/loader';
import type { IndustryKey, HeuristicVote } from '../config/industry-packs.schema';

export interface IndustryLock {
  value: IndustryKey;
  source: 'override' | 'domain_rules' | 'heuristics' | 'ai_worker' | 'ai_worker_medium_conf' | 'default';
  locked: true;
  votes?: HeuristicVote[];  // For logging/debugging
  confidence?: number;  // AI classifier confidence
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

  // Automotive OEM signals
  if (/\b(build & price|msrp|dealer|warranty|trim|rav4|tacoma|iihs|nhtsa|towing|cargo)\b/.test(text)) {
    const score = (text.match(/\b(build|msrp|dealer|trim|iihs|nhtsa)/g) || []).length / 10;
    votes.push({
      key: 'automotive_oem',
      score: Math.min(1, score + 0.3),
      signals: ['build_price', 'dealer', 'safety']
    });
  }

  // Retail signals
  if (/\b(shipping|returns|cart|checkout|in stock|store locator)\b/.test(text)) {
    const score = (text.match(/\b(shipping|returns|cart|checkout)/g) || []).length / 8;
    votes.push({
      key: 'retail',
      score: Math.min(1, score + 0.2),
      signals: ['shipping', 'returns', 'cart']
    });
  }

  // Financial services
  if (/\b(apr|rates|mortgage|loan|insurance|account|branch|atm)\b/.test(text)) {
    const score = (text.match(/\b(apr|rates|loan|insurance)/g) || []).length / 8;
    votes.push({
      key: 'financial_services',
      score: Math.min(1, score + 0.2),
      signals: ['rates', 'accounts', 'branch']
    });
  }

  // Healthcare
  if (/\b(appointments|doctors|patient|medical|hospital|clinic)\b/.test(text)) {
    const score = (text.match(/\b(appointments|doctors|patient)/g) || []).length / 8;
    votes.push({
      key: 'healthcare_provider',
      score: Math.min(1, score + 0.2),
      signals: ['appointments', 'doctors']
    });
  }

  // Travel (air)
  if (/\b(flight|baggage|miles|fare|airline|routes)\b/.test(text)) {
    const score = (text.match(/\b(flight|baggage|fare)/g) || []).length / 8;
    votes.push({
      key: 'travel_air',
      score: Math.min(1, score + 0.2),
      signals: ['flights', 'baggage']
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
    return {
      value: ctx.override,
      source: 'override',
      locked: true
    };
  }

  // 2. Project-level override
  if (ctx.project?.industry_override) {
    return {
      value: ctx.project.industry_override,
      source: 'override',
      locked: true
    };
  }

  // 3. Already locked in audit
  if (ctx.audit?.industry) {
    return {
      value: ctx.audit.industry,
      source: (ctx.audit.industry_source as any) || 'override',
      locked: true
    };
  }

  const domain = ctx.signals.domain.toLowerCase();

  // 4. Domain rules
  const domainRules = getDomainRules();
  const byDomain = domainRules[domain];
  if (byDomain) {
    return {
      value: byDomain as IndustryKey,
      source: 'domain_rules',
      locked: true
    };
  }

  // 5. Heuristics
  const votes = heuristicsVote(ctx.signals);
  const heuristicsResult = votes.length > 0 && votes[0].score > 0.4 ? votes[0] : null;
  
  // 6. AI Classifier (if enabled and no strong match yet)
  const shouldCallAI = (
    !heuristicsResult || (heuristicsResult && heuristicsResult.score < 0.6)
  ) && ctx.env?.FEATURE_INDUSTRY_AI_CLASSIFY !== '0' && ctx.root_url;
  
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

      if (result && result.primary.confidence >= 0.40) {
        const source = result.primary.confidence >= 0.70 ? 'ai_worker' : 'ai_worker_medium_conf';
        console.log(`[INDUSTRY_AI] ${domain} → ${result.primary.industry_key} (conf: ${result.primary.confidence.toFixed(3)}, source: ${source})`);
        
        // Cache high-confidence results to KV
        if (result.primary.confidence >= 0.70 && ctx.env?.DOMAIN_RULES_KV) {
          try {
            const doc = await ctx.env.DOMAIN_RULES_KV.get('industry_packs_json', 'json') as any || { industry_rules: { domains: {} }, packs: {} };
            doc.industry_rules = doc.industry_rules || {};
            doc.industry_rules.domains = doc.industry_rules.domains || {};
            doc.industry_rules.domains[domain] = result.primary.industry_key;
            await ctx.env.DOMAIN_RULES_KV.put('industry_packs_json', JSON.stringify(doc));
            console.log(`[INDUSTRY_AI] Cached ${domain} → ${result.primary.industry_key} to KV`);
          } catch (kvErr) {
            console.error('[INDUSTRY_AI KV ERROR]', kvErr);
          }
        }
        
        return {
          value: result.primary.industry_key,
          source,
          locked: true,
          confidence: result.primary.confidence,
          votes
        };
      } else if (result) {
        console.log(`[INDUSTRY_AI] ${domain} → ${result.primary.industry_key} (conf: ${result.primary.confidence.toFixed(3)}) - TOO LOW, using heuristics or default`);
      }
    } catch (aiErr: any) {
      console.log(`[INDUSTRY_AI] Failed for ${domain}: ${aiErr.message || aiErr}`);
    }
  }
  
  // 7. Use heuristics if we have them
  if (heuristicsResult) {
    return {
      value: heuristicsResult.key,
      source: 'heuristics',
      locked: true,
      votes: votes.slice(0, 3)
    };
  }

  // 8. Default
  return {
    value: getDefaultIndustry() as IndustryKey,
    source: 'default',
    locked: true,
    votes
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


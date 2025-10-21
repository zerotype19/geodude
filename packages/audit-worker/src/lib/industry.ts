/**
 * Industry Resolution & Locking
 * 
 * Resolves industry once per audit and prevents mutations
 */

import { getDomainRules, getDefaultIndustry } from '../config/loader';
import type { IndustryKey, HeuristicVote } from '../config/industry-packs.schema';

export interface IndustryLock {
  value: IndustryKey;
  source: 'override' | 'domain_rules' | 'heuristics' | 'default';
  locked: true;
  votes?: HeuristicVote[];  // For logging/debugging
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
 * 4. Default industry
 */
export function resolveIndustry(ctx: {
  audit?: { industry?: IndustryKey; industry_source?: string };
  project?: { industry_override?: IndustryKey | null };
  override?: IndustryKey | null;
  signals: IndustrySignals;
}): IndustryLock {
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
  if (votes.length > 0 && votes[0].score > 0.4) {
    return {
      value: votes[0].key,
      source: 'heuristics',
      locked: true,
      votes: votes.slice(0, 3)
    };
  }

  // 6. Default
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


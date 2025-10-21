/**
 * Industry Config Loader
 * 
 * Loads industry packs from default JSON + KV overrides
 */

import baseConfig from './industry-packs.default.json';
import type { IndustryConfig, IndustryPacks, IndustryRules, IntentPack } from './industry-packs.schema';

let INDUSTRY_PACKS: IndustryPacks = baseConfig.packs as unknown as IndustryPacks;
let INDUSTRY_RULES: IndustryRules = baseConfig.industry_rules;
let loaded = false;

export interface Env {
  DOMAIN_RULES_KV?: KVNamespace;
}

/**
 * Load industry config from KV (call once at worker boot)
 */
export async function loadIndustryConfig(env: Env): Promise<void> {
  if (loaded) return;
  
  try {
    const txt = await env.DOMAIN_RULES_KV?.get('industry_packs_json');
    if (!txt) {
      console.log('[INDUSTRY] Using default config');
      loaded = true;
      return;
    }

    const cfg: IndustryConfig = JSON.parse(txt);
    
    if (cfg.packs) {
      INDUSTRY_PACKS = cfg.packs;
    }
    
    if (cfg.industry_rules) {
      INDUSTRY_RULES = cfg.industry_rules;
    }

    const packCount = Object.keys(INDUSTRY_PACKS).length;
    const domainCount = Object.keys(INDUSTRY_RULES.domains || {}).length;
    
    console.log(`[INDUSTRY] Loaded from KV: packs=${packCount} domain_rules=${domainCount}`);
    loaded = true;
  } catch (error) {
    console.error('[INDUSTRY] KV load failed, using defaults:', error);
    loaded = true;
  }
}

/**
 * Get industry pack with inheritance flattening
 */
export function getIndustryPack(key: string): IntentPack | undefined {
  return INDUSTRY_PACKS[key as keyof typeof INDUSTRY_PACKS];
}

/**
 * Get flattened pack (with inherited tags)
 */
export function getFlattenedPack(key: string): {
  allow: Set<string>;
  deny: Set<string>;
} {
  const seen = new Set<string>();
  const allow = new Set<string>();
  const deny = new Set<string>();
  const stack = [key];

  while (stack.length > 0) {
    const k = stack.pop()!;
    if (seen.has(k)) continue;
    seen.add(k);

    const pack = INDUSTRY_PACKS[k as keyof typeof INDUSTRY_PACKS];
    if (!pack) continue;

    // Add tags
    (pack.allow_tags || []).forEach(t => allow.add(t.toLowerCase()));
    (pack.deny_phrases || []).forEach(p => deny.add(p.toLowerCase()));

    // Add parents to stack
    (pack.inherits || []).forEach(parent => stack.push(parent));
  }

  return { allow, deny };
}

/**
 * Get industry rules
 */
export function getIndustryRules(): IndustryRules {
  return INDUSTRY_RULES;
}

/**
 * Get domain → industry mapping
 */
export function getDomainRules(): Record<string, string> {
  return INDUSTRY_RULES.domains || {};
}

/**
 * Get default industry
 */
export function getDefaultIndustry(): string {
  return INDUSTRY_RULES.default_industry || 'generic_consumer';
}


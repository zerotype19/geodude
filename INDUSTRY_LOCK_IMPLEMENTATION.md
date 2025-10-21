# Industry Lock Implementation - Complete Bundle

**Status**: Ready for Implementation  
**Priority**: P0 (Fixes Toyota misclassification)  
**Estimated Effort**: 2-3 days  
**Rollout**: 8 PRs (can combine for speed)

---

## 🎯 Problem Statement

**Current Issues:**
1. Toyota.com classified as retail → wrong prompts ("return policy", "shipping")
2. Industry changes mid-run → inconsistent scoring
3. Source clients hitting 429s → wasted budget
4. No separation between answered vs. cited results

**Solution:**
- Lock industry once at audit level
- Config-driven intent packs (not hardcoded)
- Guard against downstream mutations
- Source client hardening with circuit breakers
- Clean separation of success vs. error metrics

---

## 📦 Implementation Order

### PR 0: Industry Taxonomy + Intent Packs (Foundation)
**Files Created:**
- `packages/audit-worker/src/config/industry-packs.schema.ts`
- `packages/audit-worker/src/config/industry-packs.default.json`
- `packages/audit-worker/src/config/loader.ts`

### PR 1: Industry Resolver + Lock
**Files Created:**
- `packages/audit-worker/src/lib/industry.ts`
- `packages/audit-worker/src/lib/guards.ts`
- `packages/audit-worker/migrations/2025-10-22_industry_lock.sql`

### PR 2: Domain Rules (KV Loading)
**Files Modified:**
- `packages/audit-worker/wrangler.toml`
- `packages/audit-worker/src/config/loader.ts`

### PR 3: Intent Filtering (Pack-Driven)
**Files Created:**
- `packages/audit-worker/src/lib/intent-guards.ts`

### PR 4: Narrow Llama's Job
**Files Modified:**
- Search: "llama", "contextual engine", "v2-contextual"
- Remove industry classification from Llama prompts

### PR 5: Source Client Hardening
**Files Created:**
- `packages/audit-worker/src/lib/source-client.ts`

### PR 6: Run Logging Normalization
**Files Modified:**
- Citations pipeline entry
- Prompts V4
- Source wrappers

### PR 7: Acceptance Tests
**Files Created:**
- `packages/audit-worker/scripts/test_citations_toyota.ts`
- `packages/audit-worker/scripts/test_industries.ts`

### PR 8: Documentation
**Files Created:**
- `docs/industry-lock.md`
- `docs/intent-packs.md`

---

## 🔧 Complete Implementation

### PR 0: Industry Taxonomy (Foundation)

#### File: `packages/audit-worker/src/config/industry-packs.schema.ts`

```typescript
/**
 * Industry Taxonomy & Intent Packs
 * 
 * Config-driven approach to industry resolution and intent filtering
 */

export type IndustryKey = 
  | "automotive_oem"
  | "automotive_dealer"
  | "retail"
  | "financial_services"
  | "healthcare_provider"
  | "travel_air"
  | "travel_hotels"
  | "saas_b2b"
  | "ecommerce_fashion"
  | "generic_consumer"
  | "unknown";

export interface IntentPack {
  allow_tags: string[];           // Tags we want (e.g., "msrp", "warranty")
  deny_phrases?: string[];        // Raw phrases to block
  inherits?: IndustryKey[];       // Inheritance chain
  description?: string;           // Human-readable description
}

export type IndustryPacks = Record<IndustryKey, IntentPack>;

export interface IndustryRules {
  domains?: Record<string, IndustryKey>;  // Domain → industry mapping
  default_industry?: IndustryKey;         // Fallback when unknown
}

export interface IndustryConfig {
  industry_rules: IndustryRules;
  packs: IndustryPacks;
}

export interface HeuristicVote {
  key: IndustryKey;
  score: number;
  signals: string[];  // Which signals contributed
}
```

#### File: `packages/audit-worker/src/config/industry-packs.default.json`

```json
{
  "industry_rules": {
    "default_industry": "generic_consumer",
    "domains": {
      "toyota.com": "automotive_oem",
      "ford.com": "automotive_oem",
      "gm.com": "automotive_oem",
      "honda.com": "automotive_oem",
      "nissan-usa.com": "automotive_oem",
      "hyundai.com": "automotive_oem",
      "kia.com": "automotive_oem",
      "bmw.com": "automotive_oem",
      "mercedes-benz.com": "automotive_oem",
      "tesla.com": "automotive_oem",
      "bestbuy.com": "retail",
      "target.com": "retail",
      "walmart.com": "retail",
      "amazon.com": "retail",
      "chase.com": "financial_services",
      "wellsfargo.com": "financial_services",
      "usaa.com": "financial_services",
      "mayoclinic.org": "healthcare_provider",
      "clevelandclinic.org": "healthcare_provider",
      "delta.com": "travel_air",
      "united.com": "travel_air",
      "marriott.com": "travel_hotels"
    }
  },
  "packs": {
    "generic_consumer": {
      "allow_tags": [
        "pricing",
        "reviews",
        "reliability",
        "warranty",
        "safety_ratings",
        "customer_service",
        "locations",
        "hours",
        "contact"
      ],
      "description": "Base consumer intent pack - inherited by all industries"
    },
    "automotive_oem": {
      "allow_tags": [
        "msrp",
        "build_price",
        "trim_compare",
        "dealer_locator",
        "financing",
        "lease",
        "warranty",
        "maintenance",
        "reliability",
        "safety_ratings",
        "iihs",
        "nhtsa",
        "towing",
        "cargo",
        "range",
        "mpg",
        "cpo",
        "certified_preowned",
        "owners_manual",
        "recalls",
        "trade_in",
        "test_drive",
        "inventory",
        "delivery"
      ],
      "deny_phrases": [
        "return policy",
        "free returns",
        "promo code",
        "store credit",
        "shipping",
        "exchange policy",
        "gift card",
        "in stock online",
        "add to cart",
        "checkout"
      ],
      "inherits": ["generic_consumer"],
      "description": "Automotive OEM (Toyota, Ford, GM, etc.)"
    },
    "retail": {
      "allow_tags": [
        "price",
        "discounts",
        "sales",
        "store_locator",
        "shipping",
        "returns",
        "availability",
        "in_stock",
        "delivery",
        "pickup",
        "gift_cards",
        "loyalty_program"
      ],
      "deny_phrases": [
        "iihs",
        "nhtsa",
        "towing capacity",
        "mpg",
        "trim levels",
        "dealer",
        "test drive"
      ],
      "inherits": ["generic_consumer"],
      "description": "Retail stores (Best Buy, Target, etc.)"
    },
    "financial_services": {
      "allow_tags": [
        "rates",
        "apr",
        "eligibility",
        "prequalify",
        "coverage",
        "claims",
        "fees",
        "branch_locator",
        "atm_locator",
        "account_types",
        "credit_score",
        "mortgage",
        "investment",
        "insurance"
      ],
      "deny_phrases": [
        "shipping",
        "return policy",
        "in stock",
        "towing capacity"
      ],
      "inherits": ["generic_consumer"],
      "description": "Banks, credit unions, insurance (Chase, USAA, etc.)"
    },
    "healthcare_provider": {
      "allow_tags": [
        "appointments",
        "insurance_accepted",
        "specialties",
        "doctors",
        "locations",
        "emergency",
        "patient_portal",
        "medical_records",
        "billing",
        "conditions_treated"
      ],
      "deny_phrases": [
        "shipping",
        "return policy",
        "promo code",
        "gift card"
      ],
      "inherits": ["generic_consumer"],
      "description": "Hospitals, clinics, medical practices"
    },
    "travel_air": {
      "allow_tags": [
        "baggage",
        "fare_classes",
        "loyalty_miles",
        "status_benefits",
        "change_policy",
        "cancellation",
        "on_time",
        "route_map",
        "fleet",
        "check_in",
        "seat_selection"
      ],
      "deny_phrases": [
        "return policy",
        "shipping",
        "towing capacity",
        "mpg"
      ],
      "inherits": ["generic_consumer"],
      "description": "Airlines (Delta, United, etc.)"
    },
    "travel_hotels": {
      "allow_tags": [
        "room_types",
        "amenities",
        "loyalty_program",
        "cancellation_policy",
        "check_in",
        "parking",
        "dining",
        "spa",
        "meeting_rooms"
      ],
      "deny_phrases": [
        "towing capacity",
        "mpg",
        "trim levels"
      ],
      "inherits": ["generic_consumer"],
      "description": "Hotels and resorts (Marriott, Hilton, etc.)"
    },
    "saas_b2b": {
      "allow_tags": [
        "pricing",
        "plans",
        "enterprise",
        "api",
        "integrations",
        "security",
        "compliance",
        "support",
        "sla",
        "documentation",
        "trial"
      ],
      "deny_phrases": [
        "shipping",
        "return policy",
        "in stock"
      ],
      "inherits": ["generic_consumer"],
      "description": "B2B Software (Salesforce, Slack, etc.)"
    },
    "ecommerce_fashion": {
      "allow_tags": [
        "sizing",
        "fit_guide",
        "materials",
        "care_instructions",
        "shipping",
        "returns",
        "exchange",
        "availability",
        "new_arrivals",
        "sales"
      ],
      "deny_phrases": [
        "towing capacity",
        "mpg",
        "dealer",
        "test drive"
      ],
      "inherits": ["retail"],
      "description": "Fashion e-commerce"
    },
    "unknown": {
      "allow_tags": [],
      "deny_phrases": [],
      "inherits": ["generic_consumer"],
      "description": "Fallback for unclassified sites"
    }
  }
}
```

#### File: `packages/audit-worker/src/config/loader.ts`

```typescript
/**
 * Industry Config Loader
 * 
 * Loads industry packs from default JSON + KV overrides
 */

import baseConfig from './industry-packs.default.json';
import type { IndustryConfig, IndustryPacks, IndustryRules, IntentPack } from './industry-packs.schema';

let INDUSTRY_PACKS: IndustryPacks = baseConfig.packs as IndustryPacks;
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
  return INDUSTRY_PACKS[key];
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

    const pack = INDUSTRY_PACKS[k];
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
```

---

### PR 1: Industry Resolver + Lock

#### File: `packages/audit-worker/src/lib/industry.ts`

```typescript
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
```

#### File: `packages/audit-worker/src/lib/guards.ts`

```typescript
/**
 * Industry Mutation Guards
 * 
 * Prevents downstream modules from changing locked industry
 */

/**
 * Guard against industry mutation attempts
 */
export function guardIndustryMutation(
  current: string,
  attempted: string,
  moduleName: string
): string {
  if (current !== attempted) {
    console.warn(
      `[GUARD] industry_mutation_blocked module=${moduleName} attempted=${attempted} locked=${current}`
    );
  }
  return current;
}

/**
 * Normalize brand grammar (e.g., "Toyotas" → "Toyota vehicles")
 */
export function normalizeBrandGrammar(text: string, brand: string): string {
  // Handle pluralized brand names
  const regex = new RegExp(`\\b${brand}s\\b`, 'gi');
  return text.replace(regex, `${brand} vehicles`);
}
```

#### File: `packages/audit-worker/migrations/2025-10-22_industry_lock.sql`

```sql
-- Industry Lock Migration
-- Add fields to lock industry at audit level

-- Add industry fields to audits table
ALTER TABLE audits ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS industry_source TEXT; 
-- Values: 'override' | 'domain_rules' | 'heuristics' | 'default'
ALTER TABLE audits ADD COLUMN IF NOT EXISTS industry_locked INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_audits_industry ON audits(industry);

-- Add industry override to projects table (optional)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS industry_override TEXT;

-- Migration complete
SELECT 'Industry lock migration complete' as status;
```

---

*Continuing in next message due to length...*


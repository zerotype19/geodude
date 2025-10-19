/**
 * V4 LLM-native query generator
 * Uses Workers AI to generate natural queries from structured context
 */

import { getAI } from '../utils/ai';
import {
  PROMPTS_LLM_MODEL,
  PROMPTS_LLM_MODEL_HIGH,
  PROMPTS_LLM_USE_HIGH_QUALITY,
  PROMPTS_LLM_RETRIES,
  PROMPTS_V4_TIMEOUT_MS,
  PROMPTS_BRANDED_MAX,
  PROMPTS_NONBRANDED_MAX
} from '../config';
import { realismScore } from './score';
import { dedupeKeepOrder } from './normalize';
import { brandLeak as detectBrandLeak, buildLeakRegex, type BrandLeakCtx } from './brandLeak';
import { buildMinimalSafeSet, type MSSInput } from './minimalSafeSet';
import { buildMinimalSafeSetV2 } from './v2/minimalSafe';
import { INDUSTRY_V2_ENABLED } from '../config';

// Brand aliases for more natural queries
const BRAND_ALIASES: Record<string, string[]> = {
  "american express": ["Amex", "AmEx"],
  "chase": ["Chase Bank"],
  "bank of america": ["BofA", "Bank of America"],
  "paypal": ["PayPal"],
  "mastercard": ["MasterCard"],
  "citibank": ["Citi", "Citibank"],
  "wells fargo": ["Wells", "Wells Fargo"],
  "capital one": ["CapitalOne", "Capital One"]
};

/**
 * Check if query has bad plural forms of brand (e.g., "Cologuards", "Cologuardes")
 */
function isBadPluralBrand(q: string, brand: string, aliases: string[]): boolean {
  const toks = [brand, ...aliases].flatMap(b => [b, b.toLowerCase(), b.toUpperCase()]);
  return toks.some(t => {
    const base = t.replace(/[^\w]/g, '');
    const patterns = [
      new RegExp(`\\b${base}s\\b`, 'i'),
      new RegExp(`\\b${base}es\\b`, 'i'),
      new RegExp(`\\b${base}s'\\b`, 'i'),
    ];
    return patterns.some(p => p.test(q));
  });
}

/**
 * Check if query needs capitalization fix (brand name in lowercase)
 */
function needsCapitalizationFix(q: string, brand: string, aliases: string[]): boolean {
  const tokens = [brand, ...aliases];
  return tokens.some(t => {
    const lower = t.toLowerCase();
    return q.includes(lower) && !q.includes(t);
  });
}

/**
 * Fix capitalization of brand names in query
 */
function fixCapitalization(q: string, brand: string, aliases: string[]): string {
  let out = q;
  [brand, ...aliases].forEach(t => {
    const re = new RegExp(`\\b${t.toLowerCase()}\\b`, 'gi');
    out = out.replace(re, t);
  });
  // Capitalize first word if needed
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * Check if non-branded query passes health.providers context (screening test relevance)
 */
function passesHealthTestContext(q: string): boolean {
  const requiredStems = [
    "colon", "screen", "stool", "dna", "fit", "colonoscopy",
    "false positive", "false negative", "accuracy", "sensitivity",
    "insurance", "coverage", "at-home", "kit", "mail", "sample",
    "guidelines", "age", "interval", "uspstf", "fecal", "test",
    "exam", "detect", "cancer", "polyp", "blood", "result"
  ];
  const s = q.toLowerCase();
  return requiredStems.some(k => s.includes(k));
}

const JSON_SCHEMA = `
Return ONLY valid minified JSON:
{"branded":[<strings>],"nonBranded":[<strings>]}
Rules:
- Target 10-16 branded, 16-24 nonBranded. We'll trim to 10/18.
- No duplicates or near-duplicates. No repeated words (e.g., "cruises cruises").
- **CRITICAL: NonBranded MUST NOT contain the brand name, nicknames, or any part of the brand (no "broadway", "broadways", etc. if brand is Broadway).**
- NonBranded should be generic category/industry queries (e.g., "best theaters in NYC", "broadway shows tickets online", NOT "Broadway.com tickets").
- 6–120 chars each. Natural human phrasing, present tense preferred.
- Cover intent quotas:
  • 3 trust/safety queries
  • 3 cost/fees queries
  • 3 features/benefits queries
  • 3 comparison queries
  • 3 eligibility/requirements queries
  • 3 troubleshooting/support queries
  • 2 merchant-acceptance (for payments/credit brands)
- Mix general and long-tail queries.
- For finance/insurance: use neutral, non-advisory phrasing ('How does…', 'What are…').
- Use locale-appropriate terms (US: 'credit score', 'annual fee'; UK: 'APR').
- Avoid 3+ commas or "and/or" constructions.
`;

/**
 * Padding helpers for ensuring minimum counts
 */
function padNonBranded(cat: string): string[] {
  const plural = /s$/i.test(cat) ? cat : `${cat}s`;
  
  // Special handling for insurance companies
  if (/insurance|insurer|coverage|policy|premium/i.test(cat)) {
    const type = cat.match(/auto|home|life|health/i)?.[0] || 'insurance';
    return [
      `Best ${type} insurance companies`,
      `${type} insurance reviews`,
      `${type} insurance comparison`,
      `Cheapest ${type} insurance`,
      `Top ${type} insurance providers`,
      `${type} insurance ratings`
    ];
  }
  
  // Special handling for financial services / trading platforms
  if (/trading|investment|stock|broker|crypto|exchange|financial|brokerage/i.test(cat)) {
    return [
      `Best trading platforms`,
      `Best investment apps`,
      `Trading platforms comparison`,
      `Investment platform reviews`,
      `Best apps for stock trading`,
      `Commission-free trading platforms`
    ];
  }
  
  // Special handling for sports/athletic gear
  if (/soccer|football|basketball|baseball|tennis|hockey|sport|athletic|team|jersey|cleat/i.test(cat)) {
    const sport = cat.match(/(soccer|football|basketball|baseball|tennis|hockey)/i)?.[0] || 'sports';
    return [
      `Where to buy ${sport} jerseys online`,
      `Best sites for ${sport} gear for teams`,
      `${sport} team kits online`,
      `Custom ${sport} jerseys`,
      `Youth ${sport} equipment online`,
      `${sport} cleats online`
    ];
  }
  
  // Special handling for guitar/music: marketplace vs store vs brand
  if (/guitar|instrument|music/i.test(cat)) {
    const isMarketplace = /marketplace|platform|exchange|hub/i.test(cat);
    const isStore = /store|shop|retailer/i.test(cat);
    
    if (isMarketplace) {
      // Music marketplace queries
      return [
        `Used musical instruments online`,
        `Online marketplaces for music gear`,
        `Where to buy used guitars online`,
        `Best platforms for selling music equipment`,
        `Used music gear marketplaces`,
        `Vintage instrument marketplaces`
      ];
    } else if (isStore) {
      // Guitar store queries
      return [
        `Where to buy guitars online`,
        `Best music stores for beginners`,
        `Guitar store price comparison`,
        `Music store customer reviews`,
        `Guitar store return policies`,
        `Online guitar retailers`
      ];
    } else {
      // Guitar brand queries (when cat doesn't indicate store/marketplace)
      return [
        `Best guitar brands`,
        `Guitar brand comparison`,
        `Top guitar manufacturers`,
        `Which guitar brand is best`,
        `Electric guitar brands`,
        `Acoustic guitar brands`
      ];
    }
  }
  
  // Default customer-focused queries (shopping, comparing, buying)
  return [
    `Best ${plural} for beginners`,
    `${cat} price comparison`,
    `Where to buy from ${plural} online`,
    `${cat} customer reviews`,
    `${cat} return policy`,
    `${plural} vs competitors`
  ];
}

function padBranded(brand: string, cat: string): string[] {
  return [
    `${brand} reviews`,
    `${brand} prices`,
    `Where to buy from ${brand}`,
    `${brand} vs competitors`,
    `${brand} return policy`,
    `${brand} customer service`
  ];
}

function ensureMinCounts(
  brand: string,
  cats: string[],
  b: string[],
  n: string[]
): { branded: string[]; nonBranded: string[] } {
  const cat = cats[0] || 'platform';
  let branded = [...b];
  let nonBranded = [...n];
  
  if (branded.length < PROMPTS_BRANDED_MAX) {
    branded = [...branded, ...padBranded(brand, cat)];
  }
  if (nonBranded.length < PROMPTS_NONBRANDED_MAX) {
    nonBranded = [...nonBranded, ...padNonBranded(cat)];
  }
  
  return {
    branded: dedupeKeepOrder(branded).slice(0, PROMPTS_BRANDED_MAX),
    nonBranded: dedupeKeepOrder(nonBranded).slice(0, PROMPTS_NONBRANDED_MAX)
  };
}

/**
 * Generate brand aliases for leak detection (enhanced with hyphen/squish/plural)
 */
function brandAliases(brand: string): string[] {
  const b = brand.trim();
  const low = b.toLowerCase();
  const squish = low.replace(/\s+/g, '');
  const hyphen = low.replace(/\s+/g, '-');
  const base = Array.from(new Set([b, low, squish, hyphen, `${squish}s`, `${low}s`]));
  
  // Add known nicknames from BRAND_ALIASES
  const known = BRAND_ALIASES[low] || [];
  return Array.from(new Set([...base, ...known]));
}

/**
 * Get friendly brand aliases for prompt (e.g., "Amex" for "American Express")
 */
function getBrandNicknames(brand: string): string {
  const low = brand.toLowerCase();
  const aliases = BRAND_ALIASES[low];
  if (!aliases || !aliases.length) return '';
  return ` Common nicknames: ${aliases.join(', ')}.`;
}

/**
 * Build contextual examples based on industry/brand
 */
function buildContextualExamples(brand: string, categoryTerms: string[], industry?: string | null): string {
  const firstCategory = categoryTerms[0] || 'service';
  const brandLower = brand.toLowerCase();
  
  // Special case: Entertainment/Theater/Ticketing (Broadway, StubHub, Ticketmaster, etc.)
  if (/theater|entertainment|tickets|shows|broadway|events|venues/i.test(categoryTerms.join(' ')) || 
      /broadway|stubhub|ticketmaster|eventbrite|vivid|seatgeek/i.test(brandLower)) {
    return `Examples of GOOD queries for ${brand}:
Branded (focus on the ${brand} platform/service):
  - "${brand} tickets review"
  - "How to buy tickets on ${brand}"
  - "${brand} vs StubHub"
  - "${brand} refund policy"
  - "Is ${brand} legitimate?"
  - "${brand} fees and charges"
  - "${brand} customer service"
  - "${brand} mobile app"
  - "${brand} ticket prices"
  - "How does ${brand} work?"

NonBranded (generic theater/event/ticket queries - NO brand name):
  - "Where to buy theater tickets online"
  - "Best sites for show tickets"
  - "Online ticket marketplaces"
  - "Theater ticket prices NYC"
  - "Discount theater tickets online"
  - "Legitimate ticket resale sites"
  - "Show ticket comparison sites"
  - "Theater tickets online reviews"

**CRITICAL: NonBranded queries MUST NOT include "${brand}" or "${brandLower}" or variants like "${brandLower}s".**
For example, "best ${brandLower}s for tickets" is WRONG. Use "best theater ticket sites" instead.`;
  }
  
  // Industry-specific examples
  if (industry === 'retail' && /guitar|music|instrument/.test(categoryTerms.join(' '))) {
    // Check type: MARKETPLACE (Reverb, eBay) vs BRAND (Fender, Gibson) vs RETAILER (Guitar Center)
    const isMarketplace = /(reverb|marketplace|platform|exchange|bazaar|hub)/i.test(brand);
    const isManufacturer = !isMarketplace && !/(center|shop|store|warehouse|depot|music|retailer|outlet)/i.test(brand);
    
    if (isMarketplace) {
      // Music marketplace/platform (Reverb, etc.)
      return `Examples of GOOD queries for ${brand}:
Branded (focus on marketplace features, buying/selling used gear):
  - "${brand} used guitars"
  - "${brand} vs eBay for music gear"
  - "How to sell on ${brand}"
  - "${brand} buyer protection"
  - "${brand} seller fees"
  - "${brand} marketplace reviews"
  - "Is ${brand} safe for buying used instruments?"
  - "${brand} used music gear"
  - "${brand} vintage instruments"
  - "Best deals on ${brand}"

NonBranded (CUSTOMER perspective - buying/selling used music gear):
  - "Used musical instruments online"
  - "Online marketplaces for music gear"
  - "Where to buy used guitars online"
  - "Best platforms for selling music equipment"
  - "Used music gear marketplaces"
  - "Vintage instrument marketplaces"
  - "Online music equipment marketplace"
  - "Buy and sell used instruments"

AVOID:
  - Generic ecommerce queries ("shopping cart", "checkout process")
  - Store operations ("payment security", "product availability")`;
    } else if (isManufacturer) {
      // Guitar brand/manufacturer (Fender, Gibson, Martin, etc.)
      return `Examples of GOOD queries for ${brand}:
Branded (focus on product quality, models, comparisons):
  - "${brand} guitar quality"
  - "${brand} vs Gibson comparison"
  - "${brand} guitar models"
  - "Best ${brand} guitars for beginners"
  - "${brand} Stratocaster review"
  - "${brand} acoustic guitars"
  - "${brand} electric guitars"
  - "Are ${brand} guitars good quality?"
  - "${brand} guitar prices"
  - "${brand} guitar reviews"

NonBranded (CUSTOMER perspective - guitar shoppers):
  - "Best guitar brands"
  - "Guitar brand comparison"
  - "Which guitar brand is best for beginners"
  - "Electric guitar brands"
  - "Acoustic guitar brands"
  - "Guitar brand quality comparison"
  - "Top guitar manufacturers"
  - "Guitar brand reviews"

AVOID:
  - Store/retail operations queries ("for small businesses", "setup costs")
  - Generic music store queries (this is a brand, not a store)`;
    } else {
      // Guitar retailer (Guitar Center, Sweetwater, etc.)
      return `Examples of GOOD queries for ${brand}:
Branded:
  - "${brand} guitar prices"
  - "Where to buy guitars from ${brand}"
  - "${brand} return policy"
  - "${brand} customer reviews"
  - "${brand} vs Sweetwater comparison"
  - "Does ${brand} offer financing on instruments?"
  - "${brand} used guitar inventory"
  - "${brand} shipping costs"

NonBranded (CUSTOMER perspective - people shopping for guitars):
  - "Where to buy guitars online"
  - "Best music stores for beginners"
  - "Guitar prices comparison"
  - "Music store return policies"
  - "Online vs in-store guitar shopping"
  - "Music store customer service reviews"
  - "Where to buy used guitars"
  - "Guitar financing options"

AVOID business/vendor queries like:
  - "How to set up a guitar store" (too generic, not customer-focused)
  - "Payment fees for music stores" (business operations, not shopping)`;
    }
  }
  
  // Credit card companies and payment networks
  if (industry === 'finance' || /credit.?card|payment.?network|visa|mastercard|amex|discover/i.test(categoryTerms.join(' '))) {
    return `Examples of GOOD queries for ${brand}:
Branded (focus on cards, rewards, fees, benefits, reviews):
  - "${brand} credit card reviews"
  - "${brand} vs Visa"
  - "${brand} vs Mastercard"
  - "${brand} rewards program"
  - "${brand} annual fee"
  - "${brand} credit card benefits"
  - "Best ${brand} credit cards"
  - "${brand} card acceptance"
  - "${brand} credit card for travel"
  - "${brand} customer service"
  - "${brand} cash back rewards"
  - "${brand} points program"

NonBranded (CUSTOMER perspective - choosing a credit card):
  - "Best credit cards for travel"
  - "Credit card rewards comparison"
  - "Credit cards with no annual fee"
  - "Best cash back credit cards"
  - "Premium credit card benefits"
  - "Credit card for international travel"
  - "Credit card sign-up bonuses"
  - "Best rewards credit cards"
  - "Credit card annual fees comparison"
  - "Credit card acceptance rates"

AVOID:
  - Generic payment processing queries ("platform fees", "merchant services")
  - Business operations ("How to accept payments")
  - Generic finance queries without credit card context`;
  }
  
  // Insurance companies
  if (industry === 'insurance' || /insurance|insurer|coverage|policy|premium|claim/i.test(categoryTerms.join(' '))) {
    const insuranceType = categoryTerms.find(t => /auto|home|life|health/i.test(t)) || 'insurance';
    const typeClean = insuranceType.replace(/\s+(insurance|company|provider).*$/i, '').trim() || 'insurance';
    
    return `Examples of GOOD queries for ${brand}:
Branded (focus on reviews, comparisons, products, pricing):
  - "${brand} insurance reviews"
  - "${brand} vs State Farm"
  - "${brand} vs Geico"
  - "${brand} vs Progressive"
  - "${brand} auto insurance rates"
  - "${brand} home insurance coverage"
  - "Is ${brand} insurance good?"
  - "${brand} customer reviews"
  - "${brand} insurance pricing"
  - "${brand} claims process"

NonBranded (CUSTOMER perspective - shopping for insurance):
  - "Best ${typeClean} insurance companies"
  - "${typeClean} insurance reviews"
  - "${typeClean} insurance comparison"
  - "Cheapest ${typeClean} insurance"
  - "Best rated ${typeClean} insurance"
  - "${typeClean} insurance for good drivers"
  - "Top ${typeClean} insurance providers"
  - "${typeClean} insurance quotes"

AVOID:
  - Generic setup queries ("How do I customize my policy", "setup process")
  - Generic availability queries ("availability options")
  - Business operations ("support small business owners")`;
  }
  
  // Financial services / fintech
  if (industry === 'finance' || /trading|investment|stock|broker|crypto|exchange|financial|fintech/i.test(categoryTerms.join(' '))) {
    const serviceType = categoryTerms.find(t => /trading|investment|stock|broker|crypto|exchange/i.test(t)) || 'trading';
    
    return `Examples of GOOD queries for ${brand}:
Branded (focus on platform reviews, comparisons, features):
  - "${brand} platform reviews"
  - "${brand} vs Robinhood"
  - "${brand} vs TD Ameritrade"
  - "${brand} vs E*TRADE"
  - "Is ${brand} good for beginners?"
  - "${brand} app reviews"
  - "${brand} fees and commissions"
  - "${brand} trading features"
  - "${brand} customer reviews"
  - "${brand} pros and cons"

NonBranded (CUSTOMER perspective - choosing a trading platform):
  - "Best ${serviceType} platforms"
  - "Best investment apps"
  - "Trading platforms comparison"
  - "${serviceType} platform reviews"
  - "Best apps for stock trading"
  - "Commission-free trading platforms"
  - "Best platforms for beginners"
  - "${serviceType} app ratings"

AVOID:
  - Generic feature queries ("investment tool", "trading costs" without context)
  - Generic security queries ("platform safety features")`;
  }
  
  // Sports/athletic retail
  if (industry === 'retail' && /soccer|football|basketball|baseball|tennis|hockey|sport|athletic|team|jersey|cleat/i.test(categoryTerms.join(' '))) {
    // Detect specific sport
    const sport = categoryTerms.find(t => /soccer|football|basketball|baseball|tennis|hockey/i.test(t)) || 'sports';
    const sportClean = sport.replace(/\s+(store|retailer|gear|equipment).*$/i, '').trim();
    
    return `Examples of GOOD queries for ${brand}:
Branded (focus on product selection, team gear, online shopping):
  - "${brand} ${sportClean} jerseys"
  - "Where to buy ${sportClean} cleats from ${brand}"
  - "${brand} team kits"
  - "${brand} vs Dick's Sporting Goods"
  - "${brand} ${sportClean} gear prices"
  - "${brand} custom jerseys"
  - "${brand} youth ${sportClean} equipment"
  - "${brand} return policy"
  - "${brand} shipping costs"
  - "Is ${brand} good for team orders?"

NonBranded (CUSTOMER perspective - shopping for ${sportClean} gear):
  - "Where to buy ${sportClean} jerseys online"
  - "Best sites for ${sportClean} gear for teams"
  - "${sportClean} team kits online"
  - "Custom ${sportClean} jerseys"
  - "Youth ${sportClean} equipment online"
  - "${sportClean} cleats online"
  - "Online ${sportClean} stores"
  - "${sportClean} gear for teams"

AVOID:
  - Generic policy queries ("terms of service", "contact us")
  - Generic store operations ("store policies", "customization options")`;
  }
  
  if (industry === 'travel') {
    return `Examples of GOOD queries for ${brand}:
Branded:
  - "${brand} cruise prices"
  - "${brand} booking process"
  - "${brand} vs Royal Caribbean"
  - "${brand} cancellation policy"

NonBranded:
  - "Best ${firstCategory} for families"
  - "${firstCategory} pricing comparison"
  - "How to book a cruise online"`;
  }
  
  if (industry === 'finance') {
    return `Examples of GOOD queries for ${brand}:
Branded:
  - "How does ${brand} protect buyers?"
  - "${brand} vs Stripe fees"
  - "${brand} business account"

NonBranded:
  - "Best ${firstCategory} for small business"
  - "${firstCategory} comparison"
  - "How do online payment systems work?"`;
  }
  
  // Default examples
  return `Examples of GOOD queries for ${brand}:
Branded:
  - "${brand} pricing"
  - "${brand} customer reviews"
  - "How does ${brand} work?"
  - "${brand} vs competitors"

NonBranded (use category terms, NO brand):
  - "Best ${firstCategory} for [use case]"
  - "${firstCategory} comparison"
  - "How to choose a ${firstCategory}"`;
}

/**
 * Build LLM prompt for query generation
 */
function buildPrompt(params: {
  brand: string;
  domain: string;
  siteType: string;
  industry?: string | null;
  entities: string[];
  categoryTerms: string[];
  schemaTypes: string[];
}) {
  const { brand, domain, siteType, industry, entities, categoryTerms, schemaTypes } = params;

  const sys = `You write realistic search/LLM queries users actually ask.
Priorities: naturalness, coverage of common intents, and diversity.
Avoid robotic phrasing and keyword stuffing.
Use common nicknames where natural (e.g., Amex for American Express).`;

  const contextualExamples = buildContextualExamples(brand, categoryTerms, industry);
  const nicknames = getBrandNicknames(brand);

  const user = `${JSON_SCHEMA}

Context:
- Brand: ${brand}${nicknames}
- Domain: ${domain}
- Site type: ${siteType}
- Industry: ${industry ?? 'unknown'}
- Primary entities (from site): ${entities.slice(0, 6).join(', ') || 'n/a'}
- Category terms to use in nonBranded (no brand names): ${categoryTerms.join(', ')}
- Schema types present: ${schemaTypes.join(', ') || 'n/a'}

Constraints:
- NonBranded queries must use generic category terms (above) and NEVER include the brand or its variants.
- Use natural English. Vary phrasing. Include cost, safety, comparison, and availability angles.
- Prefer concrete nouns over vague tokens.
- Focus on HIGH-VALUE queries from a CUSTOMER/USER perspective (product comparisons, reviews, buying guides, policy questions, "where to buy", pricing).
- AVOID business operations queries (e.g., "how to set up a store", "payment gateway fees", "ecommerce platform costs").
- For retail: focus on shopping, buying, comparing products, prices, reviews, shipping, returns.
- For services: focus on features, pricing, comparisons, support, getting started.

${contextualExamples}

INVALID query patterns (DO NOT produce):
- "Top cruises cruises for lower fees"        // repeated words
- "Best paypals for beginners"                // brand pluralized as common noun
- "How do send saves protect card details"    // unnatural entities
- "Payment payment comparison online"          // repeated tokens
- "Online store setup costs"                   // generic, unrelated to brand's business
- "Payment gateway fees"                       // generic ecommerce, not specific to brand
Your output must NOT contain these issues.

DO NOT output explanations—ONLY the JSON object.`;

  return { sys, user };
}

/**
 * Extract JSON from LLM response (handles code fences and prose)
 */
function extractJsonBlock(s: string): string {
  // Remove code fences
  s = s.replace(/```(?:json)?/gi, '```');
  const fence = /```([\s\S]*?)```/g;
  const m = fence.exec(s);
  if (m && m[1]) s = m[1];

  // Find first {...} that contains "branded" and "nonBranded"
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const slice = s.slice(start, end + 1);
    if (/\"branded\"\s*:/.test(slice) && /\"nonBranded\"\s*:/.test(slice)) {
      return slice;
    }
  }
  
  // Last resort: try raw
  return s;
}

/**
 * Check if query is a business/vendor operation query (not customer-focused)
 */
function isBusinessOperationsQuery(q: string): boolean {
  const lowered = q.toLowerCase();
  const badPatterns = [
    /how to set up (a |an )?[a-z\s]+store/,
    /how to (build|create|start) (a |an )?[a-z\s]+(store|business|platform)/,
    /payment gateway (fees|costs)/,
    /ecommerce platform (costs|fees)/,
    /online store (setup|maintenance) costs/,
    /merchant account fees/,
    /processing fees for/,
    /(setup|maintenance) costs? for/,
    /how to run (a |an )?[a-z\s]+business/,
    /for small businesses$/,  // Catch "Best X for small businesses"
    /for (startups|enterprises|companies|businesses)/,
    // Generic ecommerce/store operations (not customer queries)
    /^shopping cart checkout process$/,
    /^online store payment security$/,
    /^online store product availability$/,
    /checkout process$/,
    /payment security$/,
    /product availability$/,
    // Generic policy/contact queries (not shopping queries)
    /website policy and terms of service$/,
    /terms of service$/,
    /privacy policy$/,
    /\bstore policies$/,
    /\bstore contact$/,
    /contact information$/,
    /ecommerce platform customization/,
    /platform customization/,
    // Generic fintech feature queries (not competitive/review queries)
    /^investment platform safety features$/,
    /^secure online trading platform$/,
    /^availability of investment tools$/,
    /^cost of using a trading platform$/,
    /investment tool$/,
    /trading costs$/,
    // Generic insurance setup/customization queries (not shopping queries)
    /^how do i customize my insurance policy$/,
    /^what are the availability options for insurance policies$/,
    /^what is the process for setting up an insurance policy$/,
    /^what is the setup process for.*insurance\??$/,
    /^how does.*handle claims and disputes\??$/,
    /^how does.*support small business owners\??$/,
    /customize my.*insurance policy$/,
    /availability options for.*insurance$/,
    /fees associated with.*insurance$/
  ];
  return badPatterns.some(rx => rx.test(lowered));
}

/**
 * Clean query text (remove duplicate words, fix pluralization, trim)
 */
function hardClean(q: string, brand: string, categoryTerms: string[]): string {
  // 1) Collapse duplicate tokens
  q = q.replace(/\b(\w+)\s+\1\b/gi, '$1');
  
  // 2) Kill accidental brand plurals like "paypals"
  const bCore = brand.replace(/\s+/g, '');
  const rx = new RegExp(`\\b${bCore}s\\b`, 'ig');
  q = q.replace(rx, brand);
  
  // 3) Ensure category term not doubled like "cruises cruises"
  q = q.replace(/\b(\w+)\s+(\1)\b/gi, '$1');
  
  // 4) Trim punctuation
  q = q.replace(/\s+([?.!,:;])/g, '$1').replace(/\s+/g, ' ').trim();
  
  // 5) Filter trivial lengths
  if (q.length < 8 || q.length > 120) return '';
  
  return q;
}

/**
 * Check if query contains brand (for leak detection)
 * Uses the new enhanced brandLeak detector
 */
function brandLeak(q: string, aliases: string[]): boolean {
  const ctx: BrandLeakCtx = {
    brand: aliases[0] || '',
    aliases: aliases.slice(1)
  };
  return detectBrandLeak(q, ctx);
}

/**
 * Detect repeated bigrams like "cruises cruises" or "payment payment"
 */
function hasRepeatBigram(q: string): boolean {
  const t = q.toLowerCase().split(/\s+/).filter(Boolean);
  for (let i = 0; i < t.length - 3; i++) {
    const a = `${t[i]} ${t[i + 1]}`;
    const b = `${t[i + 2]} ${t[i + 3]}`;
    if (a === b) return true;
  }
  return false;
}

/**
 * Call LLM with retries, timeout, and JSON extraction
 */
async function callLLM(
  env: any,
  sys: string,
  user: string,
  model: string,
  retries: number = 2
): Promise<{ branded: string[]; nonBranded: string[] }> {
  const AI = getAI(env);
  let err: any;
  
  for (let i = 0; i <= retries; i++) {
    try {
      // Wrap AI.run in timeout
      const aiPromise = AI.run(model, {
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ],
        temperature: 0.6,
        max_tokens: 900,
        top_p: 0.9
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('LLM timeout')), PROMPTS_V4_TIMEOUT_MS)
      );
      
      const res: any = await Promise.race([aiPromise, timeoutPromise]);
      
      const txt = String(res?.response ?? res?.output ?? '').trim();
      const payload = extractJsonBlock(txt);
      const json = JSON.parse(payload);
      
      if (json && Array.isArray(json.branded) && Array.isArray(json.nonBranded)) {
        return json;
      }
    } catch (e) {
      err = e;
    }
    
    // Wait with jitter before retry
    await new Promise(r => setTimeout(r, 120 + Math.random() * 180));
  }
  
  throw err ?? new Error('V4 JSON parse failed');
}

/**
 * Generate minimal safe fallback queries
 * Uses industry-specific, guaranteed brand-leak-free queries
 * V2 uses Workers AI embeddings for smart industry detection
 */
async function minimalSafeSet(
  env: any,
  kv: any,
  brand: string,
  domain: string,
  aliases: string[],
  cats: string[],
  industry: string | null,
  siteType: string
): Promise<{
  branded: string[];
  nonBranded: string[];
}> {
  // Use V2 if enabled
  if (INDUSTRY_V2_ENABLED) {
    try {
      const result = await buildMinimalSafeSetV2(env, kv, {
        brand,
        domain,
        aliases,
        industry: industry || undefined,
        categoryTerms: cats,
        siteType
      });
      
      return {
        branded: result.branded,
        nonBranded: result.nonBranded
      };
    } catch (error) {
      console.error('[MSS_V2] Failed, falling back to V1:', error);
      // Fall through to V1
    }
  }
  
  // V1 fallback
  const mssInput: MSSInput = {
    brand,
    aliases,
    industry,
    category_terms: cats,
    persona: 'consumer'
  };
  
  const result = buildMinimalSafeSet(mssInput);
  console.log(JSON.stringify({
    type: 'PROMPTS_V4_MSS_USED',
    domain: brand,
    reason: 'V4 quality gate failed',
    branded: result.branded.length,
    nonBranded: result.nonBranded.length,
    industry: result.metadata?.industry || 'default',
    industry_source: result.metadata?.industry_source || 'unknown',
    realism_score: result.realism_score
  }));
  
  return {
    branded: result.branded,
    nonBranded: result.nonBranded
  };
}

/**
 * V4 Generator: LLM-native query generation
 */
export async function generateQueriesV4(
  env: any,
  input: {
    brand: string;
    domain: string;
    siteType: string;
    industry?: string | null;
    entities: string[];
    categoryTerms: string[];
    schemaTypes: string[];
  }
): Promise<{
  branded: string[];
  nonBranded: string[];
  realismAvg: number;
}> {
  const model = PROMPTS_LLM_USE_HIGH_QUALITY ? PROMPTS_LLM_MODEL_HIGH : PROMPTS_LLM_MODEL;
  
  // HOT PATCH: If industry missing/unknown, ask MSS V2 to detect it (uses HTML + embeddings)
  if (!input.industry || input.industry === "default") {
    try {
      const { buildMinimalSafeSetV2 } = await import('./v2/minimalSafe');
      const aliases = brandAliases(input.brand);
      const m = await buildMinimalSafeSetV2(env, env.RULES, {
        brand: input.brand,
        domain: input.domain,
        aliases,
        categoryTerms: input.categoryTerms,
        siteType: input.siteType
      });
      if (m?.industry && m.industry !== "default") {
        input.industry = m.industry;
        console.log(`[V4_HOT_PATCH] MSS V2 detected industry: ${m.industry} (source: ${m.source})`);
      }
    } catch (error) {
      console.warn('[V4_HOT_PATCH] MSS V2 industry detection failed:', error);
    }
  }
  
  try {
    const { sys, user } = buildPrompt(input);
    const raw = await callLLM(env, sys, user, model, PROMPTS_LLM_RETRIES);

    const aliases = brandAliases(input.brand);
    const cleanedB: string[] = [];
    const cleanedN: string[] = [];
    
    // Observability counters
    let leakCount = 0;
    let repeatCount = 0;
    let cleanedBChecked = 0;
    let cleanedNChecked = 0;

    // Clean branded queries
    let pluralDrops = 0;
    for (const q0 of (raw.branded || [])) {
      let q = hardClean(String(q0), input.brand, input.categoryTerms);
      if (!q) continue;
      cleanedBChecked++;
      
      // Drop bad brand plurals (e.g., "Cologuards")
      if (isBadPluralBrand(q, input.brand, aliases)) {
        pluralDrops++;
        console.log(`[V4] Dropped bad plural: ${q}`);
        continue;
      }
      
      // Fix capitalization if needed
      if (needsCapitalizationFix(q, input.brand, aliases)) {
        const fixed = fixCapitalization(q, input.brand, aliases);
        console.log(`[V4] Fixed capitalization: "${q}" → "${fixed}"`);
        q = fixed;
      }
      
      if (hasRepeatBigram(q)) {
        repeatCount++;
        continue;
      }
      cleanedB.push(q);
    }

    // Clean non-branded queries (with brand leak guard and business operations filter)
    let contextDrops = 0;
    for (const q0 of (raw.nonBranded || [])) {
      const q = hardClean(String(q0), input.brand, input.categoryTerms);
      if (!q) continue;
      cleanedNChecked++;
      if (brandLeak(q, aliases)) {
        leakCount++;
        continue; // Hard guard: no brand in non-branded
      }
      if (hasRepeatBigram(q)) {
        repeatCount++;
        continue;
      }
      if (isBusinessOperationsQuery(q)) {
        console.log(`[V4] Filtered business ops query: ${q}`);
        continue; // Filter out business operations queries
      }
      
      // Health.providers context filter: only test-relevant queries
      if (input.industry === 'health.providers' && !passesHealthTestContext(q)) {
        contextDrops++;
        console.log(`[V4] Dropped non-health-test query: ${q}`);
        continue;
      }
      
      cleanedN.push(q);
    }

    // Deduplicate & trim to max (before padding)
    let branded = dedupeKeepOrder(cleanedB);
    let nonBranded = dedupeKeepOrder(cleanedN);
    
    // Quality gates - check thresholds before padding
    const leakRate = leakCount / Math.max(1, cleanedNChecked);
    const repeatRate = repeatCount / Math.max(1, cleanedBChecked + cleanedNChecked);
    const brandedMin = branded.length >= Math.floor(PROMPTS_BRANDED_MAX * 0.6); // at least 60% before padding
    const nonBrandedMin = nonBranded.length >= Math.floor(PROMPTS_NONBRANDED_MAX * 0.6);
    
    const qualityGate = {
      leakRate,
      repeatRate,
      brandedMin,
      nonBrandedMin,
      brandedCount: branded.length,
      nonBrandedCount: nonBranded.length
    };
    
    // Critical failures: brand leaks or too many repeats (must use MSS)
    if (leakRate > 0.01 || repeatRate > 0.02) {
      console.warn(JSON.stringify({ 
        type: 'PROMPTS_V4_QUALITY_FAIL', 
        domain: input.domain,
        reason: 'leak_or_repeat',
        qualityGate 
      }));
      throw new Error('V4 quality gate failed: leaks or repeats');
    }
    
    // Low count: top-up with MSS instead of failing completely
    const nonBrandedTarget = 11; // 60% of 18
    if (nonBranded.length < nonBrandedTarget) {
      console.log(JSON.stringify({
        type: 'PROMPTS_V4_TOP_UP',
        domain: input.domain,
        current: nonBranded.length,
        target: nonBrandedTarget
      }));
      
      try {
        const aliases = brandAliases(input.brand);
        const mss = await minimalSafeSet(
          env,
          env.RULES,
          input.brand,
          input.domain,
          aliases,
          input.categoryTerms,
          input.industry,
          input.siteType
        );
        
        // Add MSS non-branded until we hit target
        const needed = nonBrandedTarget - nonBranded.length;
        const topUp = mss.nonBranded.slice(0, needed);
        nonBranded = dedupeKeepOrder([...nonBranded, ...topUp]);
        
        console.log(JSON.stringify({
          type: 'PROMPTS_V4_TOPPED_UP',
          domain: input.domain,
          added: topUp.length,
          final: nonBranded.length
        }));
      } catch (topUpError) {
        console.warn('[V4] Top-up failed, proceeding with what we have:', topUpError);
      }
    }
    
    // Track if padding was needed
    const needsPaddingB = branded.length < PROMPTS_BRANDED_MAX;
    const needsPaddingN = nonBranded.length < PROMPTS_NONBRANDED_MAX;
    
    // Ensure min counts with padding
    ({ branded, nonBranded } = ensureMinCounts(input.brand, input.categoryTerms, branded, nonBranded));

    // Sample scoring (first 6 branded + first 10 non-branded)
    const sample = [...branded.slice(0, 6), ...nonBranded.slice(0, 10)];
    const scores: number[] = [];
    for (const q of sample) {
      scores.push(await realismScore(env, q));
    }
    const realismAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.9;

    // Observability logging
    console.log(JSON.stringify({
      type: 'PROMPTS_V4_POST',
      domain: input.domain,
      brand: input.brand,
      dropped_for_leak: leakCount,
      dropped_for_repeat: repeatCount,
      dropped_for_plural: pluralDrops,
      dropped_for_context: contextDrops,
      padded_b: needsPaddingB,
      padded_n: needsPaddingN,
      final_counts: { branded: branded.length, nonBranded: nonBranded.length },
      realism_avg: Math.round(realismAvg * 1000) / 1000
    }));

    return { 
      branded, 
      nonBranded, 
      realismAvg,
      meta: {
        industry: input.industry || "default",
        template_version: "v1.0",
        realism_target: input.industry && input.industry !== "default" ? 0.74 : 0.62
      }
    };
    
  } catch (error) {
    console.error('[V4_GENERATOR] LLM generation failed, using minimal safe set:', error);
    // Return minimal safe fallback with version tag
    const aliases = brandAliases(input.brand);
    const safe = await minimalSafeSet(
      env,
      env.RULES, // KV namespace
      input.brand,
      input.domain,
      aliases,
      input.categoryTerms,
      input.industry,
      input.siteType
    );
    return {
      branded: safe.branded,
      nonBranded: safe.nonBranded,
      realismAvg: 0.72, // Conservative score for MSS
      metaVersion: 'v4-mss', // Mark as Minimal Safe Set fallback
      meta: {
        industry: input.industry || "default",
        template_version: "v1.0",
        realism_target: input.industry && input.industry !== "default" ? 0.74 : 0.62
      }
    };
  }
}

/**
 * Return type for V4 generator (with optional metaVersion)
 */
export interface V4Result {
  branded: string[];
  nonBranded: string[];
  realismAvg: number;
  metaVersion?: string;
}


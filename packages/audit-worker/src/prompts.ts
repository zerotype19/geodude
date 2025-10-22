/**
 * v2-contextual prompt engine (now with v3-archetypes upgrade)
 * Context-aware LLM query generation based on homepage analysis
 */

import { Env } from './index';
import { BRANDED_TEMPLATES, NONBRANDED_TEMPLATES, FEWSHOT_SEEDS, IntentName } from './prompts/intents';
import { humanPlural as humanPluralV3, toSingular, sanitizeBrandInQuery, dedupeKeepOrder } from './prompts/normalize';
import { realismScore } from './prompts/score';
import { inferIndustryFromContext } from './prompts/infer';
import { COMPETITOR_SEEDS, AUDIENCE_SEEDS, PURPOSE_SEEDS } from './prompts/seeds';
import { generateQueriesV4 } from './prompts/generator_v4';
import { normalizeEntities, buildCategoryTerms } from './prompts/categories';
import { inferIndustryV2 } from './prompts/v2/lib/inferIndustryV2';
import { 
  PROMPTS_VERSION, 
  PROMPTS_ENABLE_FEWSHOT_SEEDS, 
  PROMPTS_USE_V3, 
  PROMPTS_USE_V4,
  PROMPTS_V4_AB_PERCENT,
  COLD_START_CLASSIFIER_ENABLED,
  PROMPTS_V4_ROLLOUT_MINUTES,
  PROMPTS_V4_CANARIES,
  PROMPTS_BRANDED_MAX, 
  PROMPTS_NONBRANDED_MAX 
} from './config';

type HomepageRow = {
  domain: string;
  site_description: string | null;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  body_text: string | null;
  og_site_name?: string | null;
  org_name?: string | null;
};

export async function getHomepageContext(env: Env, domain: string): Promise<HomepageRow | null> {
  // Normalize domain for comparison (remove www, protocol, etc.)
  const normDomain = domain.toLowerCase().replace(/^www\./, '').replace(/\/$/, '');
  
  const sql = `
    SELECT ? as domain, a.site_description, a.industry, a.industry_source,
           pa.title, NULL as meta_description, pa.h1, NULL as body_text,
           NULL as og_site_name,
           NULL as org_name
    FROM audits a
    LEFT JOIN audit_pages p ON p.audit_id = a.id
    LEFT JOIN audit_page_analysis pa ON pa.page_id = p.id
    WHERE (
      LOWER(a.root_url) LIKE '%' || ? || '%'
      OR LOWER(a.root_url) LIKE '%www.' || ? || '%'
    )
    AND (p.url IS NULL OR LENGTH(p.url) - LENGTH(REPLACE(p.url, '/', '')) <= 4)
    ORDER BY a.started_at DESC, LENGTH(COALESCE(p.url, '')) ASC
    LIMIT 1
  `;
  const row = await env.DB.prepare(sql).bind(domain, normDomain, normDomain).first<HomepageRow>();
  return row ?? null;
}

export function buildContextBlob(row: HomepageRow, maxBodyChars = 800): string {
  const body = (row.body_text || '').replace(/\s+/g, ' ').slice(0, maxBodyChars);
  return [
    row.domain,
    `Title: ${row.title ?? ''}`,
    `Description: ${row.meta_description ?? ''}`,
    `H1: ${row.h1 ?? ''}`,
    `Summary: ${row.site_description ?? ''}`,
    `Sample body: ${body}`
  ].join('\n');
}

/** 
 * Title-case helper with camelCase detection
 * Handles: hyphens, underscores, and camelCase (e.g., "royalcaribbean" -> "Royal Caribbean")
 */
function titleCaseTokens(s: string) {
  // First, split on explicit separators (space, hyphen, underscore)
  const explicitTokens = s.split(/[\s\-_]+/).filter(Boolean);
  
  // If we have multiple tokens already, just title-case them
  if (explicitTokens.length > 1) {
    return explicitTokens
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  
  // Single token - check for camelCase pattern
  const token = explicitTokens[0] || s;
  
  // Split on uppercase letters (camelCase detection)
  // e.g., "royalCaribbean" or common patterns like "royal" + "caribbean"
  const camelSplit = token.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // Also try to split known compound words
  const withSpaces = camelSplit
    .replace(/([a-z])(caribbean|express|global|united|national|international)/gi, '$1 $2')
    .replace(/([a-z])(cruise|cruises|line|lines|airways|airlines)/gi, '$1 $2')
    .replace(/([a-z])(guitar|center|depot|mart|monkey|world|warehouse)/gi, '$1 $2');
  
  return withSpaces
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Prefer Organization.name JSON-LD > og:site_name > domain prettified > title(before dash) with generic-word guard */
export function extractBrandNameV2(opts: {
  domain: string;
  title?: string | null;
  orgName?: string | null;        // from JSON-LD Organization.name if available
  ogSiteName?: string | null;     // from <meta property="og:site_name">
  siteDescription?: string | null;
}): string {
  const GENERIC = new Set([
    'home','homepage','official site','welcome','products','product','services','service',
    'pricing','blog','support','help','docs','documentation','store','shop','contact',
    'about','careers','login','sign in','download','solutions','platform','cruises','cruise'
  ]);

  // 1) JSON-LD Organization.name
  if (opts.orgName && !GENERIC.has(opts.orgName.toLowerCase())) {
    return opts.orgName.trim();
  }

  // 2) og:site_name
  if (opts.ogSiteName && !GENERIC.has(opts.ogSiteName.toLowerCase())) {
    return opts.ogSiteName.trim();
  }

  // 3) Domain prettifier (royalcaribbean.com -> Royal Caribbean)
  const sld = opts.domain.replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0].split('.')[0];
  const prettyFromDomain = titleCaseTokens(sld);
  if (prettyFromDomain && !GENERIC.has(prettyFromDomain.toLowerCase())) {
    return prettyFromDomain;
  }

  // 4) Title before separator, guarded
  if (opts.title) {
    const beforeDash = opts.title.split(/[–—|-]/)[0].trim();
    const safe = beforeDash && !GENERIC.has(beforeDash.toLowerCase()) ? beforeDash : '';
    if (safe) return safe;
  }

  // 5) Last resort: first capitalized phrase from siteDescription
  const sd = opts.siteDescription || '';
  const m = sd.match(/\b([A-Z][A-Za-z0-9&\-\s]{2,})\b/);
  if (m && !GENERIC.has(m[1].toLowerCase())) return m[1].trim();

  return prettyFromDomain || opts.domain;
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'your', 'that', 'this', 'into', 'about', 'what', 'when', 'where', 'how',
  'best', 'top', 'pros', 'cons', 'most', 'guide', 'learn', 'more', 'home', 'official', 'site', 'website',
  'company', 'services', 'products', 'online', 'contact', 'help', 'faq',
  // Meta-labels that appear in context blob
  'title', 'description', 'summary', 'sample', 'body', 'domain'
]);

/**
 * Extract keyword stems and 2-word phrases from text
 * Returns both single words and compound terms (e.g., "cruise line", "cruise lines")
 */
export function keywordStems(text: string, max = 8): string[] {
  // Remove meta-labels like "Title:", "Description:", etc.
  const cleanedText = (text || '')
    .toLowerCase()
    .replace(/\b(title|description|summary|sample|body|domain)\s*:/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ');
  
  const tokens = cleanedText.split(/\s+/).filter(x => x.length > 3 && !STOP.has(x));
  
  // Extract single-word frequencies
  const freq: Record<string, number> = {};
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  
  // Extract 2-word phrases (bigrams) for compound terms
  const phrases: Record<string, number> = {};
  for (let i = 0; i < tokens.length - 1; i++) {
    const phrase = `${tokens[i]} ${tokens[i+1]}`;
    // Only keep phrases where both words are meaningful
    if (!STOP.has(tokens[i]) && !STOP.has(tokens[i+1])) {
      phrases[phrase] = (phrases[phrase] || 0) + 1;
    }
  }
  
  // Combine single words and phrases, prioritize by frequency
  const allTerms = [
    ...Object.entries(phrases).map(([k, v]) => ({ term: k, freq: v, isPhr: true })),
    ...Object.entries(freq).map(([k, v]) => ({ term: k, freq: v, isPhr: false }))
  ];
  
  // Sort by frequency, prefer phrases when tied
  allTerms.sort((a, b) => {
    if (b.freq !== a.freq) return b.freq - a.freq;
    return b.isPhr ? 1 : -1; // Prefer phrases
  });
  
  return allTerms.slice(0, max).map(x => x.term);
}

export const pluralize = (w: string) => w.endsWith('s') ? w : `${w}s`;

function humanPlural(w: string) {
  if (w.endsWith('s')) return w;
  if (w.endsWith('y')) return w.slice(0,-1) + 'ies';
  return w + 's';
}

function detectLangHint(text: string): string {
  // extremely light heuristic; replace with a proper lib later
  if (/[¿¡]/.test(text) || /\b(el|la|los|las|para|con|de)\b/i.test(text)) return 'es';
  if (/\b(le|la|les|des|pour|avec|de)\b/i.test(text)) return 'fr';
  return 'en';
}

export function classifySite(contextBlob: string) {
  const lc = contextBlob.toLowerCase();
  const site_type =
    // Financial services (check first, before media)
    /credit card|debit card|banking|financial services|investment|brokerage|trading|insurance|payments?|loan/.test(lc) ? 'financial' :
    /cart|checkout|price|buy|shop|sku|add to cart/.test(lc) ? 'ecommerce' :
    // Media only if primarily content (not just a news section)
    /\b(blog|news|press|article|post)\b.*\b(blog|news|press|article|post)\b/.test(lc) ? 'media' :
    /download|api|docs|pricing|saas|dashboard|platform/.test(lc) ? 'software' :
    /nonprofit|foundation|donate/.test(lc) ? 'nonprofit' :
    'corporate';

  const stems = keywordStems(contextBlob, 10);
  
  // Filter generic terms from entities
  const BLACKLIST = new Set(['home','homepage','official','welcome','product','products','service','services','blog','docs','support','contact','pricing']);
  const primary_entities = stems.filter(s => !BLACKLIST.has(s)).slice(0, 4);
  
  const user_intents = ['compare options', 'find pricing', 'evaluate safety', 'how it works'];

  return { site_type, primary_entities, user_intents };
}

/**
 * Helper: Create strict brand regex with word boundaries
 */
function brandRegex(brand: string): RegExp {
  const esc = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${esc}\\b`, 'i');
}

/**
 * Helper: Average of numbers
 */
function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

/**
 * Helper: Score queries and keep top N, optionally filtering by regex
 */
async function scoreAndKeep(
  env: Env,
  arr: string[],
  limit: number,
  forbid?: RegExp
): Promise<Array<{ q: string; score: number }>> {
  const out: Array<{ q: string; score: number }> = [];
  for (const q of arr) {
    if (forbid && forbid.test(q)) continue; // Hard filter
    const score = await realismScore(env, q);
    out.push({ q, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, Math.max(0, limit));
}

/**
 * Helper: Select industry-specific seeds
 */
function selectCompetitors(industry?: string | null): string[] {
  return COMPETITOR_SEEDS[industry || 'default'] || COMPETITOR_SEEDS.default;
}

function selectAudience(industry?: string | null): string[] {
  return AUDIENCE_SEEDS[industry || 'default'] || AUDIENCE_SEEDS.default;
}

function selectPurposes(industry?: string | null): string[] {
  return PURPOSE_SEEDS[industry || 'default'] || PURPOSE_SEEDS.default;
}

/**
 * V3 Archetypes - Generate human-like queries using separate branded/non-branded templates
 */
export async function generateContextualPromptsV3(
  env: Env,
  domain: string,
  brand: string,
  classification: ReturnType<typeof classifySite>,
  schemaTypes: string[] = [],
  industryHint?: string | null
) {
  const { primary_entities } = classification;
  const entities = primary_entities.length ? primary_entities.slice(0, 3) : ['service'];
  const intentsOrdered = (Object.keys(BRANDED_TEMPLATES) as IntentName[]);
  const bRx = brandRegex(brand);

  // Seed pools
  const competitors = selectCompetitors(industryHint);
  const audiences = selectAudience(industryHint);
  const purposes = selectPurposes(industryHint);
  const goals = ['lower fees', 'faster payouts', 'international payments', 'conversion uplift'];
  const actions = ['accept payments', 'send money', 'receive donations', 'process refunds'];
  const useCases = ['ecommerce', 'subscriptions', 'invoices', 'donations'];
  const userData = ['card details', 'bank info', 'account data'];
  const regions = ['the US', 'EU', 'UK', 'Canada', 'Australia'];
  const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

  // Fill branded templates (includes {brand})
  function fillBranded(tpl: string, e: string) {
    const singular = toSingular(e.toLowerCase());
    const data: Record<string, string> = {
      brand,
      audience: audiences[0],
      use_case: useCases[0],
      purpose: purposes[0] || 'online payments',
      user_data: userData[0],
      scenario: 'chargebacks',
      transaction_type: 'international transfers',
      competitor: competitors[0] ?? 'a competitor',
      goal: goals[0],
      action: actions[0],
      region: regions[0],
      currency: currencies[0]
    };
    return tpl.replace(/\{(\w+)\}/g, (_, k) => (data as any)[k] ?? `{${k}}`);
  }

  // Fill non-branded templates (NO {brand})
  function fillNonBranded(tpl: string, e: string) {
    const singular = toSingular(e.toLowerCase());
    const category = singular;
    const categoryPlural = humanPluralV3(singular);
    const data: Record<string, string> = {
      category,
      categoryPlural,
      audience: audiences[0],
      use_case: useCases[0],
      purpose: purposes[0] || 'online payments',
      user_data: userData[0],
      goal: goals[0],
      region: regions[0],
      currency: currencies[0]
    };
    return tpl.replace(/\{(\w+)\}/g, (_, k) => (data as any)[k] ?? `{${k}}`);
  }

  // Build branded candidates
  const brandedCandidates: string[] = [];
  for (const intent of intentsOrdered) {
    for (const e of entities) {
      for (const t of BRANDED_TEMPLATES[intent]) {
        brandedCandidates.push(sanitizeBrandInQuery(fillBranded(t, e), brand));
        if (brandedCandidates.length > 120) break;
      }
      if (brandedCandidates.length > 120) break;
    }
  }

  // Build non-branded candidates (with hard guard against brand leakage)
  const nonBrandedCandidates: string[] = [];
  for (const intent of intentsOrdered) {
    for (const e of entities) {
      for (const t of NONBRANDED_TEMPLATES[intent]) {
        const q = fillNonBranded(t, e);
        if (!bRx.test(q)) nonBrandedCandidates.push(q); // Hard guard
        if (nonBrandedCandidates.length > 160) break;
      }
      if (nonBrandedCandidates.length > 160) break;
    }
  }

  // Few-shot seeds (branded only) - optional
  if (PROMPTS_ENABLE_FEWSHOT_SEEDS && industryHint) {
    const seeds = (FEWSHOT_SEEDS[industryHint] || []).map(s => 
      s.replaceAll('{brand}', brand).replaceAll('{item}', 'luggage')
    );
    for (const s of seeds) {
      brandedCandidates.push(sanitizeBrandInQuery(s, brand));
    }
  }

  // Score + keep top (with belt-and-suspenders brand filter on non-branded)
  const scoredB = await scoreAndKeep(env, dedupeKeepOrder(brandedCandidates), PROMPTS_BRANDED_MAX);
  const scoredN = await scoreAndKeep(env, dedupeKeepOrder(nonBrandedCandidates), PROMPTS_NONBRANDED_MAX, bRx);

  // Calculate average realism across all kept queries
  const realismAvg = avg([
    ...scoredB.map(s => s.score),
    ...scoredN.map(s => s.score)
  ]);

  // Belt & suspenders: re-filter non-branded before returning
  const nonBranded = scoredN.map(s => s.q).filter(q => !bRx.test(q));

  return {
    branded: scoredB.map(s => s.q),
    nonBranded,
    realismScoreAvg: realismAvg || 0.85
  };
}

/**
 * V2 Contextual Prompts (legacy, kept for A/B fallback)
 */
export function generateContextualPrompts(domain: string, brand: string, classification: ReturnType<typeof classifySite>) {
  const { primary_entities, user_intents } = classification;
  const entities = primary_entities.length ? primary_entities : ['service'];

  const branded = [
    `What is ${brand}?`,
    `What services does ${brand} provide?`,
    `Is ${brand} safe and reliable?`,
    `How does ${brand} compare to competitors?`,
    `Where is ${brand} headquartered?`,
    `How do I contact ${brand}?`,
    `What does ${brand} do?`,
    `${brand} frequently asked questions`
  ];

  const nonBranded: string[] = [];
  
  // Primary entity (singular) - for general queries
  const primarySingular = entities[0]?.toLowerCase() || 'service';
  const primaryPlural = humanPlural(primarySingular);
  
  // Generate natural, realistic queries
  nonBranded.push(
    // Comparison queries
    `Best ${primaryPlural} to consider`,
    `Top ${primaryPlural} comparison`,
    `Which ${primarySingular} provider is best?`,
    
    // Informational queries
    `How do ${primaryPlural} work?`,
    `What are ${primaryPlural}?`,
    `${primarySingular} explained`,
    
    // Evaluative queries
    `Pros and cons of ${primaryPlural}`,
    `Are ${primaryPlural} worth it?`,
    `Most reliable ${primarySingular} options`,
    
    // Commercial queries
    `How much do ${primaryPlural} cost?`,
    `${primarySingular} pricing comparison`,
    `Affordable ${primaryPlural}`,
    
    // Specific use cases
    `Best ${primaryPlural} for families`,
    `${primarySingular} reviews and ratings`,
    `Top-rated ${primaryPlural}`,
    
    // Alternatives
    `Alternatives to ${brand}`,
    `${brand} competitors`,
    `${brand} vs other ${primaryPlural}`
  );

  const dedup = (arr: string[]) => Array.from(new Set(arr)).slice(0, 18);
  return { branded: dedup(branded), nonBranded: dedup(nonBranded) };
}

export function buildLLMEnvelope(domain: string, siteSummary: string) {
  return `You are evaluating web content visibility for the domain ${domain}.
The site describes itself as: "${siteSummary || 'N/A'}".
Answer the user query naturally and include citations to sources when applicable.

`;
}

/**
 * Staged rollout - ramp from current % to target % over N minutes
 */
function stagedV4Percent(): number {
  // If rollout disabled (0) or already at 100%, use target directly
  if (PROMPTS_V4_ROLLOUT_MINUTES === 0 || PROMPTS_V4_AB_PERCENT >= 1.0) {
    return PROMPTS_V4_AB_PERCENT;
  }
  
  // Track rollout start time in worker global
  const started = (globalThis as any).__v4Start ?? Date.now();
  (globalThis as any).__v4Start = started;
  
  const elapsedMin = (Date.now() - started) / 60000;
  const rampAmount = Math.min(0.5, (elapsedMin / PROMPTS_V4_ROLLOUT_MINUTES) * 0.5);
  const p = 0.5 + rampAmount;
  
  return Math.max(0.5, Math.min(1.0, p));
}

/**
 * Check if domain is a canary (always uses V4)
 */
function isCanaryDomain(domain: string): boolean {
  return PROMPTS_V4_CANARIES.some(c => domain.includes(c) || c.includes(domain));
}

/**
 * A/B helper - determine if domain should use V4 (with staged rollout and canaries)
 */
function useV4ForDomain(domain: string): boolean {
  if (!PROMPTS_USE_V4) return false;
  
  // Canaries always use V4
  if (isCanaryDomain(domain)) return true;
  
  // Use staged ramp if configured
  const target = PROMPTS_V4_AB_PERCENT >= 1.0 ? stagedV4Percent() : PROMPTS_V4_AB_PERCENT;
  
  const h = [...domain].reduce((a, c) => a + c.charCodeAt(0), 0) / (255 * domain.length || 1);
  return h < target;
}

/**
 * Backwards-compatible export for existing callers
 * Now supports v4-llm (LLM-native), v3-archetypes (template), and v2-contextual (legacy)
 * WITH cold-start support for non-audited domains
 */
/**
 * Log prompt generation metrics to KV for health monitoring
 */
async function logPromptHealth(
  env: Env,
  domain: string,
  result: any,
  coldStartMs?: number
) {
  try {
    const log = {
      domain,
      industry: result.meta?.industry || 'default',
      source: result.meta?.prompt_gen_version || 'unknown',
      nonBrandedCount: result.nonBranded?.length || 0,
      leakRate: result.qualityGate?.leakRate || 0,
      realismScore: result.realismScoreAvg || 0,
      coldStartMs,
      timestamp: new Date().toISOString()
    };
    
    // Store with TTL of 7 days (for health monitoring)
    const key = `prompt_log:${domain}:${Date.now()}`;
    await env.RULES.put(key, JSON.stringify(log), { expirationTtl: 604800 });
  } catch (error) {
    console.error('[PROMPT_HEALTH_LOG] Failed to log:', error);
  }
}

export async function buildLLMQueryPrompts(env: Env, domain: string) {
  const startTime = Date.now();
  const row = await getHomepageContext(env, domain);
  
  // If we have DB context, use the existing audited path
  if (row) {
    const result = await buildWithDbContext(env, domain, row);
    await logPromptHealth(env, domain, result);
    return result;
  }
  
  // COLD-START PATH: No audit data, fetch HTML and classify
  if (COLD_START_CLASSIFIER_ENABLED) {
    const result = await buildWithColdStart(env, domain);
    const coldStartMs = Date.now() - startTime;
    await logPromptHealth(env, domain, result, coldStartMs);
    return result;
  }
  
  // Fallback: return empty (old behavior)
  return { branded: [], nonBranded: [], envelope: '', meta: {}, realismScoreAvg: 0 };
}

/**
 * Build prompts using audited DB context (existing hot-patch path)
 */
async function buildWithDbContext(env: Env, domain: string, row: any) {
  const contextBlob = buildContextBlob(row);
  
  // Use v2 brand extraction with fallbacks
  const brand = extractBrandNameV2({
    domain,
    title: row.title,
    orgName: row.org_name,
    ogSiteName: row.og_site_name,
    siteDescription: row.site_description ?? row.meta_description ?? ''
  });
  
  const classification = classifySite(contextBlob);
  const schemaTypes: string[] = []; // Future: pass actual schema types from crawl
  const ents = normalizeEntities(classification.primary_entities || []);
  
  // Get industry from audit record (locked during audit creation)
  // Legacy industry detection removed - now using audit lock system
  let industry = row.industry || "default";
  console.log(`[PROMPTS] Using locked industry from audit: ${industry} (source: audit.industry_source)`);
  
  const categoryTerms = buildCategoryTerms(industry, ents, classification.site_type || 'corporate');
  
  let prompts: { branded: string[]; nonBranded: string[] };
  let realismAvg = 0.85;
  let version = 'v2-contextual';
  
  // A/B: Try V4 first (if enabled), fall back to V3 on error
  const tryV4 = useV4ForDomain(domain);
  
  if (tryV4) {
    try {
      console.log(`[PROMPTS] Trying V4 for ${domain}`);
      const v4 = await generateQueriesV4(env, {
        brand,
        domain,
        siteType: classification.site_type || 'corporate',
        industry,
        entities: classification.primary_entities || [],
        categoryTerms,
        schemaTypes
      });
      prompts = { branded: v4.branded, nonBranded: v4.nonBranded };
      realismAvg = v4.realismAvg;
      version = 'v4-llm';
      // Update industry if V4 detected a better one via hot patch
      if (v4.meta?.industry && v4.meta.industry !== 'default') {
        industry = v4.meta.industry;
        console.log(`[PROMPTS] V4 updated industry to: ${industry}`);
      }
      console.log(`[PROMPTS] V4 success for ${domain}: ${v4.branded.length} branded, ${v4.nonBranded.length} non-branded`);
      
      // Enhanced V3 fallback: If V4 returned too few queries, augment with V3
      if (v4.branded.length < 8 || v4.nonBranded.length < 12) {
        console.log(`[PROMPTS] V4 returned insufficient queries (${v4.branded.length}/${v4.nonBranded.length}), augmenting with V3`);
        const v3 = await generateContextualPromptsV3(env, domain, brand, classification, schemaTypes, industry);
        
        // Merge V4 + V3, dedupe
        const allBranded = [...v4.branded, ...v3.branded];
        const allNonBranded = [...v4.nonBranded, ...v3.nonBranded];
        
        prompts = {
          branded: Array.from(new Set(allBranded)).slice(0, PROMPTS_BRANDED_MAX),
          nonBranded: Array.from(new Set(allNonBranded)).slice(0, PROMPTS_NONBRANDED_MAX)
        };
        version = 'v4-llm-augmented';
        console.log(`[PROMPTS] Augmented to ${prompts.branded.length} branded, ${prompts.nonBranded.length} non-branded`);
      }
    } catch (error) {
      console.error(`[PROMPTS] V4 failed for ${domain}, falling back to V3:`, error);
      // Fall back to V3
      const v3 = await generateContextualPromptsV3(env, domain, brand, classification, schemaTypes, industry);
      prompts = { branded: v3.branded, nonBranded: v3.nonBranded };
      realismAvg = v3.realismScoreAvg ?? 0.85;
      version = 'v3-archetypes-fallback';
    }
  } else {
    // Use V3 (template-based)
    const v3 = await generateContextualPromptsV3(env, domain, brand, classification, schemaTypes, industry);
    prompts = { branded: v3.branded, nonBranded: v3.nonBranded };
    realismAvg = v3.realismScoreAvg ?? 0.85;
    version = 'v3-archetypes';
  }
  
  const envelope = buildLLMEnvelope(domain, row.site_description ?? row.meta_description ?? '');
  
  // Detect language
  const lang = detectLangHint(row.site_description ?? row.meta_description ?? '');

  // Apply intent filtering based on industry allow/deny lists
  const { filterIntentsByPack } = await import('./lib/intent-guards');
  const brandedIntents = prompts.branded.map(text => ({ text }));
  const nonBrandedIntents = prompts.nonBranded.map(text => ({ text }));
  
  const filteredBranded = filterIntentsByPack(brandedIntents, industry).map(i => i.text);
  const filteredNonBranded = filterIntentsByPack(nonBrandedIntents, industry).map(i => i.text);
  
  const originalCount = prompts.branded.length + prompts.nonBranded.length;
  const filteredCount = filteredBranded.length + filteredNonBranded.length;
  
  if (filteredCount < originalCount) {
    console.log(`[INTENT_FILTER] Filtered out ${originalCount - filteredCount} queries for industry ${industry} (${originalCount} → ${filteredCount})`);
  }

  return { 
    branded: filteredBranded,
    nonBranded: filteredNonBranded,
    envelope,
    realismScoreAvg: realismAvg,
    meta: { 
      brand,
      lang,
      industry,
      category_terms: categoryTerms,
      ...classification, 
      prompt_gen_version: version
    }
  };
}

/**
 * Build prompts using cold-start (no audit data)
 * Fetches HTML, classifies industry, generates prompts
 */
async function buildWithColdStart(env: Env, domain: string) {
  const HOST_CACHE_TTL = 14 * 24 * 3600;
  
  // 1) Try KV cache first
  const kvKey = `industry:v2:host:${domain}`;
  let industry: string | null = await env.RULES.get(kvKey);
  
  if (industry) {
    console.log(`[INDUSTRY_COLDSTART] cached for ${domain}: ${industry}`);
  } else {
    // 2) Use NEW AI classifier (same as audit creation)
    try {
      const { resolveIndustry } = await import('./lib/industry');
      
      // Call the same industry resolution used in audits
      const industryLock = await resolveIndustry({
        signals: {
          domain,
          homepageTitle: undefined,
          homepageH1: undefined,
          schemaTypes: undefined,
          keywords: undefined,
          navTerms: undefined,
        },
        env,
        root_url: `https://${domain}`,
        site_description: undefined,
      });
      
      industry = industryLock.value;
      const source = industryLock.source;
      const confidence = industryLock.confidence || 1.0;
      
      // Cache high-confidence results for 14 days
      if (confidence >= 0.60) {
        await env.RULES.put(kvKey, industry, { expirationTtl: HOST_CACHE_TTL });
        console.log(`[INDUSTRY_COLDSTART] Detected and cached ${domain}: ${industry} (source: ${source}, confidence: ${confidence.toFixed(2)})`);
      } else {
        console.log(`[INDUSTRY_COLDSTART] Detected ${domain}: ${industry} (source: ${source}, confidence: ${confidence.toFixed(2)}) - NOT cached (low confidence)`);
      }
    } catch (error) {
      console.error(`[INDUSTRY_COLDSTART] Failed for ${domain}:`, error);
      industry = "generic_consumer"; // Better default than "default"
    }
  }
  
  // 4) Extract brand from domain
  const brand = domain.split('.')[0].replace(/^www\./, '');
  const brandCapitalized = brand.charAt(0).toUpperCase() + brand.slice(1);
  
  // 5) Generate queries with MSS (bypass V4 for cold-start - more reliable)
  console.log(`[COLD_START_MSS] Starting for ${domain} with industry: ${industry}`);
  
  try {
    const { buildMinimalSafeSetV2 } = await import('./prompts/v2/minimalSafe');
    
    // Build aliases manually (brandAliases is not exported from generator_v4)
    const aliases = [brandCapitalized];
    console.log(`[COLD_START_MSS] Brand: ${brandCapitalized}, Aliases: ${JSON.stringify(aliases)}`);
    
    const mssContext = {
      brand: brandCapitalized,
      domain,
      aliases,
      industry: industry || 'default',
      categoryTerms: [brand],
      siteType: 'corporate'
    };
    
    console.log(`[COLD_START_MSS] Calling buildMinimalSafeSetV2 with context:`, JSON.stringify(mssContext));
    
    const mss = await buildMinimalSafeSetV2(env, env.RULES, mssContext);
    
    if (!mss) {
      throw new Error('buildMinimalSafeSetV2 returned null/undefined');
    }
    
    console.log(`[COLD_START_MSS] ✅ SUCCESS: ${mss.branded?.length || 0} branded, ${mss.nonBranded?.length || 0} non-branded`);
    
    // Apply intent filtering based on industry allow/deny lists
    const { filterIntentsByPack } = await import('./lib/intent-guards');
    const actualIndustry = mss.industry || industry || 'default';
    const brandedIntents = (mss.branded || []).map(text => ({ text }));
    const nonBrandedIntents = (mss.nonBranded || []).map(text => ({ text }));
    
    const filteredBranded = filterIntentsByPack(brandedIntents, actualIndustry).map(i => i.text);
    const filteredNonBranded = filterIntentsByPack(nonBrandedIntents, actualIndustry).map(i => i.text);
    
    const originalCount = (mss.branded?.length || 0) + (mss.nonBranded?.length || 0);
    const filteredCount = filteredBranded.length + filteredNonBranded.length;
    
    if (filteredCount < originalCount) {
      console.log(`[INTENT_FILTER] Cold-start filtered out ${originalCount - filteredCount} queries for industry ${actualIndustry} (${originalCount} → ${filteredCount})`);
    }
    
    return {
      branded: filteredBranded,
      nonBranded: filteredNonBranded,
      envelope: `You are analyzing ${domain}, a ${industry} website.`,
      realismScoreAvg: mss.realism_score || 0.78,
      meta: {
        brand: brandCapitalized,
        lang: 'en',
        industry: actualIndustry,
        category_terms: [brand],
        site_type: 'corporate',
        primary_entities: [brand],
        prompt_gen_version: 'mss-v2-cold-start',
        template_version: mss.template_version || 'v1.0',
        realism_target: mss.realism_score || (industry === 'default' ? 0.62 : 0.74)
      }
    };
  } catch (error: any) {
    console.error(`[COLD_START_MSS_FAIL] Domain: ${domain}, Industry: ${industry}`);
    console.error(`[COLD_START_MSS_FAIL] Error type: ${error?.constructor?.name}`);
    console.error(`[COLD_START_MSS_FAIL] Error message: ${error?.message}`);
    console.error(`[COLD_START_MSS_FAIL] Error stack:`, error?.stack);
    
    // Re-throw to make it visible in Cloudflare logs
    throw new Error(`Cold-start MSS failed for ${domain}: ${error?.message || error}`);
  }
}

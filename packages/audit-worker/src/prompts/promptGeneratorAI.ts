// Works in a Cloudflare Worker with the AI binding (env.AI).
// Shadow-safe: returns [] on any failure and lets caller fall back.

import { resolveQuotas } from './intentTaxonomy';
import { buildBrandAliases } from './brandAliases';
import { inferPersona, getPersonaHint } from './personaInference';

export type PromptGenInput = {
  domain: string;
  brand: string | null;
  site_type: string | null;     // from classification_v2.site_type.value
  industry: string | null;      // classification_v2.industry.value
  purpose: "sell" | "inform" | "convert" | "assist" | "investor";
  category_terms: string[];     // top 3–5
  nav_terms: string[];          // top 6
  lang?: string | null;         // ISO, e.g. "en"
  region?: string | null;       // ISO, e.g. "US"
  brand_kind?: string | null;   // "network", "bank", etc for fine-tuned quotas
  persona_override?: "consumer" | "merchant" | "developer" | "investor" | null; // Force persona for testing
  site_confidence?: number | null; // classification_v2.site_type.confidence
};

export type PromptGenResult = {
  branded: string[];
  nonBranded: string[];
  raw: string[];                // union for debugging
  model: string;
  cached: boolean;
};

const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const KV_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const KV_KEY = (d: string) => `optiview:ai_prompts:v1:${d}`;

const SYSTEM = `You generate realistic, human search questions that people ask
AI assistants (ChatGPT, Claude, Perplexity) about a brand and its category.

Requirements:
- Return EXACTLY 20 questions, one per line, no numbering.
- Natural English (6–12 words typical), concise, no fluff.
- Mix branded (use brand name or common nicknames) and non-branded.
- Avoid repeating sentence stems (e.g., not "Are X safe for Y?" many times).
- Use varied forms: "How do I...", "Is it worth...", "Which...", "What's the best...", "Why...", "When...".
- Neutral, non-advisory tone for finance/insurance (no promises).

Intent coverage (meet the quotas passed in the user prompt):
- trust & security
- cost & fees
- rewards & benefits
- comparison with competitors
- acceptance & usability
- support & troubleshooting
- eligibility & requirements
- features & experience
`;

function buildUserPrompt(input: PromptGenInput): string {
  const brand = input.brand ?? input.domain.replace(/^www\./, "");
  const aliases = buildBrandAliases(input.domain, input.brand);
  const ct = input.category_terms.slice(0, 5).join(", ") || "n/a";
  const nav = input.nav_terms.slice(0, 8).join(", ") || "n/a";
  const st = input.site_type ?? "unknown";
  const ind = input.industry ?? "unknown";
  const lang = (input.lang ?? "en").toLowerCase();
  const region = (input.region ?? "US").toUpperCase();
  
  // Confidence-aware quotas: if site_type confidence is low, shift to generic
  const siteConfidence = input.site_confidence ?? 1.0;
  let quotas = resolveQuotas(ind, input.brand_kind);
  
  if (siteConfidence < 0.6) {
    // Shift 20% of quotas from branded/specific to generic
    const totalQuotas = Object.values(quotas).reduce((a, b) => (a || 0) + (b || 0), 0) || 20;
    const shift = Math.floor(totalQuotas * 0.2);
    // Reduce trust/rewards slightly, boost features/compare (more generic)
    if (quotas.trust && quotas.trust > 2) quotas.trust = Math.max(2, (quotas.trust || 0) - 1);
    if (quotas.rewards && quotas.rewards > 2) quotas.rewards = Math.max(1, (quotas.rewards || 0) - 1);
    if (quotas.features) quotas.features = (quotas.features || 0) + 1;
    if (quotas.compare) quotas.compare = (quotas.compare || 0) + 1;
  }
  
  // Infer persona (with override support)
  const persona = inferPersona(st, null, input.purpose, input.persona_override);
  const personaHint = getPersonaHint(persona);

  // Render quotas as instruction lines (universal)
  const quotaLines = Object.entries(quotas)
    .map(([k, n]) => `- ${k}: ${n}`)
    .join("\n");

  return [
    `Brand: ${brand}`,
    `Aliases: ${aliases.join(", ")}`,
    `Domain: ${input.domain}`,
    `Type: ${st} (${ind})`,
    `Purpose: ${input.purpose}`,
    `Categories: ${ct}`,
    `Key features/terms: ${nav}`,
    `Locale: ${lang}-${region}`,
    ``,
    personaHint,
    ``,
    `Generate realistic questions with the following intent quotas (sum=20):`,
    quotaLines,
    ``,
    `Output rules:`,
    `- 20 lines exactly; one question per line`,
    `- ~50% branded (use "${brand}" or aliases), ~50% non-branded`,
    `- Vary verbs and structure`,
  ].join("\n");
}

function splitBranded(domainOrBrand: string, lines: string[]): { branded: string[]; nonBranded: string[] } {
  const b = domainOrBrand.toLowerCase();
  const brandish = b.replace(/\.(com|net|org|io|ai|co|uk|jp|fr|de)$/i, "");
  const branded: string[] = [];
  const nonBranded: string[] = [];
  for (const q of lines) {
    const s = q.trim().replace(/^[-•\d.]+\s*/, "");
    if (!s) continue;
    const lower = s.toLowerCase();
    if (lower.includes(brandish) || lower.includes(b)) branded.push(s);
    else nonBranded.push(s);
  }
  return { branded, nonBranded };
}

function normalize(q: string) {
  return q.toLowerCase().replace(/\s+/g, " ").replace(/[?.,!]+$/g, "").trim();
}

function dedupe(list: string[], seen = new Set<string>(), max = 50): string[] {
  const out: string[] = [];
  for (const q of list) {
    const key = normalize(q);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(q);
    if (out.length >= max) break;
  }
  return out;
}

export async function generateAiPrompts(
  env: any, 
  breaker: { allow(): boolean }, 
  input: PromptGenInput,
  ttlOverride?: number | null
): Promise<PromptGenResult> {
  const domain = input.domain.toLowerCase();
  const kvKey = KV_KEY(domain);

  // KV cache first (skip if persona_override is set - for testing)
  if (!input.persona_override) {
    try {
      const cached = await env.PROMPT_CACHE?.get(kvKey, "json") as PromptGenResult | null;
      if (cached && Array.isArray(cached.raw)) {
        return { ...cached, cached: true };
      }
    } catch (_) {} // ignore
  }

  // Circuit breaker
  if (!breaker.allow()) {
    console.log(`[AI_PROMPTS] Circuit breaker open for ${domain}`);
    return { branded: [], nonBranded: [], raw: [], model: MODEL, cached: false };
  }

  // Call Workers AI
  const system = SYSTEM;
  const user = buildUserPrompt(input);

  try {
    // @ts-ignore - Workers AI binding
    const aiRes = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.6,
      max_tokens: 600
    });

    const text: string = typeof aiRes === "object"
      ? (aiRes?.response || aiRes?.result || "")
      : String(aiRes || "");

    // Split lines + quality filter
    let lines = text
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .filter(s => s.length >= 8 && s.length <= 180) // basic sanity
      .slice(0, 40);

    // Post-filter quality controls (diversity + stem guard)
    const STEM = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).slice(0, 2).join(" ");

    function diversityScore(qs: string[]): number {
      const verbs = ["how","what","which","is","does","can","why","when","where","should","vs"];
      const firstWords = new Set(qs.map(q => q.toLowerCase().split(/\s+/)[0]));
      const verbHits = new Set(qs.flatMap(q => q.toLowerCase().split(/\s+/).filter(w => verbs.includes(w))));
      return 0.5 * Math.min(1, firstWords.size / 6) + 0.5 * Math.min(1, verbHits.size / 7);
    }

    // Blocklist of low-quality patterns
    const BAD = [
      /are .* safe .* online payments/i,
      /\?\?$/i,
      /\.{2,}$/i
    ];

    // Clean + filter
    let filtered = lines
      .map(s => s.replace(/^[-•\d.]+\s*/, "").trim())
      .filter(Boolean)
      .filter(s => s.length >= 6 && s.length <= 120)
      .filter(s => !BAD.some(rx => rx.test(s)));

    const stems = new Set<string>();
    filtered = filtered.filter(q => {
      const st = STEM(q);
      if (stems.has(st)) return false; // drop repeated stems
      stems.add(st);
      return true;
    });

    // Ensure diversity; if weak, cap stems to 1 occurrence
    const divScore = diversityScore(filtered);
    if (divScore < 0.55) {
      const counts: Record<string, number> = {};
      const seen = new Set<string>();
      filtered = filtered.filter(q => {
        const st = STEM(q);
        if (seen.has(st)) return false; // Already used once, drop
        seen.add(st);
        return true;
      });
    }

    const { branded, nonBranded } = splitBranded(input.brand ?? domain, filtered);

    // Deduplicate & balance
    const seen = new Set<string>();
    const brandedClean = dedupe(branded, seen, 20);
    const nonBrandedClean = dedupe(nonBranded, seen, 20);

    const result: PromptGenResult = {
      branded: brandedClean,
      nonBranded: nonBrandedClean,
      raw: dedupe([...brandedClean, ...nonBrandedClean], new Set(), 40),
      model: MODEL,
      cached: false
    };

    // Cache (with TTL override support for testing)
    const ttl = ttlOverride ?? KV_TTL_SECONDS;
    try {
      await env.PROMPT_CACHE?.put(kvKey, JSON.stringify(result), { expirationTtl: ttl });
      console.log(`[AI_PROMPTS] Cached ${result.raw.length} prompts for ${domain} (TTL: ${ttl}s)`);
    } catch (_) {}

    return result;
  } catch (error) {
    // Failure → shadow-safe fallback
    console.error(`[AI_PROMPTS] Error generating for ${domain}:`, error);
    return { branded: [], nonBranded: [], raw: [], model: MODEL, cached: false };
  }
}


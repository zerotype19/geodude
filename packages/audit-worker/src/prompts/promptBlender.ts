export type RulePrompts = { branded: string[]; nonBranded: string[] };
export type BlendedPrompts = {
  source: "rules" | "ai" | "blended";
  branded: string[];
  nonBranded: string[];
  realism_score: number; // 0..1 simple heuristic
};

/**
 * Assistant-specific style profiles
 */
export interface AssistantStyle {
  longProb: number; // Probability of longer phrasing (0-1)
  stems: string[]; // Preferred question starters
  description: string;
}

export type AssistantType = "chatgpt" | "claude" | "perplexity" | "gemini" | "searchgpt" | "brave";

/**
 * Get style profile for a specific AI assistant
 */
export function buildAssistantStyle(assistant: AssistantType): AssistantStyle {
  switch (assistant) {
    case "claude":
      return {
        longProb: 0.7,
        stems: ["help me", "what are the trade-offs", "walk me through", "explain", "what's the difference"],
        description: "Prefers thoughtful, longer phrasing with nuanced questions"
      };
    
    case "perplexity":
      return {
        longProb: 0.3,
        stems: ["vs", "alternatives to", "best", "compare", "which is better"],
        description: "Prefers terse, comparison-heavy queries"
      };
    
    case "gemini":
      return {
        longProb: 0.5,
        stems: ["step-by-step", "quick guide", "how to", "checklist", "tutorial"],
        description: "Prefers instructive, procedural phrasing"
      };
    
    case "searchgpt":
      return {
        longProb: 0.4,
        stems: ["what is", "how does", "why", "when should", "where can"],
        description: "Prefers informational, search-style queries"
      };
    
    case "brave":
      return {
        longProb: 0.35,
        stems: ["best", "top", "alternatives", "reviews", "comparison"],
        description: "Prefers concise, research-focused queries"
      };
    
    case "chatgpt":
    default:
      return {
        longProb: 0.5,
        stems: ["how do I", "should I", "is it worth", "what's the best way", "can I"],
        description: "Balanced phrasing between concise and detailed"
      };
  }
}

/**
 * Coverage Quotas by Industry
 * Defines the distribution of query intent types for each industry
 */
export interface CoverageQuotas {
  features?: number;
  pricing?: number;
  trust?: number;
  comparison?: number;
  integrations?: number;
  support?: number;
  implementation?: number;
  eligibility?: number;
  quality?: number;
  shipping?: number;
  returns?: number;
  loyalty?: number;
  flexibility?: number;
  [key: string]: number | undefined;
}

/**
 * Build coverage quotas for a specific industry
 */
export function buildQuotasForIndustry(industry: string): CoverageQuotas {
  switch (industry) {
    case "saas_b2b":
      return {
        features: 0.20,
        pricing: 0.20,
        comparison: 0.15,
        trust: 0.15,
        integrations: 0.15,
        support: 0.10,
        implementation: 0.05
      };
    
    case "healthcare_provider":
      return {
        trust: 0.25,
        eligibility: 0.20,
        quality: 0.20,
        comparison: 0.15,
        services: 0.10,
        access: 0.10
      };
    
    case "financial_services":
      return {
        trust: 0.25,
        fees: 0.20,
        comparison: 0.15,
        features: 0.15,
        eligibility: 0.15,
        rates: 0.10
      };
    
    case "travel_air":
    case "travel_hotels":
    case "travel_cruise":
      return {
        pricing: 0.20,
        loyalty: 0.20,
        comparison: 0.15,
        amenities: 0.15,
        flexibility: 0.15,
        experience: 0.15
      };
    
    case "retail":
      return {
        pricing: 0.20,
        quality: 0.20,
        comparison: 0.15,
        shipping: 0.15,
        returns: 0.15,
        membership: 0.15
      };
    
    case "education":
      return {
        value: 0.20,
        pricing: 0.20,
        quality: 0.20,
        comparison: 0.15,
        content: 0.15,
        support: 0.10
      };
    
    default:
      // Generic consumer
      return {
        pricing: 0.25,
        quality: 0.25,
        comparison: 0.20,
        features: 0.15,
        support: 0.15
      };
  }
}

function norm(s: string) { return s.toLowerCase().replace(/\s+/g," ").trim(); }

export function aliasNormalize(q: string, aliases: string[]): string {
  let out = q.toLowerCase();
  const primary = (aliases[0] || "").toLowerCase();
  for (const a of aliases) {
    const rx = new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
    out = out.replace(rx, primary || "brand");
  }
  return out;
}

function jaccard(a: string, b: string, aliases: string[] = []) {
  const A = new Set(aliasNormalize(a, aliases).split(" ")); 
  const B = new Set(aliasNormalize(b, aliases).split(" "));
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
}

function dedupeFuzzy(list: string[], max = 30, thresh = 0.8, aliases: string[] = []): string[] {
  const out: string[] = [];
  for (const q of list) {
    if (!q) continue;
    const isDup = out.some(x => jaccard(x, q, aliases) >= thresh);
    if (!isDup) out.push(q);
    if (out.length >= max) break;
  }
  return out;
}

export function blendPrompts(
  ai: RulePrompts, 
  rules: RulePrompts, 
  realismHint = 0.75, 
  aliases: string[] = []
): BlendedPrompts {
  // Adaptive caps based on realism score
  const aiBrandedCap = realismHint > 0.78 ? 10 : 8;
  const aiGenericCap = realismHint > 0.78 ? 14 : 12;

  const branded = dedupeFuzzy([
    ...ai.branded.slice(0, aiBrandedCap),
    ...rules.branded.slice(0, 6)
  ], 12, 0.8, aliases);

  const nonBranded = dedupeFuzzy([
    ...ai.nonBranded.slice(0, aiGenericCap),
    ...rules.nonBranded.slice(0, 8)
  ], 16, 0.8, aliases);

  // Realism scoring: favor AI presence + verb variety
  const verbs = ["how","what","which","is","does","can","why","when","where","should","vs"];
  const pool = [...branded, ...nonBranded].map(s => s.toLowerCase());
  const variety = new Set(pool.flatMap(q => q.split(" ").filter(w => verbs.includes(w)))).size / verbs.length;
  const realism_score = Math.min(1, 0.6 + variety * 0.4);

  return {
    source: (ai.branded.length + ai.nonBranded.length) ? "blended" : "rules",
    branded, 
    nonBranded,
    realism_score
  };
}


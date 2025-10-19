/**
 * Hybrid Industry Inference V2
 * Uses rules + JSON-LD + Workers AI embeddings for robust classification
 */

import { INDUSTRY_ALIASES, IndustryKey } from "../taxonomy/industryTaxonomy";
import { embed, cosineSim } from "./embeddings";

/**
 * Canonical industry vectors for embedding-based classification
 * These strings define the semantic space for each industry
 */
const CANONICAL: Record<IndustryKey, string> = {
  "health.diagnostics": "at-home diagnostics colon cancer screening stool dna test laboratory medical testing kit results",
  "health.providers": "clinic hospital provider patient appointment care primary care doctor physician specialist",
  "pharma.biotech": "pharmaceutical biotech drug research trials medicine development clinical",
  "finance.bank": "bank checking savings credit card loans branch account routing number deposit",
  "finance.network": "payment network acceptance interchange card scheme visa mastercard merchant processing",
  "finance.fintech": "payments platform wallet checkout online payment processing api gateway transactions",
  "insurance": "policy coverage premium claims underwriting deductible liability auto home health",
  "software.saas": "saas subscription product pricing onboarding dashboard cloud platform user account",
  "software.devtools": "api sdk developer docs webhooks rate limits integration documentation github npm",
  "retail": "online store product catalog cart checkout returns shipping inventory orders ecommerce",
  "marketplace": "listings buyers sellers marketplace fees commission vendor platform auction bidding",
  "automotive": "cars vehicles dealership model trim financing lease test drive warranty service",
  "travel.hospitality": "hotel booking flights itinerary check-in reservation travel vacation amenities",
  "media.news": "news articles journalism publisher editorial breaking story reporter investigation",
  "education": "courses university school learning tuition degree program enrollment student teacher",
  "government": "public services permits regulations agency license forms tax citizen benefits",
  "telecom": "mobile plans broadband 5g fiber carrier network coverage data voice internet",
  "energy.utilities": "electricity gas water utility billing meter consumption residential commercial",
  "default": "company business service product information contact about terms privacy policy"
};

export type IndustryInferenceInput = {
  domain: string;
  htmlText?: string;
  jsonld?: any[];
  nav?: string[];
  fallback?: string;
};

export type IndustryInferenceResult = {
  industry: IndustryKey;
  source: "rules" | "jsonld" | "embedding" | "fallback";
  confidence?: number;
};

/**
 * Infer industry from domain, HTML, JSON-LD, and nav signals
 * Uses a hybrid approach with multiple fallback layers
 */
export async function inferIndustryV2(
  env: any,
  kv: any,
  input: IndustryInferenceInput
): Promise<IndustryInferenceResult> {
  
  // Layer 1: Quick alias/rule pass
  const raw = `${input.domain} ${input.nav?.join(" ") ?? ""}`.toLowerCase();
  for (const [alias, industry] of Object.entries(INDUSTRY_ALIASES)) {
    if (raw.includes(alias)) {
      console.log(`[INDUSTRY_V2] Rules match: ${alias} → ${industry}`);
      return { industry, source: "rules" };
    }
  }

  // Layer 2: JSON-LD hints
  if (input.jsonld && input.jsonld.length > 0) {
    const types = input.jsonld.map(obj => {
      const type = obj["@type"] || "";
      return Array.isArray(type) ? type.join(" ") : type;
    }).join(" ").toLowerCase();

    if (/medical|hospital|clinic|diagnostic|health|physician|doctor/.test(types)) {
      console.log(`[INDUSTRY_V2] JSON-LD match: health.providers`);
      return { industry: "health.providers", source: "jsonld" };
    }
    if (/bank|financialproduct|loanorCredit/.test(types)) {
      console.log(`[INDUSTRY_V2] JSON-LD match: finance.bank`);
      return { industry: "finance.bank", source: "jsonld" };
    }
    if (/store|product|ecommerce/.test(types)) {
      console.log(`[INDUSTRY_V2] JSON-LD match: retail`);
      return { industry: "retail", source: "jsonld" };
    }
    if (/softwareapplication|api/.test(types)) {
      console.log(`[INDUSTRY_V2] JSON-LD match: software.saas`);
      return { industry: "software.saas", source: "jsonld" };
    }
  }

  // Layer 3: Workers AI embeddings
  try {
    const text = [
      input.domain,
      (input.nav || []).slice(0, 12).join(" "),
      (input.htmlText || "").slice(0, 2000)
    ].join(" ");

    const vec = await embed(env, text);
    let best: { key: IndustryKey; score: number } | null = null;

    // Try cached seed embeddings first
    for (const [key, seed] of Object.entries(CANONICAL) as [IndustryKey, string][]) {
      const cacheKey = `industry:v2:seed:${key}`;
      let seedVec: Float32Array;

      const cached = await kv.get(cacheKey, "arrayBuffer");
      if (cached) {
        seedVec = new Float32Array(cached);
      } else {
        seedVec = await embed(env, seed);
        // Cache seed embedding (14 days)
        await kv.put(cacheKey, seedVec.buffer, { expirationTtl: 14 * 24 * 3600 });
      }

      const sim = cosineSim(vec, seedVec);
      if (!best || sim > best.score) {
        best = { key, score: sim };
      }
    }

    if (best && best.score >= 0.34) {
      console.log(`[INDUSTRY_V2] Embedding match: ${best.key} (confidence: ${best.score.toFixed(3)})`);
      return { 
        industry: best.key, 
        source: "embedding",
        confidence: best.score 
      };
    }
  } catch (error) {
    console.warn(`[INDUSTRY_V2] Embedding classification failed:`, error);
    // Continue to fallback
  }

  // Layer 4: Fallback to default or provided
  const fallbackIndustry = (input.fallback as IndustryKey) || "default";
  console.log(`[INDUSTRY_V2] Using fallback: ${fallbackIndustry}`);
  return { 
    industry: fallbackIndustry, 
    source: "fallback" 
  };
}


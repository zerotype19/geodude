/**
 * Minimal Safe Set V2 Builder
 * Industry-aware, zero-leak prompt templates with KV caching
 */

import { extractJsonLd, extractNavTerms, fetchColdStartHtml } from "./lib/coldStartSignals";
import { inferIndustryV2 } from "./lib/inferIndustryV2";
import { loadSafeTemplate } from "./mssTemplates";
import { initEmbeddingModel } from "./lib/embeddings";
import type { IndustryKey } from "./taxonomy/industryTaxonomy";
import { resolveTemplates } from "../templateResolver";

export type MSSContext = {
  brand: string;
  domain: string;
  aliases: string[];
  industry?: string;
  coldStartHtml?: string;
  coldStartJsonLd?: any[];
  coldStartNav?: string[];
  categoryTerms?: string[];
  siteType?: string;
};

/**
 * Get appropriate category name for the industry
 */
function getCategory(industry: string, domain: string): string {
  const lower = industry.toLowerCase();
  
  // Food & Beverage
  if (lower.includes('food') || lower.includes('restaurant') || lower.includes('qsr')) {
    if (domain.includes('energy') || domain.includes('redbull') || domain.includes('monster')) {
      return 'energy drink';
    }
    if (domain.includes('coffee') || domain.includes('starbucks')) {
      return 'coffee';
    }
    return 'food';
  }
  
  // Software
  if (lower.includes('software') || lower.includes('saas')) {
    return 'software';
  }
  
  // Healthcare
  if (lower.includes('health') || lower.includes('pharma') || lower.includes('medical')) {
    return 'healthcare';
  }
  
  // Finance
  if (lower.includes('finance') || lower.includes('bank') || lower.includes('insurance')) {
    return 'financial service';
  }
  
  // Education
  if (lower.includes('education') || lower.includes('university')) {
    return 'education program';
  }
  
  // Travel
  if (lower.includes('travel') || lower.includes('hotel') || lower.includes('cruise')) {
    return 'travel service';
  }
  
  // Automotive
  if (lower.includes('automotive') || lower.includes('vehicle')) {
    return 'vehicle';
  }
  
  // Retail
  if (lower.includes('retail') || lower.includes('grocery')) {
    return 'retail store';
  }
  
  // Generic fallback
  return 'product';
}

/**
 * Get a generic competitor name for the industry
 */
function getCompetitor(industry: string): string {
  const lower = industry.toLowerCase();
  
  // Food & Beverage
  if (lower.includes('food') || lower.includes('restaurant') || lower.includes('qsr')) {
    return 'Monster';
  }
  
  // Software
  if (lower.includes('software') || lower.includes('saas')) {
    return 'Competitor';
  }
  
  // Healthcare
  if (lower.includes('health') || lower.includes('pharma')) {
    return 'Alternative';
  }
  
  // Generic fallback
  return 'Alternative';
}

/**
 * Get current date in YYYY-MM-DD format
 */
function getToday(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get generic city/state (can be enriched with actual geo data later)
 */
function getCity(): string {
  const cities = ['Boston', 'Chicago', 'Dallas', 'Denver', 'Los Angeles', 'Miami', 'New York', 'Phoenix', 'Seattle', 'Atlanta'];
  return cities[Math.floor(Math.random() * cities.length)];
}

function getState(): string {
  const states = ['California', 'Texas', 'Florida', 'New York', 'Illinois', 'Pennsylvania', 'Ohio', 'Georgia', 'North Carolina', 'Michigan'];
  return states[Math.floor(Math.random() * states.length)];
}

function getDepartment(industry: string): string {
  const lower = industry.toLowerCase();
  if (lower.includes('health') || lower.includes('hospital')) {
    return 'cardiology';
  }
  return 'department';
}

function getPlan(): string {
  return 'your plan';
}

function getDocType(industry: string): string {
  const lower = industry.toLowerCase();
  if (lower.includes('pharma')) {
    return 'Prescribing Information';
  }
  if (lower.includes('automotive')) {
    return 'owner\'s manual';
  }
  if (lower.includes('software')) {
    return 'SOC 2 report';
  }
  return 'documentation';
}

function getProduct(brand: string, industry: string): string {
  const lower = industry.toLowerCase();
  // For pharma, we don't have specific product names, so use "medications" or similar
  if (lower.includes('pharma')) {
    return 'medications';
  }
  // For automotive, use "vehicles"
  if (lower.includes('automotive')) {
    return 'vehicles';
  }
  // For other industries, use the brand name (existing behavior)
  return brand;
}

export type MSSResult = {
  branded: string[];
  nonBranded: string[];
  industry: IndustryKey;
  template_version: string;
  realism_score: number;
  source: "rules" | "jsonld" | "embedding" | "fallback";
  meta?: {
    industry: IndustryKey;
    template_version: string;
    realism_target: number;
    confidence?: number;
    confidence_adjusted: boolean;
  };
  metadata?: {
    confidence?: number;
  };
};

/**
 * Build Minimal Safe Set V2 with industry-aware templates
 * Falls back to default template if industry detection fails
 */
export async function buildMinimalSafeSetV2(
  env: any,
  kv: any,
  ctx: MSSContext
): Promise<MSSResult> {
  
  // Initialize embedding model if not already done
  try {
    await initEmbeddingModel(env, kv);
  } catch (error) {
    console.warn(`[MSS_V2] Failed to init embedding model:`, error);
  }

  // If industry is already provided in context (from audit lock), use it!
  let industry: IndustryKey;
  let source: "rules" | "jsonld" | "embedding" | "fallback" | "context" = "fallback";
  let confidence: number | undefined;

  if (ctx.industry && ctx.industry !== "default") {
    // Industry already determined (from audit lock or domain rules)
    industry = ctx.industry as IndustryKey;
    source = "context";
    confidence = 1.0;
    console.log(`[MSS_V2] Using provided industry for ${ctx.domain}: ${industry}`);
  } else {
    // No industry provided, try to detect it
    const cacheKey = `industry:v2:host:${ctx.domain}`;
    const cached = await kv.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        industry = parsed.industry;
        source = parsed.source;
        confidence = parsed.confidence;
        console.log(`[MSS_V2] Using cached industry for ${ctx.domain}: ${industry}`);
      } catch {
        industry = cached as IndustryKey;
      }
    } else {
      // Fetch cold-start signals if not provided
      let html = ctx.coldStartHtml || "";
      let jsonld = ctx.coldStartJsonLd || [];
      let nav = ctx.coldStartNav || [];

      if (!html) {
        console.log(`[MSS_V2] Fetching cold-start HTML for ${ctx.domain}`);
        html = await fetchColdStartHtml(ctx.domain);
        jsonld = extractJsonLd(html);
        nav = extractNavTerms(html);
      }

      // Infer industry using hybrid approach
      const result = await inferIndustryV2(env, kv, {
        domain: ctx.domain,
        htmlText: html,
        jsonld,
        nav,
        fallback: "default"
      });

      industry = result.industry;
      source = result.source;
      confidence = result.confidence;

      // Cache classification (14 days)
      await kv.put(cacheKey, JSON.stringify({ industry, source, confidence }), {
        expirationTtl: 14 * 24 * 3600
      });

      console.log(`[MSS_V2] Classified ${ctx.domain} as ${industry} (source: ${source})`);
    }
  }

  // Load templates using NEW V2 templateResolver (cascading hierarchy)
  // This resolves media.news → media.news → media → generic_consumer
  const brandedTemplates = resolveTemplates(industry, 'branded');
  const nonBrandedTemplates = resolveTemplates(industry, 'nonBranded');

  // Calculate realism score based on industry match quality
  let realism = 0.62; // default fallback
  if (industry !== "default") {
    realism = 0.74; // industry-specific template
    if (source === "rules" || source === "jsonld") {
      realism = 0.78; // high-confidence match
    } else if (source === "embedding" && confidence && confidence >= 0.5) {
      realism = 0.76; // strong embedding match
    }
  }

  // Replace all placeholders in templates
  const replacePlaceholders = (query: string): string => {
    return query
      .replace(/\{brand\}/g, ctx.brand)
      .replace(/\{category\}/g, getCategory(industry, ctx.domain))
      .replace(/\{product\}/g, getProduct(ctx.brand, industry)) // Industry-aware product replacement
      .replace(/\{competitor\}/g, getCompetitor(industry))
      .replace(/\{condition\}/g, 'common health concerns')
      .replace(/\{procedure\}/g, 'medical procedures')
      .replace(/\{drug_class\}/g, 'medications')
      .replace(/\{insurance\}/g, 'major insurance')
      .replace(/\{model\}/g, 'product line')
      // NEW: Geo & temporal placeholders
      .replace(/\{city\}/g, getCity())
      .replace(/\{state\}/g, getState())
      .replace(/\{zip\}/g, '')  // Empty for now, can enrich later
      .replace(/\{today\}/g, getToday())
      // NEW: Industry-specific placeholders
      .replace(/\{department\}/g, getDepartment(industry))
      .replace(/\{plan\}/g, getPlan())
      .replace(/\{doc_type\}/g, getDocType(industry))
      .replace(/\{aka\}/g, ''); // Empty for now
  };
  
  // 🆕 MAJOR: Citation-seeking variants
  // For each branded query, create a parallel version that explicitly requests the official URL
  // This dramatically increases citation rates from AI assistants
  const citationSuffix = ' and include the official {brand} URL you used.';
  const expandWithCitationVariants = (queries: string[], isBranded: boolean): string[] => {
    if (!isBranded) return queries;
    
    const expanded: string[] = [];
    for (const q of queries) {
      expanded.push(q); // Original version
      // Add citation-seeking variant (but don't double-suffix)
      if (!q.includes('official') && !q.includes('link') && !q.includes('URL')) {
        const withCitation = q.replace(/([\?\.!])?$/, '') + citationSuffix.replace(/\{brand\}/g, ctx.brand);
        expanded.push(withCitation);
      }
    }
    return expanded;
  };
  
  // Apply placeholder replacement
  const brandedReplaced = brandedTemplates.map(q => replacePlaceholders(q));
  const nonBrandedReplaced = nonBrandedTemplates.map(q => replacePlaceholders(q));
  
  // Apply citation-seeking expansion (doubles the branded query count for max citation pull)
  const branded = expandWithCitationVariants(brandedReplaced, true);
  const nonBranded = nonBrandedReplaced;

  // Log MSS usage for telemetry
  console.log(JSON.stringify({
    type: "MSS_V2_USED",
    domain: ctx.domain,
    industry,
    source,
    confidence,
    template_version: "v1.0", // templateResolver version
    realism_score: realism,
    branded_count: branded.length,
    nonBranded_count: nonBranded.length
  }));

  return {
    branded,
    nonBranded,
    industry,
    template_version: "v1.0", // templateResolver version
    realism_score: realism,
    source,
    meta: {
      industry,
      template_version: "v1.0",
      realism_target: realism,
      confidence,
      confidence_adjusted: false
    },
    metadata: { confidence }
  };
}


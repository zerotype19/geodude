/**
 * Minimal Safe Set V2 Builder
 * Industry-aware, zero-leak prompt templates with KV caching
 */

import { extractJsonLd, extractNavTerms, fetchColdStartHtml } from "./lib/coldStartSignals";
import { inferIndustryV2 } from "./lib/inferIndustryV2";
import { loadSafeTemplate } from "./mssTemplates";
import { initEmbeddingModel } from "./lib/embeddings";
import type { IndustryKey } from "./taxonomy/industryTaxonomy";

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

  // Try to get cached industry classification
  const cacheKey = `industry:v2:host:${ctx.domain}`;
  let industry: IndustryKey = "default";
  let source: "rules" | "jsonld" | "embedding" | "fallback" = "fallback";
  let confidence: number | undefined;

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
      fallback: ctx.industry || "default"
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

  // Load template for detected industry
  const template = loadSafeTemplate(industry);

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

  // Replace {{brand}} placeholder in branded queries
  const branded = template.branded.map(q => q.replace(/\{\{brand\}\}/g, ctx.brand));
  const nonBranded = template.nonBranded;

  // Log MSS usage for telemetry
  console.log(JSON.stringify({
    type: "MSS_V2_USED",
    domain: ctx.domain,
    industry,
    source,
    confidence,
    template_version: template.version,
    realism_score: realism,
    branded_count: branded.length,
    nonBranded_count: nonBranded.length
  }));

  return {
    branded,
    nonBranded,
    industry,
    template_version: template.version,
    realism_score: realism,
    source,
    meta: {
      industry,
      template_version: template.version,
      realism_target: realism,
      confidence,
      confidence_adjusted: false
    },
    metadata: { confidence }
  };
}


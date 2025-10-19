/**
 * Universal Classification v1.0 - Telemetry & Logging
 * Logs classification events for analysis and tuning
 */

import type { RichClassification } from '../types/classification';

/**
 * Log classification result for telemetry
 */
export function logClassification(params: {
  host: string;
  classification: RichClassification;
  legacySiteType?: string;
  legacyIndustry?: string | null;
}): void {
  const { host, classification, legacySiteType, legacyIndustry } = params;
  
  console.log(JSON.stringify({
    type: 'classification_v2_logged',
    host,
    site_type: classification.site_type.value,
    site_type_confidence: classification.site_type.confidence,
    industry: classification.industry.value,
    industry_confidence: classification.industry.confidence,
    site_mode: classification.site_mode,
    brand_kind: classification.brand_kind,
    purpose: classification.purpose,
    lang: classification.lang,
    region: classification.region,
    jsonld_types_count: classification.jsonld_types.length,
    nav_terms_count: classification.nav_terms.length,
    category_terms: classification.category_terms,
    signals: classification.signals,
    legacy_site_type: legacySiteType,
    legacy_industry: legacyIndustry,
    mismatch: legacySiteType && legacySiteType !== classification.site_type.value
  }));
}

/**
 * Log classification comparison (legacy vs v2)
 */
export function logClassificationComparison(params: {
  host: string;
  legacy: {
    site_type: string;
    industry: string | null;
  };
  v2: RichClassification;
}): void {
  const { host, legacy, v2 } = params;
  
  console.log(JSON.stringify({
    type: 'classification_comparison',
    host,
    legacy_site_type: legacy.site_type,
    v2_site_type: v2.site_type.value,
    site_type_match: legacy.site_type === v2.site_type.value,
    legacy_industry: legacy.industry,
    v2_industry: v2.industry.value,
    industry_match: legacy.industry === v2.industry.value,
    v2_confidence: {
      site_type: v2.site_type.confidence,
      industry: v2.industry.confidence
    },
    v2_signals: v2.signals
  }));
}

/**
 * Log signal breakdown for debugging
 */
export function logSignalBreakdown(params: {
  host: string;
  signals: RichClassification['signals'];
  topScores: Array<{ type: string; score: number }>;
}): void {
  const { host, signals, topScores } = params;
  
  console.log(JSON.stringify({
    type: 'classification_signals',
    host,
    signals,
    top_scores: topScores
  }));
}


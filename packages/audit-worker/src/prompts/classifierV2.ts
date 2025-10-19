/**
 * Universal Classification v1.0 - Main Classifier
 * Phase 1: Rules-only weighted classifier with confidence scoring
 */

import type { RichClassification } from '../types/classification';
import { 
  SITE_TYPE_CLUSTERS, 
  INDUSTRY_BOOSTS, 
  SCHEMA_BOOSTS,
  CLUSTER_TO_SITE_TYPE,
  CLUSTER_TO_INDUSTRY
} from '../lib/weights';
import { detectLangRegion } from '../lib/langRegion';
import { parseJsonLd } from '../lib/jsonld';
import { extractNavSignals, detectNavPatterns } from '../lib/navSignals';
import { detectSiteMode, detectBrandKind, inferPurpose, hasCommerceIndicators } from '../lib/urlModes';

/**
 * Build corpus from HTML for classification
 */
function buildCorpus(params: {
  html: string;
  title?: string;
  metaDescription?: string;
  url: string;
}): string {
  const { html, title = '', metaDescription = '', url } = params;
  
  // Extract H1/H2 headings
  const headings: string[] = [];
  const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  
  let match;
  while ((match = h1Regex.exec(html)) !== null) {
    headings.push(match[1].replace(/<[^>]+>/g, '').trim());
  }
  while ((match = h2Regex.exec(html)) !== null) {
    headings.push(match[1].replace(/<[^>]+>/g, '').trim());
  }
  
  // Extract first 1000 visible words (remove scripts, styles)
  const cleanHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const words = cleanHtml.split(/\s+/).slice(0, 1000).join(' ');
  
  // Combine all signals
  return `${title} ${metaDescription} ${headings.join(' ')} ${words} ${url}`;
}

/**
 * Score clusters against corpus
 */
function scoreCluster(corpus: string, cluster: typeof SITE_TYPE_CLUSTERS[0]): number {
  let score = 0;
  let anyMatch = false;
  
  for (const token of cluster.tokens) {
    const matches = corpus.match(token);
    if (matches) {
      score += cluster.weightPerHit * matches.length;
      anyMatch = true;
    }
  }
  
  if (anyMatch) {
    score += cluster.clusterBonus;
  }
  
  return score;
}

/**
 * Calculate confidence from scores
 */
function calculateConfidence(topScore: number, secondScore: number): number {
  const ratio = topScore / Math.max(1, (topScore + secondScore));
  return Math.min(0.95, Math.max(0.5, ratio));
}

/**
 * Generate category terms from classification
 */
function generateCategoryTerms(params: {
  siteType: string | null;
  industry: string | null;
  brandKind: string | null;
  navTerms: string[];
  jsonldTypes: string[];
}): string[] {
  const { siteType, industry, brandKind, navTerms, jsonldTypes } = params;
  const terms: string[] = [];
  
  // Add brand kind descriptor
  if (brandKind === 'manufacturer') {
    terms.push(`${industry || 'product'} manufacturer`);
  } else if (brandKind === 'retailer') {
    terms.push(`${industry || 'product'} retailer`);
  } else if (brandKind === 'marketplace') {
    terms.push(`${industry || 'product'} marketplace`);
  }
  
  // Add industry-specific terms
  if (industry) {
    terms.push(`${industry} company`);
  }
  
  // Add site type terms
  if (siteType === 'ecommerce') {
    terms.push('online store');
  } else if (siteType === 'media') {
    terms.push('publisher');
  } else if (siteType === 'software') {
    terms.push('software platform');
  }
  
  // Add top nav terms (product-specific)
  const productTerms = navTerms.filter(t => 
    t.length > 4 && 
    !/^(about|contact|blog|news)$/.test(t)
  ).slice(0, 2);
  terms.push(...productTerms);
  
  // Deduplicate and return top 5
  return Array.from(new Set(terms)).slice(0, 5);
}

/**
 * Main classification function
 */
export async function classifyV2(params: {
  html: string;
  url: string;
  hostname: string;
  title?: string;
  metaDescription?: string;
  renderVisibilityPct?: number;
}): Promise<RichClassification> {
  const { html, url, hostname, title, metaDescription, renderVisibilityPct } = params;
  
  // 1. Build corpus
  const corpus = buildCorpus({ html, title, metaDescription, url });
  const pathname = new URL(url).pathname;
  
  // 2. Detect language/region
  const { lang, region, notes: langNotes } = detectLangRegion({ html, url, hostname, title, metaDescription });
  
  // 3. Parse JSON-LD
  const jsonldTypes = parseJsonLd(html);
  
  // 4. Extract nav signals
  const navTerms = extractNavSignals(html);
  const navPatterns = detectNavPatterns(navTerms);
  
  // 5. Detect commerce indicators
  const { hasCart, hasCheckout } = hasCommerceIndicators(html);
  
  // 6. Score site_type clusters
  const siteTypeScores = new Map<string, number>();
  for (const cluster of SITE_TYPE_CLUSTERS) {
    const score = scoreCluster(corpus, cluster);
    if (score > 0) {
      siteTypeScores.set(cluster.id, score);
    }
  }
  
  // Add schema boosts for site_type
  for (const boost of SCHEMA_BOOSTS) {
    if (boost.siteTypeHint && boost.types.some(t => jsonldTypes.includes(t))) {
      const currentScore = siteTypeScores.get(boost.siteTypeHint) || 0;
      siteTypeScores.set(boost.siteTypeHint, currentScore + boost.weight);
    }
  }
  
  // 7. Score industry clusters
  const industryScores = new Map<string, number>();
  for (const boost of INDUSTRY_BOOSTS) {
    const score = scoreCluster(corpus, boost);
    if (score > 0) {
      industryScores.set(boost.id, score);
    }
  }
  
  // Add schema boosts for industry
  for (const boost of SCHEMA_BOOSTS) {
    if (boost.industryHint && boost.types.some(t => jsonldTypes.includes(t))) {
      const currentScore = industryScores.get(boost.industryHint) || 0;
      industryScores.set(boost.industryHint, currentScore + boost.weight);
    }
  }
  
  // 8. Handle gov/edu exceptions
  if (/\.(gov|gouv\.fr|edu|ac\.uk)$/.test(hostname)) {
    if (hostname.endsWith('.edu') || hostname.endsWith('.ac.uk')) {
      industryScores.set('education', 999); // Force education
    } else {
      industryScores.set('government', 999); // Force government
    }
  }
  
  // 9. Determine top site_type
  const sortedSiteTypes = Array.from(siteTypeScores.entries())
    .sort((a, b) => b[1] - a[1]);
  
  const topSiteTypeCluster = sortedSiteTypes[0]?.[0] || 'corporate';
  const topSiteTypeScore = sortedSiteTypes[0]?.[1] || 0;
  const secondSiteTypeScore = sortedSiteTypes[1]?.[1] || 0;
  
  const siteTypeValue = CLUSTER_TO_SITE_TYPE[topSiteTypeCluster] || 'corporate';
  const siteTypeConfidence = calculateConfidence(topSiteTypeScore, secondSiteTypeScore);
  
  // 10. Determine top industry
  const sortedIndustries = Array.from(industryScores.entries())
    .sort((a, b) => b[1] - a[1]);
  
  const topIndustryCluster = sortedIndustries[0]?.[0] || null;
  const topIndustryScore = sortedIndustries[0]?.[1] || 0;
  const secondIndustryScore = sortedIndustries[1]?.[1] || 0;
  
  const industryValue = topIndustryCluster ? (CLUSTER_TO_INDUSTRY[topIndustryCluster] || topIndustryCluster) : null;
  const industryConfidence = topIndustryScore > 0 ? calculateConfidence(topIndustryScore, secondIndustryScore) : null;
  
  // 11. Detect site_mode
  const siteMode = detectSiteMode({ 
    url, 
    hostname, 
    pathname, 
    navTerms, 
    hasCart, 
    hasCheckout 
  });
  
  // 12. Detect brand_kind
  const brandKind = detectBrandKind({ html, navTerms, siteMode });
  
  // 13. Infer purpose
  const purpose = inferPurpose(siteMode, industryValue);
  
  // 14. Generate category terms
  const categoryTerms = generateCategoryTerms({
    siteType: siteTypeValue,
    industry: industryValue,
    brandKind,
    navTerms,
    jsonldTypes
  });
  
  // 15. Build signals object
  const signals = {
    url: 1,
    schema: jsonldTypes.length,
    nav: navTerms.length,
    commerce: siteTypeScores.get('commerce') || 0,
    media: siteTypeScores.get('media') || 0,
    software: siteTypeScores.get('software') || 0,
    finance: industryScores.get('finance') || 0,
    insurance: industryScores.get('insurance') || 0,
    travel: industryScores.get('travel') || 0,
    automotive: industryScores.get('automotive') || 0
  };
  
  // 16. Build notes
  const notes = [...langNotes];
  if (renderVisibilityPct && renderVisibilityPct < 0.3) {
    notes.push('Low render visibility (<30%); SPA-heavy site');
  }
  if (siteTypeConfidence < 0.6) {
    notes.push(`Low site_type confidence (${siteTypeConfidence.toFixed(2)})`);
  }
  
  // 17. Return rich classification
  return {
    site_type: { value: siteTypeValue, confidence: siteTypeConfidence },
    industry: { value: industryValue, confidence: industryConfidence },
    site_mode: siteMode,
    brand_kind: brandKind,
    purpose,
    lang,
    region,
    jsonld_types: jsonldTypes,
    nav_terms: navTerms,
    category_terms: categoryTerms,
    render_visibility_pct: renderVisibilityPct,
    signals,
    notes: notes.length > 0 ? notes : undefined
  };
}


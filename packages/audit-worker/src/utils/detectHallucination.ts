/**
 * Hallucination Detection Utility
 * 
 * Detects when LLM-generated queries contain hallucinated brand names,
 * product names, or other factually incorrect information.
 */

import { ANTI_PATTERNS } from '../prompts/anti-patterns';
import BRANDS from '../../config/brands.json';
import COMPETITORS from '../../config/competitors.json';

export interface HallucinationResult {
  query: string;
  is_hallucination: boolean;
  confidence: number; // 0-1, higher = more confident it's a hallucination
  reasons: string[];
  category: 'brand' | 'product' | 'competitor' | 'term' | 'none';
}

/**
 * Detect if a query contains hallucinated content
 */
export function detectHallucination(
  query: string,
  domain?: string,
  industry?: string
): HallucinationResult {
  const lower = query.toLowerCase().trim();
  const reasons: string[] = [];
  let confidence = 0;
  let category: HallucinationResult['category'] = 'none';

  // Check against anti-patterns (critical hallucinations)
  for (const pattern of ANTI_PATTERNS.hallucination) {
    if (pattern.pattern.test(lower)) {
      reasons.push(pattern.reason);
      confidence = Math.max(confidence, 0.9); // Very high confidence
      category = 'brand';
    }
  }

  // Check for avoid_terms from brand knowledge base
  if (domain) {
    const brandKey = domain.replace(/^www\./, '');
    const brandInfo = (BRANDS as any)[brandKey];
    
    if (brandInfo?.avoid_terms) {
      for (const avoidTerm of brandInfo.avoid_terms) {
        if (lower.includes(avoidTerm.toLowerCase())) {
          reasons.push(`Contains hallucinated term: "${avoidTerm}"`);
          confidence = Math.max(confidence, 0.95); // Very high confidence
          category = 'product';
        }
      }
    }
  }

  // Check for invented competitor names
  if (domain) {
    const brandKey = domain.replace(/^www\./, '');
    const competitorInfo = (COMPETITORS as any)[brandKey];
    
    if (competitorInfo) {
      // Extract potential competitor mentions in query
      const words = query.split(/\s+/);
      for (const word of words) {
        // If it looks like a brand name (capitalized, ends with common TLDs)
        if (/^[A-Z][a-z]+(\.(com|net|org))?$/.test(word)) {
          const isKnownCompetitor = [
            ...(competitorInfo.direct_competitors || []),
            ...(competitorInfo.category_alternatives || []),
            ...Object.values(competitorInfo.by_product || {}).flat()
          ].some((comp: string) => 
            word.toLowerCase().includes(comp.toLowerCase()) ||
            comp.toLowerCase().includes(word.toLowerCase())
          );
          
          if (!isKnownCompetitor && word.toLowerCase() !== brandKey) {
            reasons.push(`Potentially hallucinated competitor: "${word}"`);
            confidence = Math.max(confidence, 0.6); // Medium confidence
            category = 'competitor';
          }
        }
      }
    }
  }

  // Check for suspicious generic terms with brand modifiers
  const suspiciousTerms = /\b(makers|builders|creators|pros|members|shoppers|buyers)\s+(pricing|cost|account|portal|exclusive|premium|pro|plus)\b/i;
  if (suspiciousTerms.test(lower)) {
    if (reasons.length === 0) { // Only flag if not already caught
      reasons.push('Generic term used as brand (e.g., "Makers pricing")');
      confidence = Math.max(confidence, 0.75);
      category = 'term';
    }
  }

  return {
    query,
    is_hallucination: confidence > 0.5,
    confidence,
    reasons,
    category
  };
}

/**
 * Detect hallucinations in a batch of queries
 */
export function detectHallucinations(
  queries: string[],
  domain?: string,
  industry?: string
): {
  total: number;
  hallucinated: number;
  rate: number;
  details: HallucinationResult[];
} {
  const results = queries.map(q => detectHallucination(q, domain, industry));
  const hallucinated = results.filter(r => r.is_hallucination).length;
  
  return {
    total: queries.length,
    hallucinated,
    rate: queries.length > 0 ? hallucinated / queries.length : 0,
    details: results.filter(r => r.is_hallucination)
  };
}

/**
 * Get hallucination summary by category
 */
export function getHallucinationSummary(
  results: HallucinationResult[]
): Record<string, number> {
  const summary: Record<string, number> = {
    brand: 0,
    product: 0,
    competitor: 0,
    term: 0,
    none: 0
  };
  
  for (const result of results) {
    summary[result.category]++;
  }
  
  return summary;
}


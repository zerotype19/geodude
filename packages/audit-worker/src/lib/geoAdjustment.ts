/**
 * GEO Adjusted Score - Blends structural readiness (GEO raw) with real-world visibility (citations)
 * 
 * Philosophy:
 * - GEO raw measures structural readiness (schema, provenance, chunkability)
 * - Citations prove real-world AI visibility
 * - High citations with low GEO = authority/coverage > structure
 * - Adjustment rewards proven performance while keeping structure incentivized
 */

export type CitationRates = {
  chatgpt?: number;      // 0.0-1.0
  claude?: number;       // 0.0-1.0
  perplexity?: number;   // 0.0-1.0
  brave?: number;        // 0.0-1.0
};

export type GeoAdjustmentResult = {
  geo_raw: number;
  geo_adjusted: number;
  citation_bonus: number;
  breakdown: {
    chatgpt_contribution: number;
    claude_contribution: number;
    perplexity_contribution: number;
  };
  performance_flag?: 'citation_overperformance' | 'structural_advantage' | 'balanced';
};

/**
 * Calculate GEO Adjusted Score with citation bonuses
 * 
 * Bonuses:
 * - ChatGPT/Claude ≥50% cited: +5 points each (high authority signals)
 * - Perplexity ≥75% cited: +3 points (real-time web search validation)
 * - Max total bonus: +10 points
 * 
 * Formula:
 *   geo_adjusted = min(100, geo_raw + citation_bonus)
 */
export function calculateGeoAdjusted(
  geoRaw: number,
  citationRates: CitationRates
): GeoAdjustmentResult {
  const chatgptRate = citationRates.chatgpt ?? 0;
  const claudeRate = citationRates.claude ?? 0;
  const perplexityRate = citationRates.perplexity ?? 0;
  
  // Citation bonuses (proven real-world visibility)
  let chatgptBonus = 0;
  let claudeBonus = 0;
  let perplexityBonus = 0;
  
  // ChatGPT: High authority signal (used by millions)
  if (chatgptRate >= 0.50) {
    chatgptBonus = 5;
  } else if (chatgptRate >= 0.30) {
    chatgptBonus = 3;
  }
  
  // Claude: High authority signal (technical/analytical)
  if (claudeRate >= 0.50) {
    claudeBonus = 5;
  } else if (claudeRate >= 0.30) {
    claudeBonus = 3;
  }
  
  // Perplexity: Real-time web search validation
  if (perplexityRate >= 0.75) {
    perplexityBonus = 3;
  } else if (perplexityRate >= 0.50) {
    perplexityBonus = 2;
  }
  
  // Total bonus (capped at +10)
  const citationBonus = Math.min(10, chatgptBonus + claudeBonus + perplexityBonus);
  
  // Adjusted score (capped at 100)
  const geoAdjusted = Math.min(100, geoRaw + citationBonus);
  
  // Performance flag for insights
  let performanceFlag: 'citation_overperformance' | 'structural_advantage' | 'balanced' | undefined;
  const gap = geoAdjusted - geoRaw;
  
  if (gap >= 8 && geoRaw < 30) {
    performanceFlag = 'citation_overperformance'; // High citations, low structure
  } else if (geoRaw >= 60 && gap < 3) {
    performanceFlag = 'structural_advantage'; // High structure, citations catching up
  } else if (gap >= 3 && gap <= 7) {
    performanceFlag = 'balanced'; // Citations complement structure
  }
  
  return {
    geo_raw: geoRaw,
    geo_adjusted: geoAdjusted,
    citation_bonus: citationBonus,
    breakdown: {
      chatgpt_contribution: chatgptBonus,
      claude_contribution: claudeBonus,
      perplexity_contribution: perplexityBonus
    },
    performance_flag: performanceFlag
  };
}

/**
 * Get citation rates from citations summary data
 */
export function extractCitationRates(citationsSummary: any): CitationRates {
  if (!citationsSummary || !citationsSummary.by_source) {
    return {};
  }
  
  const rates: CitationRates = {};
  
  for (const source of citationsSummary.by_source) {
    const rate = source.total_queries > 0 
      ? source.cited_queries / source.total_queries 
      : 0;
    
    const sourceName = source.source.toLowerCase();
    if (sourceName === 'chatgpt' || sourceName === 'openai') {
      rates.chatgpt = rate;
    } else if (sourceName === 'claude') {
      rates.claude = rate;
    } else if (sourceName === 'perplexity') {
      rates.perplexity = rate;
    } else if (sourceName === 'brave') {
      rates.brave = rate;
    }
  }
  
  return rates;
}

/**
 * Helper: Get human-readable performance explanation
 */
export function getPerformanceExplanation(result: GeoAdjustmentResult): string {
  switch (result.performance_flag) {
    case 'citation_overperformance':
      return `Strong AI visibility (+${result.citation_bonus} bonus) despite low structural score. Brand authority and content relevance are driving citations. Consider improving schema and provenance to maximize potential.`;
    
    case 'structural_advantage':
      return `Excellent structural readiness with ${result.geo_raw}/100 raw score. Citation rates are growing as AI engines index your improvements. Maintain structural quality while expanding content coverage.`;
    
    case 'balanced':
      return `Good balance between structure (${result.geo_raw}/100) and visibility (+${result.citation_bonus} citation bonus). Both technical readiness and real-world AI performance are aligned.`;
    
    default:
      if (result.citation_bonus === 0) {
        return `GEO score reflects structural readiness. Run citations to measure real-world AI visibility and unlock potential bonuses.`;
      }
      return `Adjusted score includes +${result.citation_bonus} bonus from proven AI citations.`;
  }
}


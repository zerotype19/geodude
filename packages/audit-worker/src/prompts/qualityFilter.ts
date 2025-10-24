/**
 * Query Quality Filter
 * 
 * Comprehensive quality filtering system that:
 * - Rejects unnatural, nonsensical, or template-generated queries
 * - Detects brand hallucinations
 * - Applies rewrite rules to fix common mistakes
 * - Integrates with anti-patterns library
 */

import { checkAntiPatterns } from './anti-patterns';
import { applyRewrites } from './rewrites';

interface QualityCheckResult {
  isValid: boolean;
  reason?: string;
  severity?: string;
}

/**
 * Check if a query sounds natural and human-like
 */
export function isNaturalQuery(query: string): QualityCheckResult {
  const lower = query.toLowerCase().trim();
  
  // 1. Reject queries with obvious template artifacts
  const templateArtifacts = [
    /availability and limits for \w+s in/i,  // "Availability and limits for orlandos in..."
    /are \w+s safe for getting started/i,     // "Are orlandos safe for getting started?"
    /do \w+s support \w+ and \w+/i,          // "Do orlandos support USD and EUR?"
    /when should someone choose \w+s for/i,   // "When should someone choose orlandos for..."
  ];
  
  for (const pattern of templateArtifacts) {
    if (pattern.test(lower)) {
      return { 
        isValid: false, 
        reason: `Template artifact detected: ${pattern}` 
      };
    }
  }
  
  // 2. Reject queries with nonsensical brand pluralization
  // E.g., "orlandos", "visit orlandos", "nike.coms"
  const nonsensePlurals = [
    /\b\w+s\.com/i,                          // "stripes.com", "nikes.com"
    /\b(visit|see|explore|go to)\s+\w+s\b/i, // "visit orlandos", "explore nikes"
    /\borlandos?\b/i,                        // "orlando" or "orlandos" as standalone word (not in "orlando hotels")
  ];
  
  for (const pattern of nonsensePlurals) {
    if (pattern.test(lower)) {
      return { 
        isValid: false, 
        reason: `Nonsensical pluralization: ${pattern}` 
      };
    }
  }
  
  // 2b. Reject queries with hallucinated brand combinations
  // E.g., "Adobe makers", "Nike pros", "Stripe merchants" (when not actual products)
  // Pattern: [Brand] + [generic noun that sounds like a product but isn't]
  const suspiciousPatterns = [
    /\b(adobe|salesforce|stripe|microsoft|google|amazon|apple)\s+(makers|builders|creators|pros|plus|premium|enterprise|business)\b/i,
    /\b(makers|builders|creators|pros)\s+(pricing|cost|fees|support|reviews)\b/i, // "Makers pricing" when "Makers" isn't the brand
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(lower)) {
      return { 
        isValid: false, 
        reason: `Potential brand hallucination: ${pattern}` 
      };
    }
  }
  
  // 3. Reject queries that are too generic or vague
  if (lower.length < 10) {
    return { 
      isValid: false, 
      reason: 'Query too short/generic' 
    };
  }
  
  // 4. Reject queries with excessive repetition
  const words = lower.split(/\s+/);
  const uniqueWords = new Set(words);
  if (words.length > 5 && uniqueWords.size / words.length < 0.5) {
    return { 
      isValid: false, 
      reason: 'Excessive word repetition' 
    };
  }
  
  // 5. Reject queries that don't sound like questions people would actually ask
  const unnaturalPhrases = [
    /\bhow does.*work for.*and/i,           // "How does X work for Y and Z" (too formal)
    /\bexplain how.*works for/i,            // "Explain how X works for Y" (too instructional)
    /\bwhen should someone/i,                // "When should someone..." (too formal)
    /\bsteps to (use|set up)/i,              // "Steps to use X" (not a natural search)
  ];
  
  for (const pattern of unnaturalPhrases) {
    if (pattern.test(lower)) {
      return { 
        isValid: false, 
        reason: `Unnatural phrasing: ${pattern}` 
      };
    }
  }
  
  // Passed all checks
  return { isValid: true };
}

/**
 * Calculate human-likelihood score for a query (0-1)
 * Higher scores indicate more natural, conversational phrasing
 * Target: ≥ 0.7 for production queries
 */
export function humanScore(q: string): number {
  let score = 0;
  
  // 1. Personal language (+0.2)
  const personal = /\b(I|me|my|should I|would you|help me|worth it|actually|really|vs)\b/i.test(q);
  if (personal) score += 0.2;
  
  // 2. Length appropriateness (+0.5)
  const wordCount = q.split(/\s+/).length;
  if (wordCount >= 6 && wordCount <= 15) {
    score += 0.5;
  } else if (wordCount >= 4 && wordCount <= 20) {
    score += 0.3;  // Partial credit for reasonable length
  } else {
    score += 0.1;  // Too short or too long
  }
  
  // 3. Natural punctuation (+0.3)
  if (q.includes('?')) score += 0.3;
  else if (q.includes('.')) score += 0.1;
  
  // 4. Conversational stems (+0.2)
  const conversationalStems = [
    /^(why|what's the|how come|is it really|what's the catch)/i,
    /^(how do I|help me|tips for|guide to)/i,
    /\b(vs|worth switching|better than|alternatives to|should I choose)\b/i,
    /\b(worth the|any reason to|would you recommend)\b/i
  ];
  const hasConversationalStem = conversationalStems.some(pattern => pattern.test(q));
  if (hasConversationalStem) score += 0.2;
  
  // 5. Deductions for unnatural patterns
  if (/\b(steps to|explain how|when should someone)\b/i.test(q)) score -= 0.3;
  if (/availability and limits/i.test(q)) score -= 0.4;
  if (q.endsWith('.')) score -= 0.1;  // Questions shouldn't end with periods
  
  return Math.max(0, Math.min(1, score));  // Clamp to 0-1 range
}

/**
 * Calculate average human score for a batch of queries
 */
export function averageHumanScore(queries: string[]): number {
  if (queries.length === 0) return 0;
  const sum = queries.reduce((acc, q) => acc + humanScore(q), 0);
  return sum / queries.length;
}

/**
 * Filter an array of queries, removing low-quality ones (legacy function)
 */
export function filterQueriesByQuality(queries: string[]): {
  valid: string[];
  rejected: Array<{ query: string; reason: string }>;
} {
  const valid: string[] = [];
  const rejected: Array<{ query: string; reason: string }> = [];
  
  for (const query of queries) {
    const check = isNaturalQuery(query);
    if (check.isValid) {
      valid.push(query);
    } else {
      rejected.push({ 
        query, 
        reason: check.reason || 'Unknown quality issue' 
      });
    }
  }
  
  return { valid, rejected };
}

/**
 * Filter queries by industry appropriateness
 * Uses industry taxonomy to reject incompatible queries
 */
export function validateQueriesForIndustry(
  queries: string[],
  industry: string
): { valid: string[]; rejected: Array<{ query: string; reason: string }> } {
  try {
    const { validateQueryForIndustry } = require('../config/industry-taxonomy');
    
    const valid: string[] = [];
    const rejected: Array<{ query: string; reason: string }> = [];
    
    for (const query of queries) {
      const validation = validateQueryForIndustry(query, industry);
      if (validation.valid) {
        valid.push(query);
        // Log warnings for queries that don't match expected types but aren't rejected
        if (validation.reason) {
          console.log(`[QUERY_VALIDATION_WARN] "${query}" for "${industry}" - ${validation.reason}`);
        }
      } else {
        rejected.push({ query, reason: validation.reason || 'Failed industry validation' });
        console.log(`[QUERY_VALIDATION_REJECT] "${query}" for "${industry}" - ${validation.reason}`);
      }
    }
    
    return { valid, rejected };
  } catch (err) {
    // If taxonomy import fails, allow all queries (graceful fallback)
    console.warn('[QUERY_VALIDATION] Industry taxonomy not available, skipping validation');
    return { valid: queries, rejected: [] };
  }
}

/**
 * Comprehensive quality filter with anti-patterns, rewrites, and industry validation
 * This is the NEW recommended method for filtering queries
 */
export function filterAndRewriteQueries(
  queries: string[],
  options?: {
    industry?: string;
    domain?: string;
    applyRewrites?: boolean;
    minHumanScore?: number;
  }
): {
  valid: string[];
  rejected: Array<{ query: string; reason: string; severity?: string }>;
  rewritten: Array<{ original: string; rewritten: string; rules: string[] }>;
  stats: {
    total: number;
    passed: number;
    rejected: number;
    rewritten: number;
    avg_human_score: number;
  };
} {
  const opts = {
    applyRewrites: true,
    minHumanScore: 0.6,
    ...options
  };

  const valid: string[] = [];
  const rejected: Array<{ query: string; reason: string; severity?: string }> = [];
  const rewritten: Array<{ original: string; rewritten: string; rules: string[] }> = [];
  
  let totalHumanScore = 0;
  
  for (let query of queries) {
    const originalQuery = query;
    
    // Step 1: Industry validation (CRITICAL - reject incompatible queries immediately)
    if (opts.industry) {
      const industryValidation = validateQueriesForIndustry([query], opts.industry);
      if (industryValidation.rejected.length > 0) {
        rejected.push({
          query,
          reason: industryValidation.rejected[0].reason,
          severity: 'critical'
        });
        continue;
      }
    }
    
    // Step 2: Check anti-patterns (most critical)
    const antiPatternCheck = checkAntiPatterns(query, opts.industry);
    if (!antiPatternCheck.isValid) {
      rejected.push({
        query,
        reason: antiPatternCheck.reason || 'Anti-pattern detected',
        severity: antiPatternCheck.severity
      });
      continue;
    }
    
    // Step 3: Check legacy quality filters
    const qualityCheck = isNaturalQuery(query);
    if (!qualityCheck.isValid) {
      rejected.push({
        query,
        reason: qualityCheck.reason || 'Quality check failed',
        severity: 'warning'
      });
      continue;
    }
    
    // Step 4: Apply rewrites if enabled
    if (opts.applyRewrites) {
      const { rewritten: newQuery, applied } = applyRewrites(query);
      if (applied.length > 0) {
        rewritten.push({
          original: query,
          rewritten: newQuery,
          rules: applied
        });
        query = newQuery;
      }
    }
    
    // Step 5: Check human score
    const hScore = humanScore(query);
    totalHumanScore += hScore;
    
    if (hScore < opts.minHumanScore) {
      rejected.push({
        query,
        reason: `Human score too low: ${hScore.toFixed(2)} < ${opts.minHumanScore}`,
        severity: 'info'
      });
      continue;
    }
    
    // Passed all checks
    valid.push(query);
  }
  
  return {
    valid,
    rejected,
    rewritten,
    stats: {
      total: queries.length,
      passed: valid.length,
      rejected: rejected.length,
      rewritten: rewritten.length,
      avg_human_score: queries.length > 0 ? totalHumanScore / queries.length : 0
    }
  };
}


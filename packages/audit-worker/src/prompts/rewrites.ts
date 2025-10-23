/**
 * Query Rewrite Rules
 * 
 * Transformation rules to automatically fix common LLM mistakes
 * and normalize queries to more natural, conversational forms.
 */

export interface RewriteRule {
  match: RegExp;
  rewrite: string | ((match: string, ...groups: string[]) => string);
  reason: string;
  priority?: number; // Higher priority runs first
}

export const REWRITE_RULES: RewriteRule[] = [
  // CRITICAL: Remove hallucinated brand combinations
  {
    match: /(Adobe|Salesforce|Stripe|Microsoft|Google|Amazon|Apple|Walmart|Target)\s+(makers|builders|creators)/i,
    rewrite: (match, brand) => brand,
    reason: 'Remove hallucinated product name suffix',
    priority: 100
  },
  
  // Normalize formal questions to conversational
  {
    match: /^What is the (cost|price|fee) of (.+)\??$/i,
    rewrite: "What's the $1 for $2?",
    reason: 'More conversational phrasing',
    priority: 50
  },
  {
    match: /^What is the (best|top) (.+) for (.+)\??$/i,
    rewrite: "Best $2 for $3?",
    reason: 'More conversational phrasing',
    priority: 50
  },
  
  // Normalize pricing terminology
  {
    match: /monthly subscription/gi,
    rewrite: 'per month',
    reason: 'Simpler pricing terminology',
    priority: 30
  },
  {
    match: /yearly plan/gi,
    rewrite: 'annual',
    reason: 'More common terminology',
    priority: 30
  },
  {
    match: /annual fee/gi,
    rewrite: 'yearly cost',
    reason: 'More conversational',
    priority: 30
  },
  
  // Fix common punctuation issues
  {
    match: /\s+\?+$/,
    rewrite: '?',
    reason: 'Remove extra question marks',
    priority: 80
  },
  {
    match: /\.+$/,
    rewrite: '',
    reason: 'Remove trailing periods from questions',
    priority: 80
  },
  {
    match: /\s{2,}/g,
    rewrite: ' ',
    reason: 'Normalize multiple spaces',
    priority: 90
  },
  
  // Normalize comparison phrasing
  {
    match: /compare (.+) and (.+)/i,
    rewrite: '$1 vs $2',
    reason: 'More natural comparison format',
    priority: 40
  },
  {
    match: /\bversus\b/gi,
    rewrite: 'vs',
    reason: 'Shorter, more common abbreviation',
    priority: 40
  },
  
  // Remove overly formal language
  {
    match: /^Could you (please )?tell me/i,
    rewrite: '',
    reason: 'Too formal for search query',
    priority: 60
  },
  {
    match: /^I would like to know/i,
    rewrite: '',
    reason: 'Too formal for search query',
    priority: 60
  },
  {
    match: /^Please explain/i,
    rewrite: 'How does',
    reason: 'More natural question format',
    priority: 60
  },
  
  // Normalize brand name casing (common mistakes)
  {
    match: /\bsalesforce/gi,
    rewrite: 'Salesforce',
    reason: 'Correct brand capitalization',
    priority: 20
  },
  {
    match: /\badobe/gi,
    rewrite: 'Adobe',
    reason: 'Correct brand capitalization',
    priority: 20
  },
  {
    match: /\bmicrosoft/gi,
    rewrite: 'Microsoft',
    reason: 'Correct brand capitalization',
    priority: 20
  },
  
  // Remove redundant words
  {
    match: /\b(very|really|actually) (good|bad|expensive|cheap|worth)\b/gi,
    rewrite: '$2',
    reason: 'Remove filler words',
    priority: 30
  },
  
  // Normalize product references
  {
    match: /\b(the\s+)?(.+)\s+product\b/gi,
    rewrite: '$2',
    reason: 'Remove redundant "product" suffix',
    priority: 25
  },
  {
    match: /\b(the\s+)?(.+)\s+service\b/gi,
    rewrite: '$2',
    reason: 'Remove redundant "service" suffix',
    priority: 25
  }
];

/**
 * Apply rewrite rules to a query
 */
export function applyRewrites(query: string, maxRewrites: number = 5): {
  rewritten: string;
  applied: string[];
} {
  let result = query.trim();
  const applied: string[] = [];
  
  // Sort by priority (highest first)
  const sortedRules = [...REWRITE_RULES].sort((a, b) => 
    (b.priority || 0) - (a.priority || 0)
  );
  
  let rewriteCount = 0;
  for (const rule of sortedRules) {
    if (rewriteCount >= maxRewrites) break;
    
    if (rule.match.test(result)) {
      const oldResult = result;
      
      if (typeof rule.rewrite === 'function') {
        result = result.replace(rule.match, rule.rewrite as any);
      } else {
        result = result.replace(rule.match, rule.rewrite);
      }
      
      if (result !== oldResult) {
        applied.push(rule.reason);
        rewriteCount++;
      }
    }
  }
  
  return {
    rewritten: result.trim(),
    applied
  };
}

/**
 * Apply rewrites to an array of queries
 */
export function applyRewritesToBatch(queries: string[]): {
  queries: string[];
  stats: {
    total: number;
    rewritten: number;
    unchanged: number;
  };
} {
  let rewritten = 0;
  const results = queries.map(q => {
    const { rewritten: newQ, applied } = applyRewrites(q);
    if (applied.length > 0) rewritten++;
    return newQ;
  });
  
  return {
    queries: results,
    stats: {
      total: queries.length,
      rewritten,
      unchanged: queries.length - rewritten
    }
  };
}


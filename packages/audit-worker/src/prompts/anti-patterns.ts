/**
 * Anti-Patterns Detection Library
 * 
 * Comprehensive catalog of known bad patterns in LLM-generated queries.
 * Organized by severity and category for efficient filtering.
 */

export interface AntiPattern {
  pattern: RegExp;
  severity: 'critical' | 'warning' | 'info';
  reason: string;
  unless_industry?: string[];
}

export const ANTI_PATTERNS = {
  /**
   * Brand Hallucination Patterns
   * These are CRITICAL - they indicate the LLM is inventing product names
   */
  hallucination: [
    {
      pattern: /\b(adobe|salesforce|stripe|microsoft|google|amazon|apple|walmart|target|nike|tesla)\s+(makers|builders|creators|pros|plus\+?|premium|enterprise|business|members|shoppers|buyers|users|customers|clients|subscribers|watchers|viewers|listeners|readers|drivers|passengers|travelers|flyers|cruisers|eaters|drinkers|learners|students)\b/i,
      severity: 'critical' as const,
      reason: 'Brand + generic noun hallucination (e.g., "Adobe makers", "Stripe merchants")'
    },
    {
      pattern: /\b(makers|builders|creators|pros|members|shoppers|buyers|guests|travelers|passengers)\s+(pricing|cost|fees|support|reviews|plans|account|portal|dashboard|membership|subscription|program|benefits|rewards|exclusive|premium|pro|plus)\b/i,
      severity: 'critical' as const,
      reason: 'Generic noun + service term when noun isn\'t the actual brand (e.g., "Makers pricing", "Shoppers pro")'
    },
    {
      pattern: /\b(pro\s+plus|premium\s+pro|enterprise\s+premium|business\s+enterprise|members\s+pro|exclusive\s+plus)\b/i,
      severity: 'critical' as const,
      reason: 'Compound hallucinated tier names (e.g., "Pro Plus", "Members Pro")'
    },
    {
      pattern: /\b\w+s\.com\b/i,
      severity: 'warning' as const,
      reason: 'Pluralized domain (e.g., "nikes.com", "stripes.com")'
    }
  ],

  /**
   * Unnatural Phrasing Patterns
   * These make queries sound robotic or template-generated
   */
  unnatural: [
    {
      pattern: /^steps to (use|set up|install|configure)/i,
      severity: 'warning' as const,
      reason: 'Too instructional - not how people search'
    },
    {
      pattern: /^explain how .* works for/i,
      severity: 'warning' as const,
      reason: 'Too formal - not conversational'
    },
    {
      pattern: /^when should someone choose/i,
      severity: 'warning' as const,
      reason: 'Third-person phrasing - unnatural for search'
    },
    {
      pattern: /availability and limits for .* in/i,
      severity: 'critical' as const,
      reason: 'Template artifact - overly formal structure'
    },
    {
      pattern: /\b(visit|see|explore|go to)\s+\w+s\b/i,
      severity: 'warning' as const,
      reason: 'Nonsensical pluralization with action verbs (e.g., "visit orlandos")'
    }
  ],

  /**
   * Factual Error Patterns
   * These indicate industry-inappropriate terminology
   */
  factual_errors: [
    {
      pattern: /\bFDIC insured\b/i,
      severity: 'warning' as const,
      reason: 'FDIC insurance only relevant for financial services',
      unless_industry: ['financial_services']
    },
    {
      pattern: /\bHIPAA compliant\b/i,
      severity: 'warning' as const,
      reason: 'HIPAA only relevant for healthcare providers',
      unless_industry: ['healthcare_provider', 'saas_b2b']
    },
    {
      pattern: /\b(baggage fees|checked bags|carry-on)\b/i,
      severity: 'warning' as const,
      reason: 'Airline terminology used outside travel context',
      unless_industry: ['travel_air']
    },
    {
      pattern: /\b(loyalty program|frequent flyer|miles|points)\b/i,
      severity: 'info' as const,
      reason: 'Rewards program terminology - verify industry match',
      unless_industry: ['travel_air', 'travel_hotels', 'travel_cruise', 'retail', 'financial_services']
    }
  ],

  /**
   * Repetition and Low Quality Patterns
   */
  quality_issues: [
    {
      pattern: /\b(\w+)\s+\1\b/i,
      severity: 'critical' as const,
      reason: 'Word repetition (e.g., "cruises cruises", "orlando orlando")'
    },
    {
      pattern: /^.{0,10}$/,
      severity: 'warning' as const,
      reason: 'Query too short/generic (< 10 characters)'
    },
    {
      pattern: /[,]{3,}/,
      severity: 'warning' as const,
      reason: 'Excessive commas - likely malformed'
    }
  ],

  /**
   * Site-Specific Anti-Patterns
   * These catch known problematic queries for specific domains
   */
  site_specific: [
    {
      pattern: /\borlandos?\b/i,
      severity: 'critical' as const,
      reason: 'Orlando pluralization issue (use "Orlando hotels", not "orlandos")'
    },
    {
      pattern: /\b(login|sign in|account|dashboard|portal)\s+(page|issues|help)\b/i,
      severity: 'warning' as const,
      reason: 'Technical support query - not what users ask AI assistants'
    }
  ]
};

/**
 * Check if a query matches any anti-pattern
 */
export function checkAntiPatterns(
  query: string,
  industry?: string
): { isValid: boolean; reason?: string; severity?: string } {
  const lower = query.toLowerCase().trim();

  // Check all pattern categories
  for (const [category, patterns] of Object.entries(ANTI_PATTERNS)) {
    for (const antiPattern of patterns) {
      // Skip if pattern has industry exception and we match it
      if (antiPattern.unless_industry && industry && antiPattern.unless_industry.includes(industry)) {
        continue;
      }

      if (antiPattern.pattern.test(lower)) {
        return {
          isValid: false,
          reason: antiPattern.reason,
          severity: antiPattern.severity
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Get all critical anti-patterns for logging/monitoring
 */
export function getCriticalPatterns(): AntiPattern[] {
  return Object.values(ANTI_PATTERNS)
    .flat()
    .filter(p => p.severity === 'critical');
}


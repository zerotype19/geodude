/**
 * Intent Taxonomy - Universal, Industry-Aware
 * Ensures balanced coverage across user intent types
 */

export type IntentKey =
  | "trust" | "cost" | "rewards" | "compare" | "acceptance"
  | "support" | "eligibility" | "features";

export type IntentQuotas = Partial<Record<IntentKey, number>>;

// Default quotas (sum=20)
export const DEFAULT_QUOTAS: IntentQuotas = {
  trust: 3,
  cost: 2,
  rewards: 3,
  compare: 3,
  acceptance: 3,
  support: 2,
  eligibility: 2,
  features: 2
};

// Industry/vertical overrides (light-touch)
export const INDUSTRY_QUOTAS: Record<string, IntentQuotas> = {
  finance: {
    rewards: 4,
    trust: 3,
    cost: 2,
    compare: 3,
    eligibility: 3,
    acceptance: 2,
    support: 2,
    features: 1
  },
  "finance:network": {
    // Payment networks (Visa, Mastercard, Amex)
    acceptance: 4,
    compare: 3,
    trust: 3,
    cost: 2,
    features: 3,
    support: 2,
    eligibility: 1,
    rewards: 2
  },
  "finance:bank": {
    // Banks (Chase, BofA)
    eligibility: 4,
    rewards: 4,
    trust: 3,
    compare: 3,
    cost: 2,
    support: 2,
    acceptance: 1,
    features: 1
  },
  insurance: {
    trust: 4,
    cost: 2,
    compare: 3,
    eligibility: 3,
    support: 3,
    features: 2,
    acceptance: 1,
    rewards: 2
  },
  travel: {
    compare: 4,
    cost: 3,
    trust: 2,
    features: 3,
    support: 2,
    acceptance: 2,
    eligibility: 2,
    rewards: 2
  },
  retail: {
    compare: 3,
    features: 4,
    cost: 3,
    trust: 2,
    acceptance: 3,
    support: 2,
    eligibility: 2,
    rewards: 1
  },
  software: {
    features: 4,
    compare: 3,
    trust: 2,
    cost: 2,
    support: 3,
    acceptance: 1,
    eligibility: 2,
    rewards: 1
  },
  automotive: {
    compare: 3,
    features: 3,
    cost: 3,
    trust: 2,
    acceptance: 3,
    support: 2,
    eligibility: 2,
    rewards: 2
  }
};

export function resolveQuotas(
  industry?: string | null, 
  brandKind?: string | null
): IntentQuotas {
  const base = { ...DEFAULT_QUOTAS };
  
  // Check for industry:brandKind composite key first
  if (industry && brandKind) {
    const compositeKey = `${industry}:${brandKind}`;
    if (INDUSTRY_QUOTAS[compositeKey]) {
      Object.assign(base, INDUSTRY_QUOTAS[compositeKey]);
      return base;
    }
  }
  
  // Fall back to industry only
  if (industry && INDUSTRY_QUOTAS[industry]) {
    Object.assign(base, INDUSTRY_QUOTAS[industry]);
  }
  
  return base;
}


/**
 * Industry Taxonomy 2.0 - Canonical industry keys and aliases
 * 18 major verticals with subtypes for accurate MSS template routing
 */

export type IndustryKey =
  | "health.diagnostics" 
  | "health.providers" 
  | "pharma.biotech"
  | "finance.bank" 
  | "finance.network" 
  | "finance.fintech"
  | "insurance" 
  | "software.saas" 
  | "software.devtools"
  | "retail" 
  | "marketplace" 
  | "automotive"
  | "travel.hospitality" 
  | "media.news" 
  | "education"
  | "government" 
  | "telecom" 
  | "energy.utilities"
  | "default";

/**
 * Common aliases that map to canonical industry keys
 * Used for quick rule-based detection
 */
export const INDUSTRY_ALIASES: Record<string, IndustryKey> = {
  // Health
  "health": "health.providers",
  "diagnostic": "health.diagnostics",
  "diagnostics": "health.diagnostics",
  "screening": "health.diagnostics",
  "test kit": "health.diagnostics",
  "at-home test": "health.diagnostics",
  "clinic": "health.providers",
  "hospital": "health.providers",
  "medical center": "health.providers",
  "doctor": "health.providers",
  "physician": "health.providers",
  "pharma": "pharma.biotech",
  "pharmaceutical": "pharma.biotech",
  "biotech": "pharma.biotech",
  
  // Finance
  "bank": "finance.bank",
  "banking": "finance.bank",
  "checking": "finance.bank",
  "savings": "finance.bank",
  "credit card": "finance.network",
  "card network": "finance.network",
  "visa": "finance.network",
  "mastercard": "finance.network",
  "amex": "finance.network",
  "payment": "finance.fintech",
  "payments": "finance.fintech",
  "fintech": "finance.fintech",
  "wallet": "finance.fintech",
  "checkout": "finance.fintech",
  
  // Insurance
  "insurance": "insurance",
  "insurer": "insurance",
  "coverage": "insurance",
  "policy": "insurance",
  "premium": "insurance",
  
  // Software
  "saas": "software.saas",
  "subscription": "software.saas",
  "api": "software.devtools",
  "sdk": "software.devtools",
  "developer": "software.devtools",
  "devtools": "software.devtools",
  
  // Retail & Marketplace
  "ecommerce": "retail",
  "online store": "retail",
  "store": "retail",
  "shop": "retail",
  "shopping": "retail",
  "marketplace": "marketplace",
  "listings": "marketplace",
  
  // Automotive
  "cars": "automotive",
  "car": "automotive",
  "auto": "automotive",
  "automotive": "automotive",
  "vehicle": "automotive",
  "dealership": "automotive",
  
  // Travel
  "hotel": "travel.hospitality",
  "travel": "travel.hospitality",
  "booking": "travel.hospitality",
  "hospitality": "travel.hospitality",
  "flight": "travel.hospitality",
  "airline": "travel.hospitality",
  
  // Media
  "news": "media.news",
  "journalism": "media.news",
  "publisher": "media.news",
  "magazine": "media.news",
  
  // Education
  "school": "education",
  "university": "education",
  "education": "education",
  "learning": "education",
  "course": "education",
  
  // Government
  "gov": "government",
  "government": "government",
  "agency": "government",
  "public service": "government",
  
  // Telecom
  "telecommunications": "telecom",
  "telecom": "telecom",
  "mobile": "telecom",
  "carrier": "telecom",
  "broadband": "telecom",
  
  // Energy
  "utility": "energy.utilities",
  "utilities": "energy.utilities",
  "electric": "energy.utilities",
  "electricity": "energy.utilities",
  "gas": "energy.utilities",
  "water": "energy.utilities",
};

/**
 * Get industry key from common terms, with fallback
 */
export function lookupIndustryAlias(term: string): IndustryKey | null {
  const normalized = term.toLowerCase().trim();
  return INDUSTRY_ALIASES[normalized] || null;
}


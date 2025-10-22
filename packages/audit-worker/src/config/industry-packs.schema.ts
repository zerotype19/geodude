/**
 * Industry Taxonomy & Intent Packs
 * 
 * Config-driven approach to industry resolution and intent filtering
 */

export type IndustryKey = 
  | "automotive_oem"
  | "automotive_dealer"
  | "retail"
  | "financial_services"
  | "healthcare_provider"
  | "travel_air"
  | "travel_hotels"
  | "travel_cruise"
  | "saas_b2b"
  | "ecommerce_fashion"
  | "food_restaurant"
  | "real_estate"
  | "education"
  | "professional_services"
  | "media_entertainment"
  | "nonprofit"
  | "government"
  | "manufacturing"
  | "generic_consumer"
  | "unknown";

export interface IntentPack {
  allow_tags: string[];           // Tags we want (e.g., "msrp", "warranty")
  deny_phrases?: string[];        // Raw phrases to block
  inherits?: IndustryKey[];       // Inheritance chain
  description?: string;           // Human-readable description
}

export type IndustryPacks = Record<IndustryKey, IntentPack>;

export interface IndustryRules {
  domains?: Record<string, IndustryKey>;  // Domain → industry mapping
  default_industry?: IndustryKey;         // Fallback when unknown
}

export interface IndustryConfig {
  industry_rules: IndustryRules;
  packs: IndustryPacks;
}

export interface HeuristicVote {
  key: IndustryKey;
  score: number;
  signals: string[];  // Which signals contributed
}


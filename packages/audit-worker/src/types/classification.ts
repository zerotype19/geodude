/**
 * Universal Classification v1.0 - Type Definitions
 * Phase 1: Rules-only weighted classifier with confidence scoring
 */

export type ScoredString = { 
  value: string | null; 
  confidence: number | null;
};

export type SiteMode =
  | "brand_marketing" 
  | "brand_store" 
  | "retail_marketplace"
  | "docs_site" 
  | "support_site" 
  | "careers_site" 
  | "ir_site";

export type BrandKind = "manufacturer" | "retailer" | "marketplace" | null;

export type Purpose = "sell" | "inform" | "convert" | "assist" | "investor";

export type RichClassification = {
  site_type: ScoredString;          // e.g., { value: "ecommerce", confidence: 0.86 }
  industry: ScoredString;           // e.g., { value: "retail", confidence: 0.81 }
  site_mode: SiteMode | null;       // derived from URL/subdomain/path
  brand_kind: BrandKind;            // manufacturer vs retailer vs marketplace
  purpose: Purpose;                 // sell, inform, convert, assist, investor
  lang: string | null;              // ISO (e.g., "en")
  region: string | null;            // ISO (e.g., "US")
  jsonld_types: string[];           // normalized list of detected @type
  nav_terms: string[];              // extracted nav taxonomy (lowercased)
  category_terms: string[];         // 3–5 high-signal terms for prompts
  render_visibility_pct?: number;   // A11 feed-through if available
  zero_shot?: {                     // Phase 2
    site_type?: ScoredString;
    industry?: ScoredString;
    model?: string;                 // "@cf/meta/llama-3.1-8b-instruct"
    cached?: boolean;
  } | null;
  signals: {                        // transparent scoring breakdown
    url: number; 
    schema: number; 
    nav: number; 
    commerce: number; 
    media: number;
    software?: number; 
    finance?: number; 
    insurance?: number; 
    travel?: number; 
    automotive?: number;
  };
  notes?: string[];                 // human-readable hints
};

/**
 * Legacy compatibility - extract string site_type from RichClassification
 */
export function getLegacySiteType(classification: RichClassification): string {
  return classification.site_type.value || 'corporate';
}

/**
 * Legacy compatibility - extract string industry from RichClassification
 */
export function getLegacyIndustry(classification: RichClassification): string | null {
  return classification.industry.value;
}


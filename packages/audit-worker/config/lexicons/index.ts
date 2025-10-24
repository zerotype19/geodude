/**
 * Lexicons Index
 * Central export for all industry-specific terminology and normalization rules
 */

import { SAAS_LEXICON } from './saas';
import { FINANCE_LEXICON } from './finance';
import { HEALTHCARE_LEXICON } from './healthcare';
import { RETAIL_LEXICON } from './retail';
import { TRAVEL_LEXICON } from './travel';

export const LEXICONS = {
  saas_b2b: SAAS_LEXICON,
  financial_services: FINANCE_LEXICON,
  healthcare_provider: HEALTHCARE_LEXICON,
  retail: RETAIL_LEXICON,
  travel_air: TRAVEL_LEXICON,
  travel_hotels: TRAVEL_LEXICON,
  travel_cruise: TRAVEL_LEXICON,
  generic_consumer: RETAIL_LEXICON, // Default fallback
};

/**
 * Get lexicon for a specific industry
 */
export function getLexicon(industry: string) {
  return LEXICONS[industry as keyof typeof LEXICONS] || RETAIL_LEXICON;
}

export { SAAS_LEXICON, FINANCE_LEXICON, HEALTHCARE_LEXICON, RETAIL_LEXICON, TRAVEL_LEXICON };


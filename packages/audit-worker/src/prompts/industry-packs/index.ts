/**
 * Industry Packs Index
 * Central export for all industry-specific template collections
 */

import { SAAS_TEMPLATES, SAAS_NONBRANDED } from './saas';
import { HEALTHCARE_TEMPLATES, HEALTHCARE_NONBRANDED } from './healthcare';
import { FINANCE_TEMPLATES, FINANCE_NONBRANDED } from './finance';
import { TRAVEL_TEMPLATES, TRAVEL_NONBRANDED } from './travel';
import { RETAIL_TEMPLATES, RETAIL_NONBRANDED } from './retail';
import { EDUCATION_TEMPLATES, EDUCATION_NONBRANDED } from './education';

export const INDUSTRY_PACKS = {
  saas_b2b: SAAS_TEMPLATES,
  healthcare_provider: HEALTHCARE_TEMPLATES,
  financial_services: FINANCE_TEMPLATES,
  travel_air: TRAVEL_TEMPLATES,
  travel_hotels: TRAVEL_TEMPLATES,
  travel_cruise: TRAVEL_TEMPLATES,
  retail: RETAIL_TEMPLATES,
  education: EDUCATION_TEMPLATES,
  // Add fallback for unmapped industries
  generic_consumer: RETAIL_TEMPLATES, // Use retail as default
};

export const INDUSTRY_NONBRANDED = {
  saas_b2b: SAAS_NONBRANDED,
  healthcare_provider: HEALTHCARE_NONBRANDED,
  financial_services: FINANCE_NONBRANDED,
  travel_air: TRAVEL_NONBRANDED,
  travel_hotels: TRAVEL_NONBRANDED,
  travel_cruise: TRAVEL_NONBRANDED,
  retail: RETAIL_NONBRANDED,
  education: EDUCATION_NONBRANDED,
  generic_consumer: RETAIL_NONBRANDED,
};

/**
 * Get templates for a specific industry
 */
export function getIndustryPack(industry: string): Record<string, string[]> {
  return INDUSTRY_PACKS[industry as keyof typeof INDUSTRY_PACKS] || RETAIL_TEMPLATES;
}

/**
 * Get non-branded templates for a specific industry
 */
export function getNonBrandedPack(industry: string): Record<string, string[]> {
  return INDUSTRY_NONBRANDED[industry as keyof typeof INDUSTRY_NONBRANDED] || RETAIL_NONBRANDED;
}


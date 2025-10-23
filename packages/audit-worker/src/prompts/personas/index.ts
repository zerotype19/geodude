/**
 * Persona Library Index
 * 
 * Central export for all persona definitions
 */

import { SMALL_BUSINESS_OWNER } from './small_business_owner';
import { ENTERPRISE_BUYER } from './enterprise_buyer';
import { CONSUMER_USER } from './consumer_user';
import { DEVELOPER } from './developer';

export const PERSONAS = {
  small_business_owner: SMALL_BUSINESS_OWNER,
  enterprise_buyer: ENTERPRISE_BUYER,
  consumer_user: CONSUMER_USER,
  developer: DEVELOPER
};

export type PersonaName = keyof typeof PERSONAS;

/**
 * Get persona by industry (intelligent mapping)
 */
export function getPersonaByIndustry(industry: string, siteType?: string): PersonaName {
  // SaaS/B2B → primarily enterprise and small business
  if (industry === 'saas_b2b') {
    return siteType === 'enterprise' ? 'enterprise_buyer' : 'small_business_owner';
  }
  
  // Developer-focused
  if (industry === 'saas_b2b' && siteType === 'developer_tools') {
    return 'developer';
  }
  
  // Consumer-focused industries
  if (['retail', 'food_restaurant', 'media_entertainment', 'travel_hotels', 'travel_air', 'travel_cruise'].includes(industry)) {
    return 'consumer_user';
  }
  
  // Healthcare, Finance → consumer but with enterprise potential
  if (['healthcare_provider', 'financial_services'].includes(industry)) {
    return 'consumer_user'; // Default to consumer, can be overridden
  }
  
  // Education → mix of consumer and enterprise
  if (industry === 'education') {
    return 'consumer_user';
  }
  
  // Default to consumer for generic/unknown
  return 'consumer_user';
}

/**
 * Get query templates from persona
 */
export function getPersonaQueries(personaName: PersonaName, count: number = 5): string[] {
  const persona = PERSONAS[personaName];
  return persona.typical_queries.slice(0, count);
}


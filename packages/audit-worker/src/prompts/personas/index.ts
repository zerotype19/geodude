/**
 * Persona Library
 * Maps industries to appropriate user personas for query generation
 */

import { SMALL_BUSINESS_OWNER } from './small_business_owner';
import { ENTERPRISE_BUYER } from './enterprise_buyer';
import { CONSUMER_USER } from './consumer_user';
import { DEVELOPER } from './developer';

export interface Persona {
  name: string;
  concerns: string[];
  language_patterns: string[];
  question_starters: string[];
  tone: string;
  typical_queries: string[];
}

export const PERSONAS = {
  small_business_owner: SMALL_BUSINESS_OWNER,
  enterprise_buyer: ENTERPRISE_BUYER,
  consumer_user: CONSUMER_USER,
  developer: DEVELOPER
};

/**
 * Get the most appropriate persona for a given industry
 */
export function getPersonaByIndustry(industry: string): Persona {
  const industryPersonaMap: Record<string, Persona> = {
    // B2B/SaaS → mix of small business and enterprise
    saas_b2b: SMALL_BUSINESS_OWNER,
    
    // Healthcare → consumer user (patient/caregiver)
    pharmaceutical: CONSUMER_USER,
    healthcare_provider: CONSUMER_USER,
    health_insurance: CONSUMER_USER,
    medical_devices: ENTERPRISE_BUYER, // Hospitals/clinics buying
    biotech: ENTERPRISE_BUYER,
    telemedicine: CONSUMER_USER,
    pharmacy: CONSUMER_USER,
    health_services: CONSUMER_USER,
    
    // Financial → consumer for retail, enterprise for B2B
    financial_services: CONSUMER_USER,
    
    // Retail/Ecommerce → consumer
    retail: CONSUMER_USER,
    ecommerce: CONSUMER_USER,
    
    // Travel → consumer
    travel_air: CONSUMER_USER,
    travel_hotels: CONSUMER_USER,
    travel_cruise: CONSUMER_USER,
    travel_booking: CONSUMER_USER,
    vacation_rentals: CONSUMER_USER,
    
    // Automotive → consumer
    automotive_oem: CONSUMER_USER,
    
    // Education → mix of consumer and enterprise
    university: CONSUMER_USER,
    education: CONSUMER_USER,
    
    // Restaurants → consumer
    restaurants: CONSUMER_USER,
    food_restaurant: CONSUMER_USER,
    
    // Media → consumer
    streaming: CONSUMER_USER,
    social_media: CONSUMER_USER,
    media_entertainment: CONSUMER_USER,
    
    // Telecom → consumer
    telecom: CONSUMER_USER,
    
    // Professional Services → enterprise
    consulting: ENTERPRISE_BUYER,
    
    // Real Estate → consumer
    real_estate: CONSUMER_USER,
    
    // Generic fallback
    generic_consumer: CONSUMER_USER
  };
  
  return industryPersonaMap[industry] || CONSUMER_USER;
}

/**
 * Get multiple personas for mixed-audience industries
 */
export function getPersonasForIndustry(industry: string): Persona[] {
  const multiPersonaIndustries: Record<string, Persona[]> = {
    saas_b2b: [SMALL_BUSINESS_OWNER, ENTERPRISE_BUYER, DEVELOPER],
    financial_services: [CONSUMER_USER, SMALL_BUSINESS_OWNER],
    medical_devices: [ENTERPRISE_BUYER, DEVELOPER],
    education: [CONSUMER_USER, ENTERPRISE_BUYER]
  };
  
  return multiPersonaIndustries[industry] || [getPersonaByIndustry(industry)];
}

/**
 * Sample question starters from a persona
 */
export function samplePersonaStarters(persona: Persona, count: number = 3): string[] {
  const starters = [...persona.question_starters];
  // Shuffle and take N
  for (let i = starters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [starters[i], starters[j]] = [starters[j], starters[i]];
  }
  return starters.slice(0, count);
}

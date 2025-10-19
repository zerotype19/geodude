/**
 * Minimal Safe Set (MSS) - Fallback when V4 fails quality gates
 * 
 * Provides industry-specific, guaranteed brand-leak-free queries
 * when V4 LLM generation fails (e.g., due to brand leakage, pluralization issues)
 */

import { brandLeak, type BrandLeakCtx } from './brandLeak';

export type MSSInput = {
  brand: string;
  aliases: string[];
  industry: string | null;
  category_terms: string[];
  persona: "consumer" | "merchant" | "developer" | "investor";
};

export type MSSResult = {
  branded: string[];
  nonBranded: string[];
  source: 'mss';
  realism_score: number;
  metadata?: {
    industry: string;
    industry_source: string;
  };
};

/**
 * Generic non-branded queries by industry
 * These are carefully crafted to NEVER include brand names, plurals, or variants
 */
const GENERIC_NONBRANDED: Record<string, string[]> = {
  finance: [
    "best credit cards for travel rewards",
    "how to dispute a fraudulent charge",
    "do virtual card numbers reduce checkout risk",
    "credit card annual fee vs cashback: which is worth it",
    "are foreign transaction fees avoidable with premium cards",
    "which card networks are most widely accepted online",
    "what credit score is typical for mid-tier rewards cards",
    "how cardholder protection works for online purchases",
    "payment processing fees comparison for small business",
    "how to choose between debit and credit for online purchases",
    "what security features prevent online payment fraud",
    "cashback vs points: which rewards program is better"
  ],
  
  software: [
    "how to evaluate payment processors for ecommerce",
    "what is the difference between a gateway and processor",
    "best apis for online payments integration",
    "how to reduce chargebacks in online stores",
    "pci compliance basics for small teams",
    "when to use hosted checkout vs custom integration",
    "how to handle webhooks securely",
    "fraud signals to watch at checkout",
    "recurring billing setup for subscription services",
    "how to test payment flows in development",
    "webhook retry strategies for failed deliveries",
    "what payment methods should an online store support"
  ],
  
  retail: [
    "best return policies among online stores",
    "how to choose the right size when ordering online",
    "express shipping vs standard: when is it worth it",
    "what payment options do most stores accept",
    "how curbside pickup works at major retailers",
    "buy now pay later pros and cons",
    "how to track a lost package",
    "is free returns really free",
    "online shopping security tips for consumers",
    "how to find discount codes before checking out",
    "best time of year for online sales",
    "loyalty programs worth joining at retailers"
  ],
  
  health: [
    "how to choose a colon cancer screening test",
    "non-invasive screening vs colonoscopy comparison",
    "how accurate are stool dna tests",
    "when to start routine colon cancer screening",
    "what happens if a screening test is positive",
    "at-home medical test privacy and data use",
    "insurance coverage for preventive screenings",
    "how to prepare for at-home screening kits",
    "colon cancer early detection methods",
    "screening test sensitivity and specificity explained",
    "medicare coverage for cancer screening",
    "how often should adults get screened for colon cancer"
  ],
  
  insurance: [
    "how to compare auto insurance quotes",
    "what factors affect car insurance premiums",
    "comprehensive vs collision coverage explained",
    "is roadside assistance worth adding to insurance",
    "how to file an insurance claim after an accident",
    "what information do insurers need for a quote",
    "bundling home and auto insurance pros and cons",
    "how insurance companies calculate risk",
    "what is an insurance deductible and how does it work",
    "liability coverage limits: how much is enough",
    "when to switch insurance providers",
    "discount programs that lower insurance costs"
  ],
  
  travel: [
    "how to find cheap flights for last-minute trips",
    "what travel insurance covers and doesn't cover",
    "best credit cards for travel rewards and lounge access",
    "how to avoid airline change fees",
    "when is the best time to book international flights",
    "travel booking sites comparison: which offers best deals",
    "how to earn and redeem frequent flyer miles",
    "what to do if your flight is cancelled or delayed",
    "travel hacking tips for free hotel stays",
    "loyalty programs worth joining for frequent travelers",
    "how to pack light for international trips",
    "what documents are required for international travel"
  ],
  
  automotive: [
    "how to choose between new and used cars",
    "what to look for in a test drive",
    "electric vs hybrid vs gas: cost comparison",
    "how to negotiate car prices at dealerships",
    "what affects car trade-in values",
    "best time of year to buy a car",
    "how to check a vehicle history report",
    "car loan vs lease: which makes more sense",
    "what maintenance costs to expect for different makes",
    "how to calculate total cost of ownership for a car",
    "safety ratings and crash test scores explained",
    "fuel efficiency ratings: what they actually mean"
  ],
  
  media: [
    "how to choose a streaming service for your needs",
    "ad-free vs ad-supported: which is better value",
    "bundling streaming services: is it worth it",
    "how to share accounts legally with family",
    "what content is exclusive to which platforms",
    "streaming quality settings and data usage",
    "how to cancel subscription services easily",
    "offline viewing options for travel",
    "parental controls on streaming platforms",
    "which devices work with which services",
    "streaming device comparison: roku vs fire tv",
    "how to find hidden content on streaming apps"
  ],
  
  default: [
    "how to compare providers in this category",
    "what features matter most for new buyers",
    "typical cost ranges and hidden fees",
    "privacy and security considerations",
    "what support to expect post-purchase",
    "integration and setup effort overview",
    "how to evaluate long-term reliability",
    "what to check in reviews and references",
    "common pitfalls when choosing a provider",
    "how to get the best deal or discount",
    "contract terms to watch out for",
    "when is it worth upgrading to premium tiers"
  ]
};

/**
 * Detect health industry from domain/category context
 */
function detectHealthIndustry(domain: string, categoryTerms: string[], brand: string): boolean {
  const allText = `${domain} ${categoryTerms.join(' ')} ${brand}`.toLowerCase();
  return /(health|medical|diagnostic|wellness|care|clinic|lab|screening|test|patient|doctor|hospital)/i.test(allText);
}

/**
 * Detect entertainment/ticketing industry
 */
function detectEntertainmentIndustry(domain: string, categoryTerms: string[], brand: string): boolean {
  const allText = `${domain} ${categoryTerms.join(' ')} ${brand}`.toLowerCase();
  return /(theater|theatre|entertainment|tickets|shows|broadway|events|venues|concert|festival)/i.test(allText);
}

/**
 * Smart industry detection with fallback heuristics
 */
function inferIndustry(input: MSSInput): string {
  // If industry is already set and valid, use it
  if (input.industry && input.industry !== 'default' && GENERIC_NONBRANDED[input.industry]) {
    return input.industry;
  }
  
  const domain = input.brand.toLowerCase();
  const cats = input.category_terms.map(c => c.toLowerCase());
  const brand = input.brand.toLowerCase();
  
  // Health detection
  if (detectHealthIndustry(domain, cats, brand)) {
    console.log(`[MSS] Detected health industry for ${input.brand}`);
    return 'health';
  }
  
  // Entertainment/ticketing detection
  if (detectEntertainmentIndustry(domain, cats, brand)) {
    console.log(`[MSS] Detected media/entertainment industry for ${input.brand}`);
    return 'media';
  }
  
  // Finance detection
  if (/(bank|credit|card|payment|finance|loan|invest|trading|broker)/i.test(domain + ' ' + cats.join(' '))) {
    console.log(`[MSS] Detected finance industry for ${input.brand}`);
    return 'finance';
  }
  
  // Insurance detection
  if (/(insurance|insurer|coverage|policy|premium|claim)/i.test(domain + ' ' + cats.join(' '))) {
    console.log(`[MSS] Detected insurance industry for ${input.brand}`);
    return 'insurance';
  }
  
  // Retail detection
  if (/(shop|store|retail|buy|purchase|ecommerce)/i.test(domain + ' ' + cats.join(' '))) {
    console.log(`[MSS] Detected retail industry for ${input.brand}`);
    return 'retail';
  }
  
  // Software/SaaS detection
  if (/(software|saas|platform|api|developer|cloud|service)/i.test(domain + ' ' + cats.join(' '))) {
    console.log(`[MSS] Detected software industry for ${input.brand}`);
    return 'software';
  }
  
  // Automotive detection
  if (/(car|auto|vehicle|automotive|dealer|lease)/i.test(domain + ' ' + cats.join(' '))) {
    console.log(`[MSS] Detected automotive industry for ${input.brand}`);
    return 'automotive';
  }
  
  // Travel detection
  if (/(travel|flight|hotel|cruise|vacation|booking|airline)/i.test(domain + ' ' + cats.join(' '))) {
    console.log(`[MSS] Detected travel industry for ${input.brand}`);
    return 'travel';
  }
  
  console.log(`[MSS] No specific industry detected for ${input.brand}, using default`);
  return 'default';
}

/**
 * Build a minimal safe set of queries guaranteed not to leak brand
 */
export function buildMinimalSafeSet(input: MSSInput): MSSResult {
  // Smart industry detection with fallback heuristics
  const detectedIndustry = inferIndustry(input);
  const baseNonBranded = GENERIC_NONBRANDED[detectedIndustry];
  
  // Log industry assignment for telemetry
  console.log(JSON.stringify({
    type: 'MSS_INDUSTRY_ASSIGNED',
    domain: input.brand,
    industry: detectedIndustry,
    source: input.industry || 'inferred'
  }));
  
  // Double-check: filter out any accidental brand leaks
  // (should never happen with our templates, but safety first)
  const ctx: BrandLeakCtx = { 
    brand: input.brand, 
    aliases: input.aliases 
  };
  const nonBranded = baseNonBranded
    .filter(q => !brandLeak(q, ctx))
    .slice(0, 18); // Target: 18 non-branded queries
  
  // Very small branded set (always safe by definition)
  const primaryAlias = input.aliases[0] || input.brand;
  const branded = [
    `what is ${input.brand} and how does it work`,
    `${input.brand} cost and pricing`,
    `${primaryAlias} reviews and ratings`,
    `how to sign up for ${input.brand}`,
    `${input.brand} vs competitors`,
    `is ${input.brand} worth it`,
    `${primaryAlias} customer support`,
    `${input.brand} features and benefits`,
    `${primaryAlias} pros and cons`,
    `how to cancel ${input.brand}`
  ].slice(0, 10); // Target: 10 branded queries
  
  // Confidence scaling: prefer industry-specific templates
  // If we fell back to generic, reduce realism score slightly
  const genericFallbackPenalty = detectedIndustry === 'default' ? 0.1 : 0;
  const realism_score = Math.max(0.6, 0.72 - genericFallbackPenalty);
  
  return {
    branded,
    nonBranded,
    source: 'mss',
    realism_score,
    metadata: {
      industry: detectedIndustry,
      industry_source: input.industry || 'inferred'
    }
  };
}


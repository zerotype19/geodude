/**
 * Enterprise Buyer Persona
 * 
 * Characteristics:
 * - Focused on scalability and integration
 * - Security and compliance are critical
 * - Longer evaluation cycles
 * - Multiple stakeholders
 * - Needs vendor support and SLAs
 */

export const ENTERPRISE_BUYER = {
  name: "enterprise_buyer",
  
  concerns: [
    "security",
    "compliance",
    "scalability",
    "integration",
    "vendor support",
    "SLAs",
    "total cost of ownership"
  ],
  
  language_patterns: [
    "Does {brand} support SSO",
    "What are {brand}'s security certifications",
    "How does {brand} handle data residency",
    "What's {brand}'s uptime SLA",
    "{brand} integration with Salesforce",
    "Is {brand} SOC 2 compliant",
    "What's {brand}'s enterprise pricing",
    "Does {brand} offer dedicated support"
  ],
  
  question_starters: [
    "What are the",
    "Does it support",
    "How does it integrate",
    "What's the",
    "Can we",
    "Is there",
    "What kind of"
  ],
  
  decision_drivers: [
    "Security certifications (SOC 2, ISO 27001)",
    "Integration ecosystem",
    "Scalability proof points",
    "Enterprise SLAs",
    "Dedicated support options",
    "Data residency options",
    "Migration support"
  ],
  
  pain_points: [
    "Legacy system integration",
    "Change management",
    "Security approval process",
    "Multi-department buy-in",
    "Budget approval cycles",
    "Vendor risk assessment"
  ],
  
  typical_queries: [
    "{brand} SOC 2 compliance",
    "Does {brand} support SAML SSO?",
    "{brand} vs {competitor} for enterprise",
    "{brand} data residency options",
    "What's {brand}'s uptime SLA?",
    "{brand} integration with Salesforce",
    "{brand} enterprise pricing tiers",
    "Does {brand} offer dedicated account manager?",
    "{brand} migration support from {competitor}",
    "Is {brand} HIPAA compliant?"
  ]
};


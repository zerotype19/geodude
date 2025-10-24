/**
 * SaaS B2B Lexicon
 * Industry-appropriate terminology and normalization rules
 */

export const SAAS_LEXICON = {
  pricing_models: [
    "per seat",
    "usage-based",
    "tiered",
    "freemium",
    "enterprise",
    "per user",
    "consumption-based"
  ],
  
  common_features: [
    "SSO",
    "SAML",
    "API",
    "webhooks",
    "integrations",
    "white-label",
    "custom domains",
    "role-based access",
    "audit logs",
    "REST API",
    "GraphQL"
  ],
  
  buyer_questions: [
    "SOC 2 compliant",
    "SOC 2 Type II",
    "ISO 27001",
    "uptime SLA",
    "99.9% uptime",
    "data residency",
    "GDPR compliant",
    "CCPA compliant",
    "penetration testing",
    "encryption at rest"
  ],
  
  implementation_terms: [
    "onboarding",
    "migration",
    "API documentation",
    "SDK",
    "sandbox environment",
    "staging environment",
    "deployment",
    "rollout"
  ],
  
  support_tiers: [
    "community support",
    "email support",
    "live chat",
    "phone support",
    "dedicated account manager",
    "CSM",
    "customer success manager",
    "premium support"
  ],
  
  avoid_phrases: {
    "monthly subscription": "per month",
    "yearly plan": "annual",
    "annual plan": "per year",
    "subscription model": "pricing",
    "software platform": "platform",
    "cloud-based solution": "cloud platform"
  },
  
  lexicon_hint: "Use terms like SSO, API, SLA, SOC 2, uptime, per seat, and integration. Avoid overly generic phrases."
};


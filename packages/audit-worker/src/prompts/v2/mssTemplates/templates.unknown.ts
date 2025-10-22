/**
 * MSS Template for Unknown / Fallback
 * Purpose: Universal prompts when industry is not recognized
 * Works for: any brand, product, service, or organization
 */

export const unknown = {
  version: "v1.0",
  branded: [
    "what does {{brand}} do",
    "{{brand}} products and services",
    "{{brand}} pricing or plans",
    "reviews of {{brand}}",
    "how to contact {{brand}} customer support",
    "{{brand}} locations or service areas",
    "{{brand}} login or account help",
    "{{brand}} return, refund, or cancellation policy",
    "careers at {{brand}}",
    "{{brand}} news or press releases"
  ],
  nonBranded: [
    "what does this company do",
    "how to contact customer service",
    "pricing and plan comparisons",
    "best alternatives to this product or service",
    "company reviews and ratings",
    "where to find official documentation or help center",
    "how to create or manage an account",
    "refund and cancellation policies explained",
    "is this website trustworthy and secure",
    "jobs and careers at this company",
    "store or office locations near me",
    "sustainability, privacy, and accessibility policies"
  ]
};


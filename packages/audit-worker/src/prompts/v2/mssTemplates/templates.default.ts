/**
 * Default MSS Template for unclassified industries
 * Generic, safe queries that work for any domain
 */

export const defaultTemplate = {
  version: "v1.0",
  branded: [
    "what is {{brand}} and how does it work",
    "{{brand}} cost and pricing",
    "{{brand}} reviews and ratings",
    "how to sign up for {{brand}}",
    "{{brand}} vs competitors",
    "is {{brand}} worth it",
    "{{brand}} customer support",
    "{{brand}} features and benefits",
    "{{brand}} pros and cons",
    "how to cancel {{brand}}"
  ],
  nonBranded: [
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


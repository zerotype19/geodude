/**
 * Enterprise Buyer Persona
 * Focused on scalability, security, compliance, and vendor stability
 */

export const ENTERPRISE_BUYER = {
  name: "enterprise_buyer",
  concerns: ["security", "compliance", "scalability", "vendor stability", "integration", "support SLA"],
  language_patterns: [
    "Does it meet compliance requirements",
    "How does it scale",
    "What's the enterprise pricing",
    "Integration with existing systems",
    "What's included in enterprise support",
    "SOC 2 compliance"
  ],
  question_starters: [
    "How does [product] handle",
    "What enterprise features does",
    "Does [product] support",
    "What's the difference between Business and Enterprise",
    "How secure is",
    "Can [product] integrate with"
  ],
  tone: "formal and risk-averse",
  typical_queries: [
    "[product] enterprise pricing and features",
    "[product] security compliance (SOC 2, HIPAA)",
    "[product] vs [competitor] for large organizations",
    "[product] API and integration capabilities"
  ]
};

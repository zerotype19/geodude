/**
 * Persona Inference
 * Determines audience persona (consumer vs merchant) for better prompt targeting
 */

export type Persona = "consumer" | "merchant" | "investor" | "developer";

export function inferPersona(
  siteMode?: string | null,
  path?: string | null,
  purpose?: string | null,
  override?: Persona | null
): Persona {
  // Explicit override (for testing/debugging)
  if (override) return override;
  const p = (path || "").toLowerCase();
  const mode = (siteMode || "").toLowerCase();
  
  // Merchant/business paths
  if (
    p.includes("/accept") ||
    p.includes("/merchant") ||
    p.includes("/business") ||
    p.includes("/sell") ||
    p.includes("/partner") ||
    p.includes("/payments") ||
    mode.includes("merchant") ||
    mode.includes("b2b")
  ) {
    return "merchant";
  }
  
  // Developer/API paths
  if (
    p.includes("/api") ||
    p.includes("/docs") ||
    p.includes("/developers") ||
    mode.includes("api") ||
    mode.includes("developer")
  ) {
    return "developer";
  }
  
  // Investor relations
  if (
    p.includes("/investor") ||
    p.includes("/ir") ||
    purpose === "investor"
  ) {
    return "investor";
  }
  
  // Default: consumer
  return "consumer";
}

export function getPersonaHint(persona: Persona): string {
  switch (persona) {
    case "merchant":
      return "Audience: merchants/businesses accepting payments. Phrase questions from a business owner or payment processor perspective (costs, integration, chargebacks, acceptance rates).";
    case "developer":
      return "Audience: developers integrating APIs. Phrase questions about SDKs, documentation, authentication, API limits, webhooks.";
    case "investor":
      return "Audience: investors/analysts. Phrase questions about financials, market position, growth, competitive advantages, risks.";
    case "consumer":
    default:
      return "Audience: consumers/end-users. Phrase questions from a typical user perspective (safety, cost, features, support, eligibility).";
  }
}


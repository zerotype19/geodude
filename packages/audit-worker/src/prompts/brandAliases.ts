/**
 * Brand Aliasing - Universal Heuristics + Seeds
 * Generates common nicknames and acronyms for brands
 */

export function buildBrandAliases(domain: string, brand?: string | null): string[] {
  // Seed map for common brands; grows over time
  const SEEDS: Record<string, string[]> = {
    "american express": ["Amex"],
    "bank of america": ["BofA"],
    "jpmorgan chase": ["Chase", "Chase Bank"],
    "chase": ["Chase Bank"],
    "the new york times": ["NYT"],
    "paypal": ["PayPal", "PP"],
    "mastercard": ["Mastercard", "MC"],
    "visa": ["Visa"],
    "discover": ["Discover"],
    "stripe": ["Stripe"],
    "citibank": ["Citi"],
    "wells fargo": ["Wells"],
    "capital one": ["CapitalOne"],
    "lexus": ["Lexus"]
  };

  const canonical = (brand ?? domain.replace(/^www\./, "")).toLowerCase().trim();
  const bare = canonical.replace(/\.(com|net|org|ai|io|co|uk|jp|de|fr|es)$/i, "");

  // Heuristic acronym (e.g., American Express → AE, keep only famous ones later)
  const words = bare.split(/[^a-z0-9]+/).filter(Boolean);
  const acronym = words.length > 1 ? words.map(w => w[0]).join("").toUpperCase() : null;

  const aliasSeeds = Object.entries(SEEDS).find(([k]) => canonical.includes(k))?.[1] ?? [];
  const uniq = new Set<string>([brand || "", bare, ...(aliasSeeds as string[])]);
  if (acronym && acronym.length >= 2 && acronym.length <= 5) uniq.add(acronym);

  // Normalize
  return [...uniq].filter(Boolean);
}


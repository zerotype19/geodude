/**
 * Robust brand leak detector for V4 prompt quality gates
 * 
 * Handles brands that are also common nouns/verbs:
 * - Cologuard → "cologuards", "cologuard's"
 * - Broadway → "broadways", "broadway-style"
 * - Target → "targets", "target's"
 * - Square → "squares", "square-shaped"
 * - Cruise → "cruises", "cruise-line"
 */

export type BrandLeakCtx = { 
  brand: string; 
  aliases: string[] 
};

/**
 * Generate all variants of a brand name:
 * - Base form
 * - Pluralized (s, es)
 * - Possessive ('s)
 * - Hyphenated/concatenated
 * - De-punctuated
 */
function variants(s: string): string[] {
  const base = s.toLowerCase().trim();
  
  // Remove punctuation variants
  const simple = [
    base, 
    base.replace(/[^\p{L}\p{N}]+/gu, " ").trim()
  ];
  
  // Space/hyphen/concat variants
  const dePunct = new Set<string>();
  for (const v of simple) {
    dePunct.add(v);
    dePunct.add(v.replace(/\s+/g, ""));      // "cologuard"
    dePunct.add(v.replace(/\s+/g, "-"));     // "colo-guard"
  }
  
  // Pluralization and possessive forms
  const plural = new Set<string>();
  for (const v of dePunct) {
    plural.add(v);
    plural.add(v + "s");      // "cologuards"
    plural.add(v + "es");     // "cologuardes" (rare but possible)
    plural.add(v + "'s");     // "cologuard's"
    plural.add(v + "s'");     // "cologuards'"
  }
  
  return [...plural].filter(Boolean);
}

/**
 * Build a comprehensive regex to detect brand leaks
 * Matches whole tokens or hyphenated/concatenated forms (case-insensitive)
 */
export function buildLeakRegex(ctx: BrandLeakCtx): RegExp {
  const all = new Set<string>();
  
  // Include brand + all aliases
  [ctx.brand, ...ctx.aliases]
    .filter(Boolean)
    .forEach(b => {
      variants(b).forEach(v => all.add(v));
    });
  
  // Build pattern: match whole words or hyphenated/concatenated forms
  const pat = Array.from(all)
    .filter(v => v.length >= 3) // Skip very short variants
    .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) // Escape regex chars
    .map(v => `(?:\\b|_|-)?${v}(?:\\b|_|-)?`)           // Word boundaries
    .join("|");
  
  return new RegExp(pat, "i");
}

/**
 * Check if a query contains the brand or any of its variants
 */
export function brandLeak(q: string, ctx: BrandLeakCtx): boolean {
  const rx = buildLeakRegex(ctx);
  return rx.test(q);
}

/**
 * Filter a list of queries to remove brand leaks
 */
export function filterBrandLeaks(queries: string[], ctx: BrandLeakCtx): string[] {
  return queries.filter(q => !brandLeak(q, ctx));
}


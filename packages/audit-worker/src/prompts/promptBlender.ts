export type RulePrompts = { branded: string[]; nonBranded: string[] };
export type BlendedPrompts = {
  source: "rules" | "ai" | "blended";
  branded: string[];
  nonBranded: string[];
  realism_score: number; // 0..1 simple heuristic
};

function norm(s: string) { return s.toLowerCase().replace(/\s+/g," ").trim(); }

export function aliasNormalize(q: string, aliases: string[]): string {
  let out = q.toLowerCase();
  const primary = (aliases[0] || "").toLowerCase();
  for (const a of aliases) {
    const rx = new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
    out = out.replace(rx, primary || "brand");
  }
  return out;
}

function jaccard(a: string, b: string, aliases: string[] = []) {
  const A = new Set(aliasNormalize(a, aliases).split(" ")); 
  const B = new Set(aliasNormalize(b, aliases).split(" "));
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
}

function dedupeFuzzy(list: string[], max = 30, thresh = 0.8, aliases: string[] = []): string[] {
  const out: string[] = [];
  for (const q of list) {
    if (!q) continue;
    const isDup = out.some(x => jaccard(x, q, aliases) >= thresh);
    if (!isDup) out.push(q);
    if (out.length >= max) break;
  }
  return out;
}

export function blendPrompts(
  ai: RulePrompts, 
  rules: RulePrompts, 
  realismHint = 0.75, 
  aliases: string[] = []
): BlendedPrompts {
  // Adaptive caps based on realism score
  const aiBrandedCap = realismHint > 0.78 ? 10 : 8;
  const aiGenericCap = realismHint > 0.78 ? 14 : 12;

  const branded = dedupeFuzzy([
    ...ai.branded.slice(0, aiBrandedCap),
    ...rules.branded.slice(0, 6)
  ], 12, 0.8, aliases);

  const nonBranded = dedupeFuzzy([
    ...ai.nonBranded.slice(0, aiGenericCap),
    ...rules.nonBranded.slice(0, 8)
  ], 16, 0.8, aliases);

  // Realism scoring: favor AI presence + verb variety
  const verbs = ["how","what","which","is","does","can","why","when","where","should","vs"];
  const pool = [...branded, ...nonBranded].map(s => s.toLowerCase());
  const variety = new Set(pool.flatMap(q => q.split(" ").filter(w => verbs.includes(w)))).size / verbs.length;
  const realism_score = Math.min(1, 0.6 + variety * 0.4);

  return {
    source: (ai.branded.length + ai.nonBranded.length) ? "blended" : "rules",
    branded, 
    nonBranded,
    realism_score
  };
}


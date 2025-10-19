/**
 * Grammar + morphology normalizer for natural query generation
 */

export function humanPlural(w: string): string {
  if (/s$/i.test(w)) return w;
  if (/y$/i.test(w)) return w.slice(0, -1) + 'ies';
  return w + 's';
}

export function toSingular(w: string): string {
  if (/ies$/i.test(w)) return w.slice(0, -3) + 'y';
  if (/sses$/i.test(w)) return w;
  if (/s$/i.test(w)) return w.slice(0, -1);
  return w;
}

export function isPlural(w: string): boolean {
  return /s$/i.test(w) && !/ss$/i.test(w);
}

export function doVerb(w: string): string {
  return isPlural(w) ? 'do' : 'does';
}

export function beVerb(w: string): string {
  return isPlural(w) ? 'are' : 'is';
}

export function sanitizeBrandInQuery(q: string, brand: string): string {
  const lower = brand.toLowerCase();
  return q
    .replace(new RegExp(`\\b${lower}s\\b`, 'gi'), brand) // "paypals" → "PayPal"
    .replace(/\s+/g, ' ')
    .trim();
}

export function dedupeKeepOrder<T>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = String(it).toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
}


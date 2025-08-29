import { aliasToSlug } from './aliases';

export function detectAiFromParams(url: string, referrerHost?: string) {
  try {
    const u = new URL(url);
    const p = u.searchParams;
    const raw = p.get('ai_ref') || p.get('aiSource') || p.get('aisource') || p.get('utm_source') || p.get('utm_source_ai');
    const slug = aliasToSlug(raw || '');
    
    // spoof guard: if referrer is a search engine, ignore param
    const ref = (referrerHost||'').toLowerCase();
    const isSearchRef = /(^|\.)google\.[a-z.]+$|(^|\.)bing\.com$|(^|\.)duckduckgo\.com$/.test(ref);
    const spoof = !!(slug && isSearchRef);
    
    return { slug: spoof ? undefined : slug, spoof };
  } catch (error) {
    // If URL parsing fails, return no AI source detected
    console.warn('Invalid URL in detectAiFromParams:', url, error);
    return { slug: undefined, spoof: false };
  }
}

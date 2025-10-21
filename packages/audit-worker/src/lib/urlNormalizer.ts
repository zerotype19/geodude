/**
 * URL Normalizer for Citations Join
 * 
 * Ensures consistent URL matching between citations and audit_pages
 */

/**
 * Normalize URL for citation matching
 * 
 * Rules:
 * 1. Lowercase hostname
 * 2. Remove trailing slash (unless root)
 * 3. Remove fragment (#...)
 * 4. Sort query params alphabetically
 * 5. Remove common tracking params
 * 6. Ensure protocol (default https)
 */
export function normalizeURL(url: string): string {
  try {
    // Handle relative URLs
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url.replace(/^\/+/, '');
    }

    const parsed = new URL(url);
    
    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();
    
    // Remove fragment
    parsed.hash = '';
    
    // Remove tracking params
    const trackingParams = new Set([
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
      '_ga', '_gl', 'ref', 'source'
    ]);
    
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    
    // Sort remaining query params
    const sortedParams = Array.from(parsed.searchParams.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));
    
    parsed.search = '';
    for (const [key, value] of sortedParams) {
      parsed.searchParams.append(key, value);
    }
    
    // Remove trailing slash (except for root)
    let pathname = parsed.pathname;
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;
    
    return parsed.toString();
  } catch (error) {
    console.error('[URL Normalizer] Error normalizing URL:', url, error);
    return url;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : 'https://' + url);
    return parsed.hostname.toLowerCase();
  } catch (error) {
    return url;
  }
}

/**
 * Check if two URLs are effectively the same after normalization
 */
export function urlsMatch(url1: string, url2: string): boolean {
  return normalizeURL(url1) === normalizeURL(url2);
}

/**
 * Batch normalize URLs for efficiency
 */
export function normalizeURLs(urls: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const url of urls) {
    map.set(url, normalizeURL(url));
  }
  return map;
}


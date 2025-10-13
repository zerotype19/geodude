/**
 * URL Canonicalizer
 * 
 * Normalizes URLs for consistent citation tracking
 */

export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();
    
    // Remove www. prefix
    if (parsed.hostname.startsWith('www.')) {
      parsed.hostname = parsed.hostname.substring(4);
    }
    
    // Remove fragment (#...)
    parsed.hash = '';
    
    // Remove UTM parameters
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    utmParams.forEach(param => {
      parsed.searchParams.delete(param);
    });
    
    // Sort query parameters for consistency
    const sortedParams = new URLSearchParams();
    Array.from(parsed.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, value]) => {
        sortedParams.set(key, value);
      });
    parsed.search = sortedParams.toString();
    
    return parsed.toString();
  } catch (error) {
    console.warn(`[URLCanonicalizer] Invalid URL: ${url}`);
    return url; // Return original if parsing fails
  }
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    let domain = parsed.hostname.toLowerCase();
    
    // Remove www. prefix
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    
    return domain;
  } catch (error) {
    console.warn(`[URLCanonicalizer] Invalid URL for domain extraction: ${url}`);
    return url.split('/')[2] || url; // Fallback extraction
  }
}

/**
 * Domain normalization utilities for Visibility Intelligence
 */

export interface DomainInfo {
  audited_url: string;      // protocol + host (e.g., https://www.example.com)
  hostname: string;         // full hostname (e.g., www.example.com)
  etld1: string;           // eTLD+1 (e.g., example.com)
  path: string;            // pathname from URL
}

/**
 * Parse a URL and extract normalized domain information
 * Uses a simple eTLD+1 extraction since we don't want to add external dependencies
 */
export function normalizeFromUrl(auditedUrl: string): DomainInfo {
  try {
    const url = new URL(auditedUrl);
    const host = url.hostname.toLowerCase();
    
    // Simple eTLD+1 extraction for common cases
    const parts = host.split('.');
    let etld1: string;
    
    if (parts.length <= 2) {
      // Simple case: example.com
      etld1 = host;
    } else {
      // Multi-part domain: www.example.com, blog.example.co.uk
      // For now, take last two parts (this is a simplified approach)
      etld1 = parts.slice(-2).join('.');
      
      // Handle common multi-part TLDs
      const knownMultiTlds = ['co.uk', 'com.au', 'co.jp', 'com.br', 'co.in', 'co.za'];
      const lastThree = parts.slice(-3).join('.');
      if (knownMultiTlds.includes(lastThree)) {
        etld1 = lastThree;
      }
    }
    
    return {
      audited_url: `${url.protocol}//${url.host}`,
      hostname: host,
      etld1,
      path: url.pathname || "/"
    };
  } catch (error) {
    console.error('Error parsing URL:', auditedUrl, error);
    throw new Error(`Invalid URL: ${auditedUrl}`);
  }
}

/**
 * Check if a domain matches the audited domain (either eTLD+1 or hostname)
 */
export function isAuditedDomain(refDomain: string, domainInfo: DomainInfo): boolean {
  const normalizedRef = refDomain.toLowerCase();
  return normalizedRef === domainInfo.etld1 || normalizedRef === domainInfo.hostname;
}

/**
 * Generate cache key for visibility queries
 */
export function getCacheKey(source: string, domain: string, query: string): string {
  const queryHash = btoa(query).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  return `vi:${source}:${domain}:${queryHash}`;
}

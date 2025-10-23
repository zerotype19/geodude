/**
 * Brand extraction and normalization utilities
 * Handles eTLD+1 extraction, brand candidate discovery, and fuzzy matching
 */

const STOP_SUFFIX = /\b(inc|llc|ltd|corp|co|company|gmbh|s\.a\.|s\.p\.a\.|pty|plc)\.?$/i;

/**
 * Extract eTLD+1 (effective top-level domain + 1 label)
 * Handles common multi-part TLDs like co.uk, com.au, etc.
 */
export function getETLD1(hostname: string): string {
  const parts = hostname.toLowerCase().split('.');
  if (parts.length <= 2) return hostname.toLowerCase();
  
  const last2 = parts.slice(-2).join('.');
  const last3 = parts.slice(-3).join('.');
  
  // Common multi-part TLDs
  const multiTLD = /(?:co\.uk|com\.au|co\.jp|com\.br|co\.in|com\.mx|co\.za|com\.sg)$/;
  return multiTLD.test(last3) ? last3 : last2;
}

/**
 * Normalize brand text for comparison
 * Removes punctuation, trademark symbols, converts to lowercase, strips legal suffixes
 */
export function normalizeBrandText(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[®™©℠]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(STOP_SUFFIX, '')
    .trim();
}

/**
 * Extract brand name from hostname
 * Skips www and extracts base name from eTLD+1
 */
export function brandFromHost(hostname: string): string {
  const etld1 = getETLD1(hostname);
  const base = etld1.split('.')[0];
  return normalizeBrandText(base);
}

/**
 * Check if needle appears in hay with word boundaries
 * Prevents false positives like "ai" matching inside "email"
 */
export function tokenBoundaryIncludes(hay: string, needle: string): boolean {
  if (!needle || needle.length < 2) return false;
  
  // Escape regex special characters
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Word-boundary search
  const re = new RegExp(`(^|\\b|\\s|[-–—|:•])${esc}($|\\b|\\s|[-–—|:•])`, 'i');
  return re.test(hay);
}

/**
 * Check if two hostnames are equivalent (same eTLD+1)
 * Handles www variants and subdomains
 */
export function hostsEquivalent(a: string, b: string): boolean {
  const na = getETLD1(a.toLowerCase());
  const nb = getETLD1(b.toLowerCase());
  return na === nb;
}


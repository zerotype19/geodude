/**
 * Domain matching utilities for Visibility Intelligence
 * Provides consistent audited domain detection across the system
 */

export function normalizeHostname(u: string): string | null {
  try {
    const url = new URL(u);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function etld1(host: string): string {
  // Simple eTLD+1 extraction (for now)
  // TODO: Use proper PSL-backed utility for complex TLDs like .co.uk
  const normalized = host.toLowerCase().replace(/^www\./, '');
  const parts = normalized.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return normalized;
}

export function isAuditedUrl(
  refUrl: string, 
  auditedPrimaryHost: string, 
  aliases: string[] = []
): boolean {
  const refHost = normalizeHostname(refUrl);
  if (!refHost) return false;
  
  // Normalize the audited domain/host
  const audited = auditedPrimaryHost
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');
  
  // Create array of all possible matches (primary + aliases)
  const allMatches = [audited, ...aliases.map(a => a.toLowerCase().replace(/^www\./, ''))];
  
  // Check if any match (exact hostname or eTLD+1)
  return allMatches.some(match => {
    const refEtld1 = etld1(refHost);
    const matchEtld1 = etld1(match);
    return refHost === match || refEtld1 === matchEtld1;
  });
}

export function extractDomainFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Ingest guards for data quality and security
 */

export function hostnameAllowed(host: string, propertyDomain: string): boolean {
  if (!host || !propertyDomain) return false;
  
  const lowerHost = host.toLowerCase();
  const lowerProp = propertyDomain.toLowerCase();
  
  // Exact match
  if (lowerHost === lowerProp) return true;
  
  // Subdomain match (e.g., www.awardsradar.com matches awardsradar.com)
  if (lowerHost.endsWith(`.${lowerProp}`)) return true;
  
  // Reject IPs and localhost
  if (lowerHost === 'localhost' || lowerHost === '127.0.0.1' || lowerHost === '::1') return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(lowerHost)) return false;
  
  return false;
}

export function sanitizeMetadata(meta: any): any | null {
  if (!meta || typeof meta !== "object") return {};
  
  const MAX_FIELD = 256;
  const pruned: any = {};
  const dropKeys = new Set<string>(["user_agent", "text", "css_classes"]);

  for (const [k, v] of Object.entries(meta)) {
    if (dropKeys.has(k)) continue;
    
    if (typeof v === "string") {
      pruned[k] = v.length > MAX_FIELD ? v.slice(0, MAX_FIELD) : v;
    } else {
      pruned[k] = v;
    }
  }
  
  // Final size check; drop more if still too big
  let raw = JSON.stringify(pruned);
  if (raw.length > 2048) {
    // Drop low-priority fields in order until under limit
    const priorityDropKeys = ["title", "query", "fragment", "search", "hash"];
    
    for (const k of priorityDropKeys) {
      if (k in pruned) {
        delete pruned[k];
        raw = JSON.stringify(pruned);
        if (raw.length <= 2048) break;
      }
    }
  }
  
  return raw.length <= 2048 ? pruned : null; // null => too big
}

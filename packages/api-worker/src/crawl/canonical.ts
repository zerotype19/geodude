/**
 * Canonical Host Resolver
 * Determines the canonical www/non-www host for a domain
 */

export async function resolveCanonicalHost(fetchFn: typeof fetch, origin: URL) {
  const hosts = [
    origin.host, 
    origin.host.startsWith('www.') ? origin.host.slice(4) : `www.${origin.host}`
  ];
  
  for (const h of hosts) {
    const u = new URL(origin.toString());
    u.host = h;
    
    try {
      const r = await fetchFn(u.toString(), { method: 'HEAD', redirect: 'manual' });
      
      // consume/cancel body to avoid CF "stalled response" warnings
      try { 
        await r.arrayBuffer(); 
      } catch { 
        try { 
          r.body?.cancel(); 
        } catch {} 
      }
      
      if (r.ok || (r.status >= 300 && r.status < 400)) {
        return h;
      }
    } catch {
      // Continue to next host variant
    }
  }
  
  return origin.host; // fallback
}

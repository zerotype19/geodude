import { safeFetch } from '../safe-fetch';

export async function resolveCanonicalHost(env: any, urlStr: string): Promise<string> {
  const u = new URL(urlStr);
  const hosts = [
    u.host, 
    u.host.replace(/^www\./, ''), 
    `www.${u.host.replace(/^www\./, '')}`
  ].filter((v, i, a) => a.indexOf(v) === i);

  console.log(`[CanonicalHost] Resolving canonical host for ${urlStr}, trying variants: ${hosts.join(', ')}`);

  // Try HTTPS preferred, then HTTP, follow redirects
  const schemes = ['https', 'http'];
  for (const host of hosts) {
    for (const scheme of schemes) {
      const trial = `${scheme}://${host}/`;
      console.log(`[CanonicalHost] Trying ${trial}`);
      
      try {
        const r = await safeFetch(trial, { 
          method: 'HEAD', 
          timeoutMs: 6000, 
          followRedirects: true 
        });
        
        if (r.ok) {
          const finalUrl = r.finalUrl ?? trial;
          const finalHost = new URL(finalUrl).host;
          console.log(`CANONICAL_HOST_RESOLVED { from: "${urlStr}", to: "${finalHost}" }`);
          return finalHost;
        }
      } catch (error) {
        console.log(`[CanonicalHost] Failed to reach ${trial}: ${error}`);
        continue;
      }
    }
  }
  
  // Fallback to original host
  console.log(`[CanonicalHost] Using fallback host: ${u.host}`);
  return u.host;
}

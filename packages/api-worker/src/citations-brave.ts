/**
 * Brave Search Citations
 * Free tier: 2,000 queries/month, no credit card
 */

interface Env {
  BRAVE_SEARCH?: string;
  BRAVE_SEARCH_ENDPOINT?: string;
}

interface BraveResult {
  title: string;
  url: string;
}

interface BraveSearchResponse {
  web?: {
    results: BraveResult[];
  };
}

export interface Citation {
  engine: string;
  query: string;
  url: string;
  title: string;
  cited_at: number;
}

/**
 * Extract hostname from URL
 */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Extract eTLD+1 (e.g., "example.com" from "www.example.com")
 */
function etld1(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}

/**
 * Deduplicate array by key function
 */
function dedupe<T>(arr: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = key(it);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
}

/**
 * Fetch citations from Brave Search API
 */
export async function fetchCitationsBrave(
  env: Env,
  domain: string,
  brand?: string
): Promise<Citation[]> {
  const apiKey = env.BRAVE_SEARCH;
  const endpoint = env.BRAVE_SEARCH_ENDPOINT || 'https://api.search.brave.com/res/v1/web/search';

  if (!apiKey) {
    console.log('No BRAVE_SEARCH secret set; returning []');
    return [];
  }

  const root = etld1(domain);
  const brandName = brand || domain.replace(/^www\./, '').split('.')[0];
  
  const queries = [
    `${brandName} site:${root}`,
    `${brandName} company`,
    `${root} reviews`,
  ];

  const results: Citation[] = [];

  for (const query of queries) {
    try {
      const url = `${endpoint}?q=${encodeURIComponent(query)}&count=10`;
      const response = await fetch(url, {
        headers: {
          'X-Subscription-Token': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`Brave search failed for "${query}": ${response.status}`);
        continue;
      }

      const data: BraveSearchResponse = await response.json();
      const items = data?.web?.results || [];

      for (const item of items) {
        const hostname = hostOf(item.url);
        if (!hostname) continue;

        // Keep only results from same eTLD+1 (your domain or subdomains)
        if (etld1(hostname) === root) {
          results.push({
            engine: 'brave',
            query,
            title: item.title,
            url: item.url,
            cited_at: Math.floor(Date.now() / 1000),
          });
        }
      }

      // Politeness delay between queries
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (error) {
      console.error(`Brave search error for "${query}":`, error);
      // Continue with next query
    }
  }

  // Dedupe by URL and limit to 15 total
  return dedupe(results, (x) => x.url).slice(0, 15);
}


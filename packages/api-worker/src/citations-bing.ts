/**
 * Bing Web Search Citations
 * TOS-safe citation detection using Bing Search API
 */

interface Env {
  BING_SEARCH_KEY?: string;
  BING_SEARCH_ENDPOINT?: string;
  CITATIONS_MAX_PER_QUERY?: string;
}

interface BingSearchResult {
  name: string;
  url: string;
  snippet?: string;
}

interface BingSearchResponse {
  webPages?: {
    value: BingSearchResult[];
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
 * Extract eTLD+1 from URL (e.g., "example.com" from "www.example.com")
 */
function getETLDPlusOne(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return hostname;
  } catch {
    return null;
  }
}

/**
 * Fetch citations from Bing Web Search API
 */
export async function fetchCitationsBing(
  env: Env,
  domain: string,
  brand?: string
): Promise<Citation[]> {
  // Return empty if no API key configured
  if (!env.BING_SEARCH_KEY || !env.BING_SEARCH_ENDPOINT) {
    return [];
  }

  const maxPerQuery = parseInt(env.CITATIONS_MAX_PER_QUERY || '5', 10);
  const targetDomain = getETLDPlusOne(`https://${domain}`);
  if (!targetDomain) return [];

  // Build 3 queries
  const brandName = brand || domain.replace(/^www\./, '').split('.')[0];
  const queries = [
    `${brandName} site:${domain}`,
    `${brandName} company`,
    `${domain} reviews`,
  ];

  const citations: Citation[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    try {
      // Timeout after 1200ms per query
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);

      const url = `${env.BING_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&count=10`;
      const response = await fetch(url, {
        headers: {
          'Ocp-Apim-Subscription-Key': env.BING_SEARCH_KEY!,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`Bing search failed for query "${query}": ${response.status}`);
        continue;
      }

      const data: BingSearchResponse = await response.json();
      const results = data.webPages?.value || [];

      // Filter for results that match our target domain
      for (const result of results) {
        const resultDomain = getETLDPlusOne(result.url);
        if (resultDomain === targetDomain && !seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          citations.push({
            engine: 'bing',
            query,
            url: result.url,
            title: result.name,
            cited_at: Math.floor(Date.now() / 1000),
          });

          // Limit per query
          if (citations.length >= maxPerQuery * queries.length) {
            break;
          }
        }
      }

      // Rate limit: small delay between queries
      await new Promise((resolve) => setTimeout(resolve, 350));
    } catch (error) {
      console.warn(`Bing search error for query "${query}":`, error);
      // Continue with next query
    }
  }

  return citations;
}


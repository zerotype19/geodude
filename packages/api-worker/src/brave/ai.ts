/**
 * Brave AI Answer Integration (Phase F+ "Stunner") - FIXED
 * Correct implementation using Brave's actual API endpoints
 * Based on official documentation at api-dashboard.search.brave.com
 */

import { uniq, clamp, extractPathname, pLimit } from '../util';

export type BraveMode = 'search' | 'summarizer';
export type Provider = 'brave';

export interface BraveQueryLog {
  provider: Provider;
  api: BraveMode;
  q: string;
  ts: number;
  ok: boolean;
  status?: number;
  durationMs?: number;
  sourcesTotal?: number;
  domainSources?: number;
  domainPaths?: string[];
  error?: string | null;
}

export interface PageData {
  path: string;
  h1?: string | null;
  words?: number;
}

export interface SmartQueryOpts {
  brand: string;
  domain: string;
  pages: PageData[];
  extraTerms?: string[];
  maxQueries: number;
  hardCap: number;
  enableCompare?: boolean;
}

// Medical/healthcare specific terms (common for health products)
const MEDICAL_TERMS = [
  'eligibility',
  'cost',
  'accuracy',
  'insurance',
  'instructions',
  'reviews',
  'side effects',
  'results',
  'preparation'
];

// Core terms applicable to most businesses
const CORE_TERMS = [
  'faq',
  'how to',
  'what is',
  'benefits',
  'features',
  'pricing',
  'support',
  'reviews',
  'alternatives'
];

// Likely path patterns that indicate high-value content
const HIGH_VALUE_PATHS = [
  '/faq',
  '/support',
  '/how-to',
  '/help',
  '/patient-stories',
  '/pricing',
  '/insurance',
  '/contact',
  '/about',
  '/guide'
];

/**
 * Build smart, diverse queries optimized for AI answer engines
 * Uses path analysis, H1 extraction, and entity-aware templates
 */
export function buildSmartQueries(opts: SmartQueryOpts): string[] {
  const { brand, domain, pages, extraTerms = [], maxQueries, hardCap, enableCompare } = opts;

  const queries: string[] = [];

  // 1) Base site queries
  queries.push(
    `site:${domain}`,
    brand,
    `${brand} faq`,
    `how to use ${brand}`,
    `${brand} features`,
    `${brand} pricing`
  );

  // 2) Path-aware queries (check if page exists, then query it)
  const paths = pages.map(p => p.path.toLowerCase());
  HIGH_VALUE_PATHS.forEach(valuePath => {
    const matchingPage = paths.find(p => p.startsWith(valuePath));
    if (matchingPage) {
      // Clean up path for query (remove slashes, make readable)
      const readable = valuePath.replace(/\//g, ' ').trim();
      queries.push(`${brand} ${readable}`);
    }
  });

  // 3) H1-driven queries (substantial pages with good content)
  const substantialPages = pages
    .filter(p => (p.words ?? 0) >= 300 && p.h1 && p.h1.length > 5)
    .slice(0, 8); // Top 8 most substantial pages

  substantialPages.forEach(p => {
    if (p.h1) {
      // Combine brand + H1 for context
      queries.push(`${brand} ${p.h1}`);
    }
  });

  // 4) Entity intent queries (medical + core terms)
  MEDICAL_TERMS.forEach(term => {
    queries.push(`${brand} ${term}`);
  });

  CORE_TERMS.forEach(term => {
    queries.push(`${brand} ${term}`);
  });

  // 5) Extra terms from user input (run-more or advanced options)
  extraTerms.forEach(term => {
    const cleaned = term.trim();
    if (cleaned) {
      // Smart formatting: if term doesn't already include brand, add it
      if (cleaned.toLowerCase().includes(brand.toLowerCase())) {
        queries.push(cleaned);
      } else {
        queries.push(`${brand} ${cleaned}`);
      }
    }
  });

  // 6) Optional: Competitor comparison queries
  if (enableCompare) {
    // TODO: Could be populated from TF-IDF analysis or user input
    // For now, these are stubs that can be customized per vertical
    const competitors = ['competitor']; // Replace with actual competitor detection
    competitors.forEach(comp => {
      queries.push(`${brand} vs ${comp}`);
    });
  }

  // Deduplicate, sanitize, and cap to limits
  const uniqueQueries = uniq(
    queries
      .map(q => q.trim())
      .filter(q => q.length > 0 && q.length < 200) // Reasonable query length
  );

  // Respect both soft (maxQueries) and hard (hardCap) limits
  const finalLimit = clamp(maxQueries, 1, hardCap);
  return uniqueQueries.slice(0, finalLimit);
}

/**
 * Call Brave Web Search API (correct endpoint)
 * This is step 1 of the two-step process
 */
async function callBraveWebSearch(
  apiKey: string,
  query: string,
  domain: string,
  timeoutMs: number
): Promise<BraveQueryLog> {
  const ts = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // CORRECT ENDPOINT per Brave API docs
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&summary=1`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const status = response.status;
    let sourcesTotal = 0;
    let domainSources = 0;
    let domainPaths: string[] = [];

    if (response.ok) {
      const data = await response.json();

      // Extract sources from web results
      let sources: string[] = [];
      
      // Web search results contain multiple result types
      if (data.web?.results) {
        sources = data.web.results
          .filter((r: any) => r.url)
          .map((r: any) => r.url);
      }

      sourcesTotal = sources.length;

      // Filter to sources from the audited domain
      const normalizedDomain = domain.replace(/^www\./, '');
      const domainSourceUrls = sources.filter(url => {
        try {
          const urlHost = new URL(url).hostname.replace(/^www\./, '');
          return urlHost === normalizedDomain;
        } catch {
          return false;
        }
      });

      domainSources = domainSourceUrls.length;
      domainPaths = uniq(domainSourceUrls.map(url => extractPathname(url)));
    }

    return {
      provider: 'brave',
      api: 'search',
      q: query,
      ts,
      ok: response.ok,
      status,
      durationMs: Date.now() - ts,
      sourcesTotal,
      domainSources,
      domainPaths,
      error: response.ok ? null : `HTTP ${status}`
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    return {
      provider: 'brave',
      api: 'search',
      q: query,
      ts,
      ok: false,
      durationMs: Date.now() - ts,
      sourcesTotal: 0,
      domainSources: 0,
      domainPaths: [],
      error: error?.name === 'AbortError' ? 'timeout' : String(error?.message ?? error)
    };
  }
}

/**
 * Call Brave Summarizer API (step 2, optional - only if we have a summarizer key)
 * For now, we'll skip this since it requires the two-step flow
 */
async function callBraveSummarizer(
  apiKey: string,
  summarizerKey: string,
  query: string,
  domain: string,
  timeoutMs: number
): Promise<BraveQueryLog> {
  const ts = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://api.search.brave.com/res/v1/summarizer/search?key=${encodeURIComponent(summarizerKey)}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const status = response.status;
    let sourcesTotal = 0;
    let domainSources = 0;
    let domainPaths: string[] = [];

    if (response.ok) {
      const data = await response.json();

      // Summarizer returns enrichments with sources
      let sources: string[] = [];
      
      if (data.summary?.enrichments) {
        sources = data.summary.enrichments
          .filter((e: any) => e.type === 'web_search_api_item' && e.url)
          .map((e: any) => e.url);
      }

      sourcesTotal = sources.length;

      const normalizedDomain = domain.replace(/^www\./, '');
      const domainSourceUrls = sources.filter(url => {
        try {
          const urlHost = new URL(url).hostname.replace(/^www\./, '');
          return urlHost === normalizedDomain;
        } catch {
          return false;
        }
      });

      domainSources = domainSourceUrls.length;
      domainPaths = uniq(domainSourceUrls.map(url => extractPathname(url)));
    }

    return {
      provider: 'brave',
      api: 'summarizer',
      q: query,
      ts,
      ok: response.ok,
      status,
      durationMs: Date.now() - ts,
      sourcesTotal,
      domainSources,
      domainPaths,
      error: response.ok ? null : `HTTP ${status}`
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    return {
      provider: 'brave',
      api: 'summarizer',
      q: query,
      ts,
      ok: false,
      durationMs: Date.now() - ts,
      sourcesTotal: 0,
      domainSources: 0,
      domainPaths: [],
      error: error?.name === 'AbortError' ? 'timeout' : String(error?.message ?? error)
    };
  }
}

/**
 * Run multiple Brave AI queries with concurrency control
 * SIMPLIFIED: Just use web search endpoint (correct per Brave docs)
 */
export async function runBraveAIQueries(
  apiKey: string,
  queries: string[],
  domain: string,
  opts?: { timeoutMs?: number; concurrency?: number }
): Promise<BraveQueryLog[]> {
  const timeoutMs = opts?.timeoutMs ?? 7000;
  const concurrency = opts?.concurrency ?? 2;
  
  const limit = pLimit(concurrency);

  // For each query, just call web search (the correct Brave API endpoint)
  const tasks: Promise<BraveQueryLog>[] = [];
  
  for (const query of queries) {
    tasks.push(limit(() => callBraveWebSearch(apiKey, query, domain, timeoutMs)));
  }

  const logs = await Promise.all(tasks);
  return logs;
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use runBraveAIQueries instead
 */
export { extractPathname };

/**
 * Brave AI Answer Integration (Phase F+ "Max" Mode)
 * Enhanced with diagnostics, smart query builder, and retry logic
 * Based on official Brave API documentation
 */

import { uniq, clamp, extractPathname, pLimit } from '../util';
import { buildSmartQueries as buildSmartQueriesNew, type SmartQuery, type QueryBucket } from './queryBuilder';

export type BraveMode = 'search' | 'summarizer';
export type Provider = 'brave';

// Phase F+: Enhanced diagnostic types
export type QueryStatus = 'ok' | 'empty' | 'rate_limited' | 'error' | 'timeout';
export type QueryReason = 'NO_ANSWER' | 'HTTP_429' | 'HTTP_5XX' | 'TIMEOUT' | 'PARSE_FAIL' | 'SUCCESS';

export interface BraveQueryLog {
  provider: Provider;
  api: BraveMode;
  q: string;
  bucket?: QueryBucket; // Phase F+: query categorization
  ts: number;
  ok: boolean;
  status?: number;
  durationMs?: number;
  sourcesTotal?: number;
  domainSources?: number;
  domainPaths?: string[];
  error?: string | null;
  // Phase F+: Enhanced diagnostics
  queryStatus?: QueryStatus;
  queryReason?: QueryReason;
  weight?: number; // Query priority/importance
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
 * Includes retry logic for 429 rate limit errors
 */
async function callBraveWebSearch(
  apiKey: string,
  query: string,
  domain: string,
  timeoutMs: number,
  retryCount: number = 0
): Promise<BraveQueryLog> {
  const ts = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // CORRECT ENDPOINT per Brave API docs with enhanced parameters
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query.trim());
    url.searchParams.set('count', '10'); // Request up to 10 results
    url.searchParams.set('country', 'us');
    url.searchParams.set('safesearch', 'moderate');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    // Handle 429 rate limit with exponential backoff + jitter
    if (response.status === 429 && retryCount < 3) {
      const baseDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      const jitter = Math.random() * 500; // 0-500ms jitter
      const delay = baseDelay + jitter;
      console.log(`[brave] Rate limited on "${query}", retry ${retryCount + 1}/3 in ${Math.round(delay)}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callBraveWebSearch(apiKey, query, domain, timeoutMs, retryCount + 1);
    }

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
 * Added delays to prevent 429 rate limiting
 */
export async function runBraveAIQueries(
  apiKey: string,
  queries: string[],
  domain: string,
  opts?: { timeoutMs?: number; concurrency?: number }
): Promise<BraveQueryLog[]> {
  const timeoutMs = opts?.timeoutMs ?? 10000; // Increased from 7s to 10s
  const concurrency = opts?.concurrency ?? 1; // Keep at 1 to avoid rate limits
  
  const limit = pLimit(concurrency);
  const logs: BraveQueryLog[] = [];

  // Deduplicate and validate queries
  const uniqueQueries = Array.from(new Set(
    queries.map(q => q.trim()).filter(q => q.length >= 3)
  ));

  console.log(`[brave] Processing ${uniqueQueries.length} unique queries (${queries.length} total)`);

  // Process queries in smaller batches with longer delays to avoid 429 errors
  const batchSize = 3; // Reduced from 5 to 3
  for (let i = 0; i < uniqueQueries.length; i += batchSize) {
    const batch = uniqueQueries.slice(i, i + batchSize);
    
    const batchTasks = batch.map(query => 
      limit(async () => {
        const result = await callBraveWebSearch(apiKey, query, domain, timeoutMs);
        // Add delay between queries within batch
        await new Promise(resolve => setTimeout(resolve, 300)); // Increased from 200ms
        return result;
      })
    );
    
    const batchResults = await Promise.all(batchTasks);
    logs.push(...batchResults);
    
    // Add longer delay between batches (1.5 seconds)
    if (i + batchSize < uniqueQueries.length) {
      console.log(`[brave] Completed ${i + batchSize}/${uniqueQueries.length} queries, pausing...`);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Increased from 1000ms
    }
  }

  console.log(`[brave] Completed: ${logs.filter(l => l.ok).length} succeeded, ${logs.filter(l => !l.ok).length} failed`);

  return logs;
}

/**
 * Phase F+: Build and run smart queries with full diagnostics
 */
export async function runSmartBraveQueries(
  apiKey: string,
  opts: {
    domain: string;
    brand: string;
    pages: PageData[];
    strategy?: 'basic' | 'smart' | 'aggressive';
    maxQueries?: number;
    hardCap?: number;
    enableCompare?: boolean;
    timeoutMs?: number;
    concurrency?: number;
    enableRetry?: boolean;
  }
): Promise<{ logs: BraveQueryLog[]; queries: SmartQuery[] }> {
  const {
    domain,
    brand,
    pages,
    strategy = 'smart',
    maxQueries = 50,
    hardCap = 100,
    enableCompare = false,
    timeoutMs = 7000,
    concurrency = 2,
    enableRetry = true,
  } = opts;

  // Build smart queries using new query builder
  const smartQueries = buildSmartQueriesNew({
    domain,
    brand,
    pages: pages.map(p => ({
      url: `https://${domain}${p.path}`,
      title: p.h1 || undefined,
      h1: p.h1 || undefined,
    })),
    strategy,
    maxQueries,
    enableCompare,
  });

  console.log(`[brave-f+] Built ${smartQueries.length} smart queries (strategy: ${strategy})`);

  // Run queries with enhanced diagnostics
  const limit = pLimit(concurrency);
  const logs: BraveQueryLog[] = [];

  // Process in batches to avoid rate limits
  const batchSize = 3;
  for (let i = 0; i < smartQueries.length; i += batchSize) {
    const batch = smartQueries.slice(i, i + batchSize);

    const batchTasks = batch.map((sq) =>
      limit(async () => {
        const ts = Date.now();
        let log: BraveQueryLog;

        try {
          // Call Brave Web Search
          log = await callBraveWebSearch(apiKey, sq.q, domain, timeoutMs, 0);

          // Enhance with query metadata
          log.bucket = sq.bucket;
          log.weight = sq.weight;

          // Categorize result
          if (log.ok) {
            if (log.sourcesTotal === 0) {
              log.queryStatus = 'empty';
              log.queryReason = 'NO_ANSWER';
            } else {
              log.queryStatus = 'ok';
              log.queryReason = 'SUCCESS';
            }
          } else {
            if (log.status === 429) {
              log.queryStatus = 'rate_limited';
              log.queryReason = 'HTTP_429';
            } else if (log.status && log.status >= 500) {
              log.queryStatus = 'error';
              log.queryReason = 'HTTP_5XX';
              // Retry once on 5xx if enabled
              if (enableRetry) {
                console.log(`[brave-f+] Retrying 5xx for: "${sq.q}"`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
                log = await callBraveWebSearch(apiKey, sq.q, domain, timeoutMs, 0);
                log.bucket = sq.bucket;
                log.weight = sq.weight;
              }
            } else if (log.error?.includes('timeout')) {
              log.queryStatus = 'timeout';
              log.queryReason = 'TIMEOUT';
            } else {
              log.queryStatus = 'error';
              log.queryReason = 'PARSE_FAIL';
            }
          }
        } catch (err: any) {
          log = {
            provider: 'brave',
            api: 'search',
            q: sq.q,
            bucket: sq.bucket,
            weight: sq.weight,
            ts,
            ok: false,
            durationMs: Date.now() - ts,
            sourcesTotal: 0,
            domainSources: 0,
            domainPaths: [],
            error: String(err?.message || err),
            queryStatus: 'error',
            queryReason: 'PARSE_FAIL',
          };
        }

        // Delay between queries
        await new Promise((resolve) => setTimeout(resolve, 300));
        return log;
      })
    );

    const batchResults = await Promise.all(batchTasks);
    logs.push(...batchResults);

    // Delay between batches
    if (i + batchSize < smartQueries.length) {
      console.log(`[brave-f+] Completed ${i + batchSize}/${smartQueries.length} queries, pausing...`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  const summary = {
    total: logs.length,
    ok: logs.filter((l) => l.queryStatus === 'ok').length,
    empty: logs.filter((l) => l.queryStatus === 'empty').length,
    rateLimited: logs.filter((l) => l.queryStatus === 'rate_limited').length,
    error: logs.filter((l) => l.queryStatus === 'error').length,
    timeout: logs.filter((l) => l.queryStatus === 'timeout').length,
  };

  console.log(
    `[brave-f+] Results: ${summary.ok} OK • ${summary.empty} Empty • ${summary.rateLimited} RL • ${summary.error} Error • ${summary.timeout} Timeout`
  );

  return { logs, queries: smartQueries };
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use runBraveAIQueries instead
 */
export { extractPathname };

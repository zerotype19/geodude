/**
 * Generic Provider Interface (Phase F+ Foundation)
 * Enables future support for multiple AI answer sources (Perplexity, You.com, etc.)
 */

export type Provider = 'brave' | 'perplexity' | 'youcom' | 'google-ao' | 'bing-copilot';

export interface ProviderQueryLog {
  provider: Provider;
  api: string; // e.g., 'grounding', 'summarizer', 'answers', etc.
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

export interface RunnerOpts {
  timeoutMs?: number;
  concurrency?: number;
  brand?: string;
}

export interface ProviderRunner {
  name: Provider;
  runQueries(
    domain: string,
    brand: string,
    queries: string[],
    opts: RunnerOpts
  ): Promise<ProviderQueryLog[]>;
}

/**
 * Brave AI Provider Runner (implemented)
 */
export class BraveRunner implements ProviderRunner {
  name: Provider = 'brave';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async runQueries(
    domain: string,
    brand: string,
    queries: string[],
    opts: RunnerOpts
  ): Promise<ProviderQueryLog[]> {
    // Import the Brave AI module
    const { runBraveAIQueries } = await import('../../brave/ai');
    
    // Run queries and return logs (already compatible with ProviderQueryLog structure)
    return runBraveAIQueries(
      this.apiKey,
      queries,
      domain,
      {
        timeoutMs: opts.timeoutMs,
        concurrency: opts.concurrency
      }
    ) as Promise<any>; // Type-cast since BraveQueryLog is compatible
  }
}

/**
 * Perplexity Provider Runner (stub - to be implemented)
 * Requires ENABLE_PERPLEXITY flag and API key
 */
export class PerplexityRunner implements ProviderRunner {
  name: Provider = 'perplexity';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async runQueries(
    domain: string,
    brand: string,
    queries: string[],
    opts: RunnerOpts
  ): Promise<ProviderQueryLog[]> {
    // TODO: Implement Perplexity AI API integration
    console.warn('Perplexity provider not yet implemented');
    return [];
  }
}

/**
 * You.com Provider Runner (stub - to be implemented)
 * Requires ENABLE_YOUCOM flag and API key
 */
export class YouComRunner implements ProviderRunner {
  name: Provider = 'youcom';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async runQueries(
    domain: string,
    brand: string,
    queries: string[],
    opts: RunnerOpts
  ): Promise<ProviderQueryLog[]> {
    // TODO: Implement You.com API integration
    console.warn('You.com provider not yet implemented');
    return [];
  }
}

/**
 * Headless Providers (Google AO, Bing Copilot)
 * Require ENABLE_HEADLESS_PROVIDERS flag and Browser Rendering
 * These scrape public UIs - use with caution and respect ToS
 */
export class HeadlessRunner implements ProviderRunner {
  name: Provider;
  private browser: any;

  constructor(provider: 'google-ao' | 'bing-copilot', browser: any) {
    this.name = provider;
    this.browser = browser;
  }

  async runQueries(
    domain: string,
    brand: string,
    queries: string[],
    opts: RunnerOpts
  ): Promise<ProviderQueryLog[]> {
    // TODO: Implement headless browser scraping
    // 1. Launch Puppeteer/Playwright session
    // 2. Search each query on Google/Bing
    // 3. Extract AI Overview/Copilot answer block
    // 4. Parse sources/citations
    // 5. Return structured logs
    
    console.warn(`Headless provider ${this.name} not yet implemented`);
    return [];
  }
}

/**
 * Factory function to create provider runners based on environment config
 */
export function createProviderRunners(env: {
  BRAVE_SEARCH_AI?: string;
  PERPLEXITY_API_KEY?: string;
  YOUCOM_API_KEY?: string;
  ENABLE_PERPLEXITY?: string;
  ENABLE_YOUCOM?: string;
  ENABLE_HEADLESS_PROVIDERS?: string;
  BROWSER?: any;
}): ProviderRunner[] {
  const runners: ProviderRunner[] = [];

  // Brave (always enabled if key present)
  if (env.BRAVE_SEARCH_AI) {
    runners.push(new BraveRunner(env.BRAVE_SEARCH_AI));
  }

  // Perplexity (opt-in)
  if (env.ENABLE_PERPLEXITY === 'true' && env.PERPLEXITY_API_KEY) {
    runners.push(new PerplexityRunner(env.PERPLEXITY_API_KEY));
  }

  // You.com (opt-in)
  if (env.ENABLE_YOUCOM === 'true' && env.YOUCOM_API_KEY) {
    runners.push(new YouComRunner(env.YOUCOM_API_KEY));
  }

  // Headless providers (experimental, opt-in)
  if (env.ENABLE_HEADLESS_PROVIDERS === 'true' && env.BROWSER) {
    runners.push(new HeadlessRunner('google-ao', env.BROWSER));
    runners.push(new HeadlessRunner('bing-copilot', env.BROWSER));
  }

  return runners;
}


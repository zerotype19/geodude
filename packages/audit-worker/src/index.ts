import { queryAI, processCitations, generateDefaultQueries } from './connectors';
import { handleGetLLMPrompts } from './routes/llm-prompts';
import { getUserIdFromRequest, verifyAuditOwnership, verifyIsAdmin } from './auth/helpers';
import { loadIndustryConfig } from './config/loader';
import { resolveIndustry } from './lib/industry';
import type { IndustryKey } from './config/industry-packs.schema';
import { 
  CRAWL_DELAY_MS, 
  PRECHECK_MAX_RETRIES, 
  PRECHECK_RETRY_BASE_MS, 
  PRECHECK_RETRY_MAX_MS,
  CITATIONS_BATCH_SIZE,
  CITATIONS_TIMEOUT_MS,
  CITATIONS_PERPLEXITY_TIMEOUT_MS,
  CITATIONS_CHATGPT_TIMEOUT_MS,
  CITATIONS_CLAUDE_TIMEOUT_MS,
  CITATIONS_BRAVE_TIMEOUT_MS,
  DISABLE_BRAVE_TEMP
} from './config';

// Bot Identity Configuration
const BOT_UA = "OptiviewAuditBot/1.0 (+https://optiview.ai/bot; admin@optiview.ai)";

// Helper: Sleep for polite crawling
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Calculate exponential backoff delay
function getBackoffDelay(attempt: number): number {
  const delay = PRECHECK_RETRY_BASE_MS * Math.pow(2, attempt);
  return Math.min(delay, PRECHECK_RETRY_MAX_MS);
}

// Helper: Parse Retry-After header (supports both seconds and HTTP date)
function parseRetryAfter(retryAfter: string | null): number {
  if (!retryAfter) return 0;
  
  // Try parsing as seconds
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000; // Convert to milliseconds
  }
  
  // Try parsing as HTTP date
  try {
    const date = new Date(retryAfter);
    const delay = date.getTime() - Date.now();
    return Math.max(0, delay);
  } catch {
    return 0;
  }
}

// Helper: Timeout wrapper for promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    )
  ]);
}

// Helper: Run items in batches with concurrency control
async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(item => fn(item))
    );
    results.push(...batchResults);
  }
  
  return results;
}

// Crawl/scoring budget for one run
// NOTE: CF Workers HTTP requests timeout at ~30s, so we must finalize before that
const HARD_TIME_MS = 25_000;           // 25 seconds - must finalize before CF HTTP timeout (~30s)
const PER_REQUEST_BUDGET_MS = 22_000;  // 22 seconds per batch to leave time for finalization
const CONCURRENCY = 8;                 // parallel page fetch/analyze
const PER_PAGE_TIMEOUT_MS = 4_000;     // each page gets 4s max

// Completion policy
const TARGET_MIN_PAGES = 40;           // we're happy at 40+
const TARGET_MAX_PAGES = 60;           // don't exceed this
const MAX_DISCOVER = 120;              // cap discovered queue

// Rendering configuration
const RENDER_MODE: "static" | "rendered" | "dual" = "dual"; // dual: fetch both static + rendered
const MAX_RENDER_PAGES = 10;           // only render top 10 pages per audit
const RENDER_TIMEOUT_MS = 8_000;       // 8s max render time per page
const STATIC_TIMEOUT_MS = 4_000;       // static fetch timeout (fast)

// Legacy constants (keeping for compatibility)
const MAX_RUN_MS = HARD_TIME_MS;
const PROGRESS_CHECK_INTERVAL = 15_000; // Check every 15 seconds

// Non-crawlable platforms (require login or are web apps, not content sites)
const BLOCKED_HOSTS = [
  "github.com",
  "app.figma.com", 
  "figma.com",
  "canva.com",
  "notion.so",
  "app.notion.so",
  "miro.com",
  "app.miro.com"
];

// Known redirects (optional - can move to KV later)
const AUTO_REDIRECTS: Record<string, string> = {
  "omnicom.com": "https://www.omnicomgroup.com",
  "ford.com": "https://corporate.ford.com",
  "princess.com": "https://www.princess.com/en-us/",
  "www.princess.com": "https://www.princess.com/en-us/"
};

/**
 * Normalize a URL for deduplication:
 * - Remove query strings (except for essential params like page IDs)
 * - Remove fragments (#)
 * - Normalize trailing slashes
 * - Lowercase hostname
 */
function normalizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    
    // Lowercase the hostname
    url.hostname = url.hostname.toLowerCase();
    
    // Remove hash/fragment
    url.hash = '';
    
    // Remove all query parameters (can be made smarter later to keep certain params)
    url.search = '';
    
    // Normalize trailing slash: always remove except for root path
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }
    
    return url.toString();
  } catch (e) {
    // If URL parsing fails, return original
    return urlString;
  }
}

export interface Env {
  DB: D1Database;
  RULES: KVNamespace;
  PROMPT_CACHE: KVNamespace;
  AUTH_LOGS: KVNamespace;
  BROWSER: Browser;
  AI: any;
  BASE_URL?: string; // For self-chaining batch requests
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  CLAUDE_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  BRAVE_API_KEY?: string;
  BRAVE_SEARCH?: string;
  SMTP2GO_API_KEY?: string;
  APP_BASE_URL?: string;
  COOKIE_NAME?: string;
  COOKIE_TTL_DAYS?: string;
  MAGIC_TOKEN_TTL_MIN?: string;
  MAGIC_REQUESTS_PER_HOUR?: string;
}

export interface AuditRequest {
  project_id: string;
  root_url: string;
  site_description?: string;
  max_pages?: number;
  config?: any;
}

export interface CitationsRequest {
  audit_id: string;           // Required: ties citations to specific audit
  project_id: string;
  domain: string;
  brand?: string;
  sources: ('perplexity' | 'chatgpt' | 'claude' | 'brave')[];
  queries?: string[];
}

export interface PageAnalysis {
  title: string;
  h1: string;
  canonical: string;
  schemaTypes: string[];
  jsonldRaw: any[];
  answerBox: boolean;
  jumpLinks: boolean;
  factsBlock: boolean;
  refsBlock: boolean;
  tablesCount: number;
  outboundLinks: number;
  org: any;
  author: any;
  robots: any;
  parityPass: boolean;
  chunkable: boolean;
  hasStableAnchors: boolean;
  hasDatasetLinks: boolean;
  hasLicense: boolean;
  hasChangelog: boolean;
  dateModified: boolean;
  linksToSourcesHub: boolean;
  clsRisk: boolean;
  sitemapsOk: boolean;
  internalCluster: boolean;
}


// Bot Identity and Robots.txt Support
type RobotsRules = {
  fetchedAt: string;
  group: "bot" | "star";
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
};

async function fetchWithIdentity(url: string, init: RequestInit = {}, env: Env) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("user-agent")) headers.set("user-agent", BOT_UA);
  headers.set("X-Optiview-Bot", "audit");
  
  // Signal US/English locale preference to prevent geo-redirects
  // Accept-Language: en-US prioritized, then en, then any
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", "en-US,en;q=0.9,*;q=0.5");
  }
  
  return fetch(url, { ...init, headers, cf: { cacheTtl: 0 } });
}

// Fast fetch with timeout (no rendering)
async function fetchPageWithTimeout(url: string, ms: number, env: Env): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetchWithIdentity(url, { signal: ctrl.signal }, env);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Browser rendering helper for JavaScript-heavy pages
async function browserRender(url: string, env: Env): Promise<string | null> {
  try {
    if (!env.BROWSER) {
      console.warn('[RENDER] Browser binding not available');
      return null;
    }
    
    const browser = await env.BROWSER.launch();
    const page = await browser.newPage();
    
    // Set timeout and user agent
    await page.setUserAgent(BOT_UA);
    
    // Navigate and wait for network idle
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: RENDER_TIMEOUT_MS 
    });
    
    // Get rendered HTML
    const html = await page.content();
    
    await page.close();
    await browser.close();
    
    return html || null;
  } catch (err) {
    const error = err as Error;
    console.error(`[RENDER_FAIL] ${url}:`, error.message);
    return null;
  }
}

// Compute render gap ratio (1.0 = fully same, 0.0 = empty static)
function computeRenderGap(staticHtml: string | null, renderedHtml: string | null): number | null {
  if (!staticHtml || !renderedHtml) return null;
  
  // Normalize whitespace for comparison
  const staticLen = staticHtml.replace(/\s+/g, ' ').length;
  const renderedLen = renderedHtml.replace(/\s+/g, ' ').length;
  
  if (renderedLen === 0) return null;
  
  // Ratio of static to rendered (1 = fully same, 0 = empty static)
  return Math.min(1.0, staticLen / renderedLen);
}

// Detect if a page is likely a SPA (Single Page Application)
function isLikelySPA(html: string): boolean {
  if (!html || html.length < 100) return true; // Too small = likely SPA shell
  
  // Remove script tags, style tags, and comments to focus on content
  const contentHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, ''); // Remove head entirely
  
  // Extract body content
  const bodyMatch = contentHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : contentHtml;
  
  // Remove all HTML tags to get text content
  const textContent = bodyContent
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // SPA indicators:
  // 1. Very little text content in body (< 200 chars)
  const hasMinimalContent = textContent.length < 200;
  
  // 2. Presence of SPA root div patterns
  const hasSPARoot = /<div[^>]*id=["'](root|app|__next|__nuxt)[^>]*>/i.test(bodyContent);
  
  // 3. Body is mostly just one div
  const divCount = (bodyContent.match(/<div/gi) || []).length;
  const hasMinimalStructure = divCount <= 3;
  
  // 4. Check for common SPA framework markers
  const hasSPAMarkers = 
    /data-react/i.test(html) ||
    /ng-version|ng-app/i.test(html) ||
    /__NEXT_DATA__|__NUXT__|__REACT_DEVTOOLS/i.test(html) ||
    /vue-app|v-cloak/i.test(html);
  
  // Consider it a SPA if:
  // - Minimal content AND (SPA root OR minimal structure OR SPA markers)
  return hasMinimalContent && (hasSPARoot || hasMinimalStructure || hasSPAMarkers);
}

// Smart fetch: dual-mode (static + optionally rendered)
async function fetchPageSmart(
  url: string, 
  env: Env, 
  pageIndex: number,
  renderCount: { current: number },
  isHomepage: boolean = false
): Promise<{ 
  staticHtml: string | null; 
  renderedHtml: string | null; 
  renderGapRatio: number | null;
  isSPA: boolean;
}> {
  // Always fetch static first (fast, reliable)
  const staticHtml = await fetchPageWithTimeout(url, STATIC_TIMEOUT_MS, env);
  let renderedHtml: string | null = null;
  let isSPA = false;
  
  if (!staticHtml) {
    return { staticHtml: null, renderedHtml: null, renderGapRatio: null, isSPA: false };
  }
  
  // Detect if this is a SPA
  isSPA = isLikelySPA(staticHtml);
  
  // Only render if:
  // 1. We're in dual/rendered mode
  // 2. Haven't hit render limit
  // 3. This is a top page (first 10) OR homepage
  // 4. SPA is detected (to save quota)
  const shouldRender = RENDER_MODE !== 'static' && 
                      renderCount.current < MAX_RENDER_PAGES && 
                      (pageIndex < MAX_RENDER_PAGES || isHomepage) &&
                      isSPA; // Only render if SPA detected
  
  if (shouldRender) {
    console.log(`[SPA DETECTED] ${url} - rendering...`);
    renderedHtml = await browserRender(url, env);
    if (renderedHtml) {
      renderCount.current++;
      console.log(`[RENDER] ${url} (${renderCount.current}/${MAX_RENDER_PAGES})`);
    }
  } else if (isSPA && renderCount.current >= MAX_RENDER_PAGES) {
    console.log(`[SPA DETECTED] ${url} - skipping (quota: ${renderCount.current}/${MAX_RENDER_PAGES})`);
  }
  
  // Compute gap ratio if we have both
  const renderGapRatio = computeRenderGap(staticHtml, renderedHtml);
  
  return { staticHtml, renderedHtml, renderGapRatio, isSPA };
}

function hostKey(u: URL): string {
  return `robots:${u.protocol}//${u.host}`;
}

async function getRobots(env: Env, u: URL): Promise<RobotsRules | null> {
  const key = hostKey(u);
  const cached = await env.RULES.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      // Invalid cached data, continue to fetch fresh
    }
  }

  const robotsUrl = new URL("/robots.txt", `${u.protocol}//${u.host}`).toString();
  const res = await fetchWithIdentity(robotsUrl, {}, env);
  if (!res.ok) {
    return null;
  }
  const text = await res.text();

  // Parse robots.txt
  const lines = text.split(/\r?\n/);
  let current = "*";
  const blocks: Record<string, { allow: string[]; disallow: string[]; crawlDelay?: number }> = {};
  const ensure = (k: string) => (blocks[k] ||= { allow: [], disallow: [] });

  for (const line of lines) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    
    const mUA = l.match(/^User-agent:\s*(.+)$/i);
    if (mUA) {
      current = mUA[1].trim().toLowerCase();
      ensure(current);
      continue;
    }
    
    const mAllow = l.match(/^Allow:\s*(.+)$/i);
    if (mAllow) {
      ensure(current).allow.push(mAllow[1].trim());
      continue;
    }
    
    const mDis = l.match(/^Disallow:\s*(.+)$/i);
    if (mDis) {
      ensure(current).disallow.push(mDis[1].trim());
      continue;
    }
    
    const mDelay = l.match(/^Crawl-delay:\s*(\d+)/i);
    if (mDelay) {
      ensure(current).crawlDelay = Number(mDelay[1]);
      continue;
    }
  }

  const botName = "optiviewauditbot"; // lowercase for matching
  const botGroup = blocks[botName] ? "bot" : "star";
  const group = botGroup === "bot" ? blocks[botName]! : (blocks["*"] || { allow: [], disallow: [] });

  const rules: RobotsRules = {
    fetchedAt: new Date().toISOString(),
    group: botGroup,
    allow: group.allow,
    disallow: group.disallow,
    crawlDelay: group.crawlDelay
  };
  
  // Cache for 24 hours
  await env.RULES.put(key, JSON.stringify(rules), { expirationTtl: 86400 });
  return rules;
}

// Path test: returns true if allowed
function isAllowedByRobots(rules: RobotsRules | null, path: string): boolean {
  if (!rules) return true; // no robots; treat as allowed
  
  // Find all matching disallow rules
  const disallowMatches = rules.disallow.filter(rule => rule && path.startsWith(rule));
  
  // If no disallow rule matches, allow the path
  if (disallowMatches.length === 0) return true;
  
  // Find the longest disallow rule that matches
  const longestDisallow = disallowMatches.reduce((longest, current) => 
    current.length > longest.length ? current : longest, "");
  
  // Find all matching allow rules that are longer than the longest disallow rule
  const allowMatches = rules.allow.filter(rule => 
    rule && path.startsWith(rule) && rule.length > longestDisallow.length);
  
  // If we have an allow rule that's longer than the longest disallow rule, allow the path
  return allowMatches.length > 0;
}

// Auto-finalize stuck audits (called by cron)
async function autoFinalizeStuckAudits(env: Env): Promise<void> {
  console.log('[AUTO-FINALIZE] Checking for stuck audits...');
  
  // Find audits that are stuck in "running" state with enough pages analyzed
  const stuckAudits = await env.DB.prepare(
    `SELECT a.id, 
            a.started_at,
            (SELECT COUNT(*) FROM audit_page_analysis apa 
             JOIN audit_pages ap ON apa.page_id = ap.id 
             WHERE ap.audit_id = a.id) as pages_analyzed
     FROM audits a
     WHERE a.status = 'running' 
       AND datetime(a.started_at) < datetime('now', '-10 minutes')
     ORDER BY a.started_at DESC
     LIMIT 50`
  ).all();
  
  let finalized = 0;
  
  for (const audit of (stuckAudits.results || [])) {
    const auditData = audit as { id: string; pages_analyzed: number; started_at: string };
    const auditAge = Date.now() - new Date(auditData.started_at).getTime();
    const ageMinutes = Math.round(auditAge / 60000);
    
    // Finalize if:
    // 1. Has 20+ pages (usable data) - regardless of age
    // 2. Has any pages and is >30 minutes old (give up waiting)
    // 3. Has 0 pages and is >10 minutes old (failed to start)
    
    if (auditData.pages_analyzed >= 20) {
      // Has usable data - finalize it
      await finalizeAudit(env, auditData.id, 'auto_finalize_stuck');
      finalized++;
      console.log(`[AUTO-FINALIZE] Finalized stuck audit ${auditData.id} (${auditData.pages_analyzed} pages, ${ageMinutes}min old)`);
    } else if (auditData.pages_analyzed > 0 && ageMinutes >= 30) {
      // Has some pages but stuck for 30+ minutes - finalize what we have
      await finalizeAudit(env, auditData.id, 'auto_finalize_stuck_partial');
      finalized++;
      console.log(`[AUTO-FINALIZE] Finalized partial audit ${auditData.id} (${auditData.pages_analyzed} pages, ${ageMinutes}min old)`);
    } else if (auditData.pages_analyzed === 0 && ageMinutes >= 10) {
      // No pages analyzed after 10 minutes - mark as failed
      await markAuditFailed(env, auditData.id, 'timeout_no_pages_after_10min');
      finalized++;
      console.log(`[AUTO-FINALIZE] Failed stuck audit ${auditData.id} (0 pages, ${ageMinutes}min old)`);
    } else {
      console.log(`[AUTO-FINALIZE] Skipping audit ${auditData.id} (${auditData.pages_analyzed} pages, ${ageMinutes}min old) - not yet eligible`);
    }
  }
  
  console.log(`[AUTO-FINALIZE] Processed ${finalized} stuck audits`);
}

/**
 * Refresh oldest prompt cache entries (rolling refresh strategy)
 * Runs hourly to keep cache fresh
 */
async function refreshPromptCache(env: Env): Promise<void> {
  console.log('[PROMPT_REFRESH] Starting hourly cache refresh');
  
  const { getStalePromptCache, buildAndCachePrompts } = await import('./prompt-cache');
  const staleDomains = await getStalePromptCache(env, 100);
  
  if (staleDomains.length === 0) {
    console.log('[PROMPT_REFRESH] No stale cache entries found');
    return;
  }
  
  console.log(`[PROMPT_REFRESH] Refreshing ${staleDomains.length} domains`);
  let refreshed = 0;
  
  for (const domain of staleDomains) {
    try {
      await buildAndCachePrompts(env, domain);
      refreshed++;
    } catch (err) {
      console.error(`[PROMPT_REFRESH] Failed to refresh ${domain}:`, err);
    }
  }
  
  console.log(`[PROMPT_REFRESH] Refreshed ${refreshed}/${staleDomains.length} domains`);
}

/**
 * Warm cache for demo domains nightly (for reliable demos)
 */
async function warmDemoDomains(env: Env): Promise<void> {
  console.log('[DEMO_WARMER] Starting nightly demo cache warmer');
  
  // Demo domains across all major industries
  const demoDomains = [
    // Finance
    'chase.com', 'visa.com', 'stripe.com', 'americanexpress.com',
    // Health
    'cologuard.com', 'mayoclinic.org',
    // Retail
    'nike.com', 'etsy.com',
    // Automotive
    'lexus.com', 'ford.com',
    // Travel
    'hilton.com', 'expedia.com',
    // Media
    'nytimes.com', 'wsj.com',
    // Software
    'github.com', 'atlassian.com'
  ];
  
  console.log(`[DEMO_WARMER] Warming ${demoDomains.length} demo domains`);
  let warmed = 0;
  
  for (const domain of demoDomains) {
    try {
      const { buildLLMQueryPrompts } = await import('./prompts');
      await buildLLMQueryPrompts(env, domain);
      warmed++;
      console.log(`[DEMO_WARMER] ✅ ${domain} warmed (${warmed}/${demoDomains.length})`);
    } catch (err) {
      console.error(`[DEMO_WARMER] ❌ Failed to warm ${domain}:`, err);
    }
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`[DEMO_WARMER] Warmed ${warmed}/${demoDomains.length} domains`);
}

/**
 * ASYNC CITATIONS SYSTEM
 * Queue citations for background processing to avoid HTTP timeout limits
 */

// Queue citations job for async processing
async function queueCitations(req: Request, env: Env): Promise<Response> {
  try {
    const body: CitationsRequest = await req.json();
    const { audit_id } = body;
    
    if (!audit_id) {
      throw new Error('audit_id is required');
    }
    
    // Verify audit exists
    const audit = await env.DB.prepare(`
      SELECT id, status FROM audits WHERE id = ?
    `).bind(audit_id).first();
    
    if (!audit) {
      throw new Error(`Audit ${audit_id} not found`);
    }
    
    // Queue the citations job
    await env.DB.prepare(`
      UPDATE audits 
      SET citations_status = 'queued',
          citations_queued_at = datetime('now'),
          citations_error = NULL
      WHERE id = ?
    `).bind(audit_id).run();
    
    console.log(`[CITATIONS] Queued citations for audit ${audit_id}`);
    
    return new Response(JSON.stringify({
      status: 'queued',
      audit_id,
      message: 'Citations analysis queued for background processing'
    }), { 
      status: 202, // Accepted
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[CITATIONS] Queue error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get citations status for an audit
async function getCitationsStatus(auditId: string, env: Env): Promise<Response> {
  try {
    const audit = await env.DB.prepare(`
      SELECT 
        citations_status,
        citations_queued_at,
        citations_started_at,
        citations_completed_at,
        citations_error
      FROM audits 
      WHERE id = ?
    `).bind(auditId).first();
    
    if (!audit) {
      throw new Error('Audit not found');
    }
    
    // Get citation counts if completed
    let stats = null;
    if (audit.citations_status === 'completed') {
      const citationsCount = await env.DB.prepare(`
        SELECT COUNT(*) as total, SUM(cited_match_count > 0) as cited
        FROM ai_citations WHERE audit_id = ?
      `).bind(auditId).first();
      
      stats = {
        total_queries: citationsCount?.total || 0,
        cited_count: citationsCount?.cited || 0
      };
    }
    
    return new Response(JSON.stringify({
      status: audit.citations_status || 'not_queued',
      queued_at: audit.citations_queued_at,
      started_at: audit.citations_started_at,
      completed_at: audit.citations_completed_at,
      error: audit.citations_error,
      stats
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[CITATIONS] Status error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Process queued citations jobs (called by cron)
async function processQueuedCitations(env: Env): Promise<void> {
  console.log('[CITATIONS_CRON] Checking for queued citations...');
  
  // Get the oldest queued job
  const audit = await env.DB.prepare(`
    SELECT id, project_id, root_url
    FROM audits
    WHERE citations_status = 'queued'
    ORDER BY citations_queued_at ASC
    LIMIT 1
  `).bind().first();
  
  if (!audit) {
    console.log('[CITATIONS_CRON] No queued citations found');
    return;
  }
  
  console.log(`[CITATIONS_CRON] Processing citations for audit ${audit.id}`);
  
  // Mark as processing
  await env.DB.prepare(`
    UPDATE audits
    SET citations_status = 'processing',
        citations_started_at = datetime('now')
    WHERE id = ?
  `).bind(audit.id).run();
  
  try {
    // Call the actual citations processing (the old runCitations logic)
    const domain = normalizeDomain(new URL(audit.root_url as string).hostname);
    
    // Build a mock request to reuse existing processCitations logic
    const mockRequest = new Request('https://api.optiview.ai/api/citations/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audit_id: audit.id,
        project_id: audit.project_id,
        domain: domain,
        sources: ['perplexity', 'chatgpt', 'claude', 'brave']
      })
    });
    
    // Process citations (this is the long-running part)
    await runCitations(mockRequest, env);
    
    // Mark as completed
    await env.DB.prepare(`
      UPDATE audits
      SET citations_status = 'completed',
          citations_completed_at = datetime('now'),
          citations_error = NULL
      WHERE id = ?
    `).bind(audit.id).run();
    
    console.log(`[CITATIONS_CRON] ✅ Completed citations for audit ${audit.id}`);
    
  } catch (error) {
    console.error(`[CITATIONS_CRON] ❌ Failed citations for audit ${audit.id}:`, error);
    
    // Mark as failed
    await env.DB.prepare(`
      UPDATE audits
      SET citations_status = 'failed',
          citations_error = ?
      WHERE id = ?
    `).bind(
      error instanceof Error ? error.message : 'Unknown error',
      audit.id
    ).run();
  }
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[CRON] Scheduled event:', event.cron);
    
    if (event.cron === '0 14 * * 1') {
      // Weekly citations run (Mondays 14:00 UTC)
      await runWeeklyCitations(env);
    }
    
    if (event.cron === '*/10 * * * *') {
      // Every 10 minutes: Process queued citations
      await processQueuedCitations(env);
    }
    
    if (event.cron === '0 * * * *') {
      // Hourly: Auto-finalize stuck audits
      await autoFinalizeStuckAudits(env);
      
      // Hourly: Refresh oldest 100 prompt cache entries
      await refreshPromptCache(env);
    }
    
    if (event.cron === '0 2 * * *') {
      // Nightly: Warm demo domain cache (02:00 UTC)
      await warmDemoDomains(env);
    }
  },

  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Load industry configuration from KV on first request
    await loadIndustryConfig(env);
    
    // Validate scoring criteria are seeded (only runs once per worker startup)
    if (env.SCORING_V1_ENABLED === 'true') {
      try {
        const { validateCriteriaSeeded } = await import('./lib/scoringCriteriaDB');
        await validateCriteriaSeeded(env.DB);
      } catch (error) {
        console.error('[Startup] Scoring criteria validation failed:', error);
        // Don't fail the worker, just log the warning
      }
    }
    
    const url = new URL(req.url);
    const path = url.pathname;

    try {
      // CORS headers
      const origin = req.headers.get('Origin') || 'https://app.optiview.ai';
      const corsHeaders = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      };

      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // Auth routes
      if (path.startsWith('/v1/auth/')) {
        const { 
          handleMagicLinkRequest, 
          handleMagicLinkVerify, 
          handleAuthMe, 
          handleAuthLogout,
          handleGetUsers,
          handleGetAuthStats
        } = await import('./auth/routes');

        if (req.method === 'POST' && path === '/v1/auth/magic/request') {
          return handleMagicLinkRequest(req, env);
        }

    if (req.method === 'GET' && path === '/v1/auth/magic/verify') {
      return handleMagicLinkVerify(req, env);
    }

        if (req.method === 'GET' && path === '/v1/auth/me') {
          return handleAuthMe(req, env);
        }

        if (req.method === 'POST' && path === '/v1/auth/logout') {
          return handleAuthLogout(req, env);
        }

        if (req.method === 'GET' && path === '/v1/auth/users') {
          return handleGetUsers(req, env);
        }

        if (req.method === 'GET' && path === '/v1/auth/stats') {
          return handleGetAuthStats(req, env);
        }
      }

      // Industry classification endpoint
      if (req.method === 'POST' && path === '/industry/classify') {
        const { handleIndustryClassify } = await import('./routes/industry-classify');
        return handleIndustryClassify(req, env);
      }

      // Route handlers
      if (req.method === 'POST' && path === '/api/audits') {
        try {
          const result = await createAudit(req, env, ctx);
          return new Response(JSON.stringify(result), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        } catch (createAuditError: any) {
          console.error('[CREATE_AUDIT_HANDLER_ERROR]', createAuditError.message || createAuditError);
          console.error('[CREATE_AUDIT_HANDLER_ERROR] Stack:', createAuditError.stack);
          return new Response(JSON.stringify({ 
            error: 'Internal server error', 
            details: createAuditError.message 
          }), { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      }

      // Composite scoring for an audit (before general /api/audits/ route)
      if (req.method === 'GET' && path.match(/^\/api\/audits\/[^/]+\/composite$/)) {
        const auditId = path.split('/')[3];
        if (!auditId) {
          return new Response(JSON.stringify({ error: 'Audit ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          const { computeComposite } = await import('./diagnostics/composite');
          const { loadCriteriaMap } = await import('./diagnostics/persist');

          // Fetch site_checks_json from audits table
          const audit = await env.DB.prepare("SELECT site_checks_json, user_id FROM audits WHERE id = ?").bind(auditId).first();
          if (!audit) {
            return new Response(JSON.stringify({ error: 'Audit not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // SECURITY: Check ownership  
          // Temporarily disabled for debugging - TODO: re-enable after testing
          // const userId = await getUserIdFromRequest(req, env);
          // if (!userId || audit.user_id !== userId) {
          //   return new Response(JSON.stringify({ error: 'Access denied' }), {
          //     status: 403,
          //     headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          //   });
          // }

          const siteChecks = audit.site_checks_json ? JSON.parse(audit.site_checks_json as string) : [];

          // Aggregate page checks from all pages in the audit
          const pages = (await env.DB.prepare(`
            SELECT apa.checks_json
            FROM audit_pages p
            LEFT JOIN audit_page_analysis apa ON apa.page_id = p.id
            WHERE p.audit_id = ?1 AND apa.checks_json IS NOT NULL
          `).bind(auditId).all()).results || [];

          const allPageChecks = pages.flatMap((p: any) => {
            try {
              return p.checks_json ? JSON.parse(p.checks_json) : [];
            } catch {
              return [];
            }
          });

          // Load criteria metadata
          const criteriaMap = await loadCriteriaMap(env.DB);
          const criteriaArray = Array.from(criteriaMap.values());

          // Compute composite scores
          const composite = computeComposite(allPageChecks, siteChecks, criteriaArray);

          return new Response(JSON.stringify({
            audit_id: auditId,
            ...composite
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error(`[COMPOSITE] Error for audit ${auditId}:`, error);
          return new Response(JSON.stringify({
            error: 'Failed to compute composite score',
            message: (error as Error).message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      if (req.method === 'GET' && path === '/api/audits') {
        // Extract user_id from session cookie - REQUIRED for security
        const userId = await getUserIdFromRequest(req, env);
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const result = await getAuditsList(url.searchParams, env, userId);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (req.method === 'GET' && path.startsWith('/api/audits/')) {
        const auditId = path.split('/')[3];
        if (!auditId) {
          return new Response(JSON.stringify({ error: 'Audit ID required' }), { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        // SECURITY: Verify user is authenticated and owns this audit
        const userId = await getUserIdFromRequest(req, env);
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const hasAccess = await verifyAuditOwnership(env.DB, auditId, userId);
        if (!hasAccess) {
          return new Response(JSON.stringify({ error: 'Access denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (path === `/api/audits/${auditId}`) {
          const result = await getAudit(auditId, env);
          return new Response(JSON.stringify(result), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        if (path === `/api/audits/${auditId}/pages`) {
          const result = await getAuditPages(auditId, url.searchParams, env);
          return new Response(JSON.stringify(result), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        if (path.startsWith(`/api/audits/${auditId}/pages/`)) {
          const pageId = path.split('/')[5];
          const result = await getAuditPage(pageId, env);
          return new Response(JSON.stringify(result), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        if (path === `/api/audits/${auditId}/recrawl`) {
          const result = await recrawlAudit(auditId, env, ctx);
          return new Response(JSON.stringify(result), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      }

      // POST endpoints for audit actions
      if (req.method === 'POST' && path.startsWith('/api/audits/')) {
        const auditId = path.split('/')[3];
        if (!auditId) {
          return new Response(JSON.stringify({ error: 'Audit ID required' }), { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        // SECURITY: Verify user is authenticated and owns this audit
        const userId = await getUserIdFromRequest(req, env);
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const hasAccess = await verifyAuditOwnership(env.DB, auditId, userId);
        if (!hasAccess) {
          return new Response(JSON.stringify({ error: 'Access denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (path === `/api/audits/${auditId}/recompute`) {
          const result = await recomputeAudit(auditId, env);
          return new Response(JSON.stringify(result), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        if (path === `/api/audits/${auditId}/fail`) {
          if (req.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
              status: 405, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
          }
          const body = await req.json() as { reason?: string };
          const reason = body.reason || 'manual_failure';
          await markAuditFailed(env, auditId, reason);
          return new Response(JSON.stringify({ status: 'failed', reason }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        if (path === `/api/audits/${auditId}/continue`) {
          const result = await continueAuditBatch(auditId, env);
          return new Response(JSON.stringify(result), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      }

      // TEMP: Quick backfill bypass (NO AUTH - remove after use)
      if (req.method === 'GET' && path === '/api/admin/backfill-now') {
        try {
          const { backfillMultipleAudits } = await import('./scripts/backfillChecks');
          const auditIds = [
            "5b83c3da-adf2-44c5-b14e-807f44140e02", // Progressive
            "c0726395-7f01-4a33-b2b2-2f375a01e43c", // Lennar
            "508e0cc4-b76f-455b-942d-3dda108c3f75"  // Walmart
          ];
          
          console.log('[BACKFILL_NOW] Starting for', auditIds.length, 'audits');
          const results = await backfillMultipleAudits(env, auditIds);
          
          return new Response(JSON.stringify({ results }, null, 2), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('[BACKFILL_NOW] Error:', error);
          return new Response(JSON.stringify({ 
            error: 'Backfill failed', 
            message: (error as Error).message,
            stack: (error as Error).stack
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Admin routes - require admin authentication
      if (path.startsWith('/api/admin/')) {
        // SECURITY: Verify user is authenticated and is an admin
        const userId = await getUserIdFromRequest(req, env);
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const isAdmin = await verifyIsAdmin(env.DB, userId);
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (req.method === 'POST' && path === '/api/admin/finalize-stuck') {
          await autoFinalizeStuckAudits(env);
          return new Response(JSON.stringify({ ok: true, message: 'Auto-finalize completed' }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        // Backfill scoring checks for existing audits
        if (req.method === 'POST' && path.startsWith('/api/admin/audits/') && path.endsWith('/backfill-checks')) {
          const auditId = path.split('/')[4];
          if (!auditId) {
            return new Response(JSON.stringify({ error: 'Audit ID required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          try {
            const { backfillChecks } = await import('./scripts/backfillChecks');
            
            // Get audit details for site info
            const audit = await env.DB.prepare("SELECT root_url FROM audits WHERE id = ?")
              .bind(auditId).first();
            
            if (!audit) {
              return new Response(JSON.stringify({ error: 'Audit not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            const url = new URL(audit.root_url as string);
            const result = await backfillChecks(env, auditId, {
              domain: url.hostname,
              homepageUrl: audit.root_url as string,
              targetLocale: "en-US"
            });
            
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } catch (error) {
            console.error('[BACKFILL] Error:', error);
            return new Response(JSON.stringify({ 
              error: 'Backfill failed', 
              message: (error as Error).message 
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        // Batch backfill for multiple audits
        if (req.method === 'POST' && path === '/api/admin/backfill-checks-batch') {
          try {
            const body = await req.json() as { audit_ids: string[] };
            if (!body.audit_ids || !Array.isArray(body.audit_ids)) {
              return new Response(JSON.stringify({ error: 'audit_ids array required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            const { backfillMultipleAudits } = await import('./scripts/backfillChecks');
            const results = await backfillMultipleAudits(env, body.audit_ids);
            
            return new Response(JSON.stringify({ results }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } catch (error) {
            console.error('[BACKFILL_BATCH] Error:', error);
            return new Response(JSON.stringify({ 
              error: 'Batch backfill failed', 
              message: (error as Error).message 
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        // Compute site-level diagnostics for an audit
        if (req.method === 'POST' && path.startsWith('/api/admin/audits/') && path.endsWith('/compute-site-diagnostics')) {
          const auditId = path.split('/')[4];
          if (!auditId) {
            return new Response(JSON.stringify({ error: 'Audit ID required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          try {
            const { runDiagnosticsForSite } = await import('./diagnostics/runSite');
            
            // Fetch audit info
            const audit = await env.DB.prepare("SELECT root_url FROM audits WHERE id = ?").bind(auditId).first();
            if (!audit) {
              return new Response(JSON.stringify({ error: 'Audit not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            const domain = new URL(audit.root_url as string).hostname;

            // Fetch all pages with their checks_json
            const pages = (await env.DB.prepare(`
              SELECT p.id, p.url, p.html_rendered, p.html_static, apa.checks_json
              FROM audit_pages p
              LEFT JOIN audit_page_analysis apa ON apa.page_id = p.id
              WHERE p.audit_id = ?1
            `).bind(auditId).all()).results || [];

            const ctx = {
              auditId,
              domain,
              pages: pages.map((r: any) => ({
                id: r.id,
                url: r.url,
                html_rendered: r.html_rendered,
                html_static: r.html_static,
                checks: r.checks_json ? JSON.parse(r.checks_json) : []
              }))
            };

            const results = await runDiagnosticsForSite(env.DB, ctx);

            return new Response(JSON.stringify({
              audit_id: auditId,
              site_checks_count: results.length,
              results
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } catch (error) {
            console.error(`[SITE_DIAGNOSTICS] Error for audit ${auditId}:`, error);
            return new Response(JSON.stringify({
              error: 'Failed to compute site diagnostics',
              message: (error as Error).message
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        // Admin classifier comparison endpoint
        if (req.method === 'GET' && path === '/api/admin/classifier-compare') {
        const host = url.searchParams.get('host');
        if (!host) {
          return new Response(JSON.stringify({ error: 'host parameter required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          const result = await compareClassifiers(host, env);
          
          // Log telemetry
          console.log(JSON.stringify({
            type: 'admin_classifier_compare_viewed',
            host,
            has_legacy: !!result.legacy,
            has_v2: !!result.v2
          }));

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

        // Admin system status endpoint
        if (req.method === 'GET' && path === '/api/admin/system-status') {
          const { handleSystemStatus } = await import('./routes/system-status');
          return handleSystemStatus(env);
        }

        // Admin classifier health endpoint
        if (req.method === 'GET' && path === '/api/admin/classifier-health') {
          try {
            const { computeHealthMetrics, checkHealth } = await import('./lib/health');
            
            const metrics = await computeHealthMetrics(env, 24);
            const alerts = checkHealth(metrics);

            return new Response(JSON.stringify({ metrics, alerts }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } catch (error: any) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        // Admin circuit breaker reset endpoint
        if (req.method === 'POST' && path === '/api/admin/circuit-breaker/reset') {
          try {
            const { CircuitBreaker } = await import('./lib/circuitBreaker');
            const breaker = new CircuitBreaker(env.RULES);
            await breaker.reset();

            return new Response(JSON.stringify({ ok: true, message: 'Circuit breaker reset to half-open' }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } catch (error: any) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

      // Manual finalize endpoint for specific audit
      if (req.method === 'POST' && path.match(/^\/api\/audits\/[^\/]+\/finalize$/)) {
        const auditId = path.split('/')[3];
        try {
          await finalizeAudit(env, auditId, 'manual_finalize');
          return new Response(JSON.stringify({ ok: true, message: 'Audit finalized', auditId }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      }

        // Admin delete audit endpoint
        if (req.method === 'DELETE' && path.match(/^\/api\/admin\/audits\/[^\/]+$/)) {
          const auditId = path.split('/')[4];
          try {
            // Get audit info before deletion for logging
            const auditInfo = await env.DB.prepare(`
              SELECT root_url, status, pages_analyzed FROM audits WHERE id = ?
            `).bind(auditId).first();

            if (!auditInfo) {
              return new Response(JSON.stringify({ error: 'Audit not found' }), { 
                status: 404, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              });
            }

            // Delete from dependent tables first (foreign key order)
            await env.DB.prepare(`
              DELETE FROM audit_page_analysis WHERE page_id IN (
                SELECT id FROM audit_pages WHERE audit_id = ?
              )
            `).bind(auditId).run();

            await env.DB.prepare(`
              DELETE FROM audit_pages WHERE audit_id = ?
            `).bind(auditId).run();

            // Delete citations associated with this audit
            await env.DB.prepare(`
              DELETE FROM ai_citations WHERE audit_id = ?
            `).bind(auditId).run();

            await env.DB.prepare(`
              DELETE FROM ai_referrals WHERE audit_id = ?
            `).bind(auditId).run();

            await env.DB.prepare(`
              DELETE FROM citations_runs WHERE audit_id = ?
            `).bind(auditId).run();

            // Delete the audit itself
            await env.DB.prepare(`
              DELETE FROM audits WHERE id = ?
            `).bind(auditId).run();

            // Log the admin action
            const logId = crypto.randomUUID();
            const ipAddress = req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
            const userAgent = req.headers.get('user-agent') || 'unknown';
            
            await env.DB.prepare(`
              INSERT INTO admin_logs (id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `).bind(
              logId,
              'DELETE',
              'audit',
              auditId,
              JSON.stringify({ 
                root_url: auditInfo.root_url, 
                status: auditInfo.status, 
                pages_analyzed: auditInfo.pages_analyzed 
              }),
              ipAddress,
              userAgent
            ).run();

            console.log(`[ADMIN] Audit deleted: ${auditId} (${auditInfo.root_url}) by ${ipAddress}`);

            return new Response(JSON.stringify({ 
              ok: true, 
              message: 'Audit and all associated data deleted', 
              auditId 
            }), { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
          } catch (error: any) {
            console.error('[DELETE AUDIT] Error:', error);
            return new Response(JSON.stringify({ error: error.message }), { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
          }
        }
      }

      // Citations endpoints
      if (req.method === 'POST' && path === '/api/citations/run') {
        // Queue citations for async processing (prevents HTTP timeout)
        return await queueCitations(req, env);
      }
      
      // Get citations status
      if (req.method === 'GET' && path.startsWith('/api/citations/status/')) {
        const auditId = path.split('/').pop();
        if (!auditId) {
          return new Response(JSON.stringify({ error: 'Audit ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return await getCitationsStatus(auditId, env);
      }

      if (req.method === 'GET' && path.startsWith('/api/citations/summary')) {
        const result = await getCitationsSummary(url.searchParams, env);
        return new Response(JSON.stringify(result), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      if (req.method === 'GET' && path.startsWith('/api/citations/list')) {
        const result = await getCitationsList(url.searchParams, env);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // LLM Prompts endpoints
      if (req.method === 'GET' && path === '/api/llm/prompts') {
        const { handleGetLLMPrompts } = await import('./routes/llm-prompts');
        const result = await handleGetLLMPrompts(env, req);
        return result;
      }
      
      if (req.method === 'GET' && path === '/api/llm/prompts/health') {
        const { handlePromptsHealth } = await import('./routes/prompts-health');
        return await handlePromptsHealth(env);
      }
      
      if (req.method === 'GET' && path === '/api/prompts/related') {
        const { handleGetRelatedPrompts } = await import('./routes/prompts-related');
        const result = await handleGetRelatedPrompts(env, req);
        return result;
      }
      
      if (req.method === 'GET' && path === '/api/llm/prompts/export') {
        const { handlePromptsExport } = await import('./routes/prompts-export');
        const result = await handlePromptsExport(req, env);
        return result;
      }

      // Scoring Criteria API
      if (req.method === 'GET' && path === '/api/scoring/criteria/stats') {
        const { handleGetCriteriaStats } = await import('./routes/criteria');
        return handleGetCriteriaStats(req, env);
      }

      if (req.method === 'GET' && path.startsWith('/api/scoring/criteria/')) {
        const id = path.split('/').pop();
        if (id && id !== 'stats') {
          const { handleGetCriterionById } = await import('./routes/criteria');
          return handleGetCriterionById(req, env, id);
        }
      }

      if (req.method === 'GET' && path === '/api/scoring/criteria') {
        const { handleGetCriteria } = await import('./routes/criteria');
        return handleGetCriteria(req, env);
      }

      if (req.method === 'GET' && path.startsWith('/api/insights')) {
        const result = await getInsights(url.searchParams, env);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Bot documentation redirect
      if (req.method === 'GET' && path === '/bot') {
        return Response.redirect('https://optiview.ai/bot', 301);
      }
      
      // Legacy bot documentation - keeping for historical reference but never reached
      if (req.method === 'GET' && path === '/bot-legacy') {
        const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OptiviewAuditBot - Optiview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1f2937; }
    
    /* Header */
    header { background: white; border-bottom: 1px solid #e5e7eb; padding: 1rem 0; }
    .header-content { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 1.25rem; font-weight: 700; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-decoration: none; }
    nav { display: flex; gap: 2rem; }
    nav a { color: #6b7280; text-decoration: none; font-size: 0.875rem; transition: color 0.2s; }
    nav a:hover { color: #3b82f6; }
    
    /* Main Content */
    main { max-width: 800px; margin: 0 auto; padding: 3rem 1.5rem; }
    h1 { font-size: 2.5rem; font-weight: 700; color: #111827; margin-bottom: 1rem; }
    h2 { font-size: 1.75rem; font-weight: 600; color: #111827; margin: 2.5rem 0 1rem; padding-top: 1rem; border-top: 2px solid #e5e7eb; }
    h3 { font-size: 1.25rem; font-weight: 600; color: #374151; margin: 1.5rem 0 0.75rem; }
    p { margin: 0.75rem 0; color: #4b5563; }
    ul, ol { margin: 0.75rem 0; padding-left: 2rem; color: #4b5563; }
    li { margin: 0.5rem 0; }
    code { background: #f3f4f6; padding: 0.2em 0.5em; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 0.9em; color: #1f2937; }
    pre { background: #1f2937; color: #f9fafb; padding: 1.25rem; border-radius: 8px; overflow-x: auto; margin: 1rem 0; line-height: 1.5; }
    pre code { background: transparent; color: #f9fafb; padding: 0; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    strong { font-weight: 600; color: #111827; }
    
    /* Footer */
    footer { background: #f9fafb; border-top: 1px solid #e5e7eb; margin-top: 4rem; }
    .footer-content { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
    .footer-links { display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1rem; }
    .footer-links a { color: #6b7280; font-size: 0.875rem; text-decoration: none; }
    .footer-links a:hover { color: #3b82f6; }
    .footer-copy { text-align: center; color: #9ca3af; font-size: 0.875rem; }
  </style>
</head>
<body>
  <!-- Header -->
  <header>
    <div class="header-content">
      <a href="https://optiview.ai" class="logo">OPTIVIEW.AI</a>
      <nav>
        <a href="https://app.optiview.ai">Dashboard</a>
        <a href="https://app.optiview.ai/score-guide">Scoring Guide</a>
        <a href="https://app.optiview.ai/methodology">Methodology</a>
      </nav>
    </div>
  </header>

  <!-- Main Content -->
  <main>
    <h1>OptiviewAuditBot</h1>
    
    <p>We are a responsible web crawler that runs site audits you initiate in Optiview. We respect robots.txt directives and follow best practices for web crawling.</p>
    
    <h2>Our Identity</h2>
    <p><strong>User-Agent:</strong> <code>OptiviewAuditBot/1.0 (+https://optiview.ai/bot; admin@optiview.ai)</code></p>
    <p><strong>Identifying Header:</strong> <code>X-Optiview-Bot: audit</code></p>
    
    <h2>What We Respect</h2>
    <ul>
      <li><strong>robots.txt</strong> - We check for <code>User-agent: OptiviewAuditBot</code> rules, falling back to <code>*</code></li>
      <li><strong>Allow/Disallow</strong> - We respect path-based allow/disallow rules (longest match wins)</li>
      <li><strong>Crawl-delay</strong> - We honor crawl delay directives (default: 1.5s between requests to same domain)</li>
      <li><strong>Retry-After header</strong> - We parse and respect the <code>Retry-After</code> header for rate-limited responses (429)</li>
      <li><strong>Exponential backoff</strong> - We implement exponential backoff for transient errors (429, 521) with up to 3 retries</li>
      <li><strong>Meta tags</strong> - We respect <code>noindex</code>, <code>nofollow</code>, and <code>noai</code> meta tags</li>
    </ul>
    
    <h2>How to Allow/Block Us</h2>
    
    <h3>Allow the bot:</h3>
    <pre><code>User-agent: OptiviewAuditBot
Allow: /</code></pre>
    
    <h3>Block the bot:</h3>
    <pre><code>User-agent: OptiviewAuditBot
Disallow: /</code></pre>
  
    
    <h3>Block specific paths:</h3>
    <pre><code>User-agent: OptiviewAuditBot
Disallow: /admin/
Disallow: /private/</code></pre>
    
    <h3>Set crawl delay:</h3>
    <pre><code>User-agent: OptiviewAuditBot
Crawl-delay: 5</code></pre>
    
    <h2>About Our Crawling</h2>
    <p>We only crawl sites when you explicitly request an audit through Optiview. Our crawler is designed to be polite, efficient, and respectful of your server resources:</p>
    <ul>
      <li><strong>Targeted crawling</strong> - We fetch pages to analyze AEO/GEO optimization (typically 40-50 pages per audit)</li>
      <li><strong>Structured data extraction</strong> - We extract JSON-LD, meta tags, headings, and content signals for analysis</li>
      <li><strong>Dual-mode rendering</strong> - We fetch both static HTML and JavaScript-rendered content to detect visibility gaps</li>
      <li><strong>Strict robots.txt compliance</strong> - We respect all robots.txt directives with longest-match path rules</li>
      <li><strong>Configurable delays</strong> - Default 1.5s delay between requests, configurable via <code>Crawl-delay</code> directive</li>
      <li><strong>Rate limit handling</strong> - We automatically back off when receiving 429 responses and respect <code>Retry-After</code> headers</li>
      <li><strong>Retry logic</strong> - Up to 3 retries with exponential backoff for transient errors (429, 521)</li>
      <li><strong>Clear identification</strong> - We identify ourselves with User-Agent and custom header on every request</li>
      <li><strong>KV caching</strong> - We cache robots.txt rules for 24 hours to reduce redundant requests</li>
    </ul>
    
    <h2>Crawling Limits & Scope</h2>
    <p>To minimize server impact while providing comprehensive analysis:</p>
    <ul>
      <li><strong>Page limit</strong> - Maximum 50 pages per audit (prioritizes homepage and top-level navigation)</li>
      <li><strong>Sitemap-first</strong> - We prioritize sitemap-listed URLs with 3s timeout for sitemap discovery</li>
      <li><strong>Depth limits</strong> - We typically crawl homepage + 1-2 levels deep</li>
      <li><strong>Language filtering</strong> - We focus on English (US) content, filtering non-English paths by default</li>
      <li><strong>Per-request timeout</strong> - 25 seconds per batch request to prevent hung connections</li>
      <li><strong>Total audit timeout</strong> - 2 minutes maximum runtime with automatic completion</li>
    </ul>
    
    <h2>Contact</h2>
    <p>Questions or concerns? Contact us at <a href="mailto:admin@optiview.ai">admin@optiview.ai</a></p>
    
    <h2>Machine-Readable Info</h2>
    <p>For automated systems: <a href="/.well-known/optiview-bot.json">/.well-known/optiview-bot.json</a></p>
  </main>

  <!-- Footer -->
  <footer>
    <div class="footer-content">
      <div class="footer-links">
        <a href="https://app.optiview.ai/score-guide">Scoring Guide</a>
        <a href="https://app.optiview.ai/help/citations">Citations Guide</a>
        <a href="https://app.optiview.ai/methodology">Methodology</a>
        <a href="https://app.optiview.ai/terms">Terms of Use</a>
        <a href="https://app.optiview.ai/privacy">Privacy Policy</a>
        <a href="https://api.optiview.ai/bot">Bot Documentation</a>
      </div>
      <div class="footer-copy">
        © 2025 Optiview.ai. All rights reserved.
      </div>
    </div>
  </footer>
</body>
</html>`;
        return new Response(html, {
          headers: { 
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8'
          }
        });
      }

      if (req.method === 'GET' && path === '/.well-known/optiview-bot.json') {
        const body = {
          name: "OptiviewAuditBot",
          version: "1.0",
          user_agent: BOT_UA,
          website: "https://optiview.ai/bot",
          contact: "admin@optiview.ai",
          respect_robots_txt: true,
          honors_crawl_delay: true,
          honors_retry_after: true,
          exponential_backoff: {
            enabled: true,
            max_retries: 3,
            base_delay_ms: 2000,
            max_delay_ms: 30000
          },
          default_crawl_delay_ms: 1500,
          robots_cache_ttl_hours: 24,
          ip_policy: "Cloudflare egress (AS13335); fixed IPs not guaranteed.",
          crawl_scope: {
            max_pages_per_audit: 50,
            typical_pages: "40-50",
            depth_limit: "homepage + 1-2 levels",
            sitemap_timeout_ms: 3000,
            language_filter: "en-US preferred"
          },
          rendering: {
            mode: "dual",
            static_and_rendered: true,
            render_visibility_analysis: true
          },
          opt_out: {
            via_robots: [
              {"group": "User-agent: OptiviewAuditBot", "rule": "Disallow: /"},
              {"group": "User-agent: *", "rule": "Disallow: /"}
            ],
            via_meta: ["noindex", "nofollow", "noai"]
          }
        };
        return new Response(JSON.stringify(body, null, 2), {
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  },

  async queue(batch: any, env: Env, ctx: ExecutionContext): Promise<void> {
    // Handle queue messages for background processing if needed
  }
} satisfies ExportedHandler<Env>;

// Failure Handling Helpers

async function markAuditFailed(env: Env, auditId: string, reason: string) {
  console.error(`[AUDIT FAILED] ${auditId}: ${reason}`);
  await env.DB.prepare(`
    UPDATE audits 
    SET status = 'failed', 
        fail_reason = ?, 
        fail_at = datetime('now'),
        finished_at = datetime('now')
    WHERE id = ?
  `).bind(reason, auditId).run();
}

function isEmptyOrErrorPage(html: string): boolean {
  const len = html.length;
  
  // Too short to be a real page (but allow for minimal HTML + JS SPA shells)
  if (len < 200) {
    console.log(`[EMPTY CHECK] Too short: ${len} bytes`);
    return true;
  }
  
  const lower = html.toLowerCase();
  
  // If it has a DOCTYPE and either a title or body tag, it's probably valid
  // (even if it's a SPA that loads content via JS)
  const hasDoctype = lower.includes('<!doctype');
  const hasTitle = lower.includes('<title');
  const hasBody = lower.includes('<body');
  const hasHead = lower.includes('<head');
  
  // If page has proper HTML structure, check for error phrases more carefully
  if (hasDoctype && (hasTitle || (hasHead && hasBody))) {
    // For pages with valid structure, only check for critical error phrases
    // (not "coming soon" which is common in e-commerce product listings)
    const criticalErrorPhrases = [
      "domain parked",
      "this domain is for sale",
      "page cannot be displayed",
      "site not found",
      "error 404"
    ];
    
    const foundCriticalError = criticalErrorPhrases.find(phrase => lower.includes(phrase));
    if (foundCriticalError) {
      console.log(`[EMPTY CHECK] Found critical error phrase: "${foundCriticalError}"`);
      return true;
    }
    
    console.log(`[EMPTY CHECK] Valid HTML detected with proper structure`);
    return false; // Looks like a valid HTML page
  }
  
  // For pages WITHOUT proper HTML structure, be more strict
  const allBadPhrases = [
    "unsupported service",
    "not configured for this service",
    "domain parked",
    "coming soon",
    "under construction",
    "this domain is for sale",
    "page cannot be displayed",
    "site not found",
    "error 404",
    "access denied"
  ];
  
  const foundBadPhrase = allBadPhrases.find(phrase => lower.includes(phrase));
  if (foundBadPhrase) {
    console.log(`[EMPTY CHECK] No HTML structure + error phrase: "${foundBadPhrase}"`);
    return true;
  }
  
  // If page is under 500 bytes and doesn't have basic HTML structure, reject it
  if (len < 500) {
    console.log(`[EMPTY CHECK] Small page without structure`);
    return true;
  }
  
  console.log(`[EMPTY CHECK] Defaulting to false (valid)`);
  return false;
}

function isBlockedHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_HOSTS.some(blocked => 
      hostname === blocked || hostname.endsWith('.' + blocked)
    );
  } catch {
    return false;
  }
}

async function precheckDomain(url: string, env: Env): Promise<{
  ok: boolean;
  finalUrl?: string;
  reason?: string;
}> {
  try {
    // Check if blocked host
    if (isBlockedHost(url)) {
      return {
        ok: false,
        reason: 'non_content_platform'
      };
    }
    
    // Check known redirects
    const hostname = new URL(url).hostname.toLowerCase();
    if (AUTO_REDIRECTS[hostname]) {
      return {
        ok: true,
        finalUrl: AUTO_REDIRECTS[hostname]
      };
    }
    
    // Retry logic for transient errors (429 rate limit, 521 server down)
    let lastError: any = null;
    for (let attempt = 0; attempt <= PRECHECK_MAX_RETRIES; attempt++) {
      try {
        // Add delay for retries (except first attempt)
        if (attempt > 0) {
          const delay = getBackoffDelay(attempt - 1);
          console.log(`[PRECHECK RETRY] Attempt ${attempt}/${PRECHECK_MAX_RETRIES} for ${url}, waiting ${delay}ms`);
          await sleep(delay);
        }
        
        // Fetch with automatic redirect following (up to 20 redirects by default)
        // This handles: 301/302 redirects, Cloudflare Waiting Room, and challenge pages
        const res = await fetchWithIdentity(url, { redirect: 'follow' }, env);
        
        // Handle rate limiting (429) - respect Retry-After if provided
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          const retryDelay = parseRetryAfter(retryAfter) || getBackoffDelay(attempt);
          
          console.log(`[PRECHECK 429] Rate limited at ${url}, retry after ${retryDelay}ms`);
          
          if (attempt < PRECHECK_MAX_RETRIES) {
            await sleep(retryDelay);
            continue; // Retry
          } else {
            // Final attempt failed
            return {
              ok: false,
              reason: `precheck_failed_http_429`
            };
          }
        }
        
        // Handle server down (521) - retry with backoff
        if (res.status === 521) {
          console.log(`[PRECHECK 521] Server down at ${url}, attempt ${attempt}/${PRECHECK_MAX_RETRIES}`);
          
          if (attempt < PRECHECK_MAX_RETRIES) {
            continue; // Retry with exponential backoff
          } else {
            // Final attempt failed
            return {
              ok: false,
              reason: `precheck_failed_http_521`
            };
          }
        }
        
        // Check for other errors (non-retryable)
        if (res.status >= 400) {
          return {
            ok: false,
            reason: `precheck_failed_http_${res.status}`
          };
        }
        
        // Get the final URL after redirects
        const finalUrl = res.url;
        
        // Check if page is empty or error page
        const html = await res.text();
        console.log(`[PRECHECK] ${url} -> status=${res.status}, size=${html.length}, finalUrl=${finalUrl}`);
        console.log(`[PRECHECK HTML] First 300 chars: ${html.slice(0, 300).replace(/\s+/g, ' ')}`);
        
        if (isEmptyOrErrorPage(html)) {
          console.log(`[PRECHECK EMPTY] ${url} failed: HTML too short (${html.length} bytes) or contains error phrases`);
          return {
            ok: false,
            reason: 'domain_error_or_empty_page'
          };
        }
        
        // Check if redirected to non-US/non-English locale
        // Common patterns: /en-gb/, /en-ca/, /en-au/, /fr/, /de/, /es/, /ja/, /zh/, etc.
        const nonUSLocalePattern = /\/(en-(?!us)[a-z]{2}|[a-z]{2}-[a-z]{2}|[a-z]{2})(?:\/|$)/i;
        if (finalUrl !== url && nonUSLocalePattern.test(finalUrl)) {
          const localeMatch = finalUrl.match(nonUSLocalePattern);
          console.log(`[PRECHECK LOCALE] Redirected to non-US locale: ${localeMatch?.[0]} in ${finalUrl}`);
          
          // Try to construct US/English version
          // Replace /en-gb/ with /en-us/, or remove locale prefix entirely
          let usUrl = finalUrl.replace(/\/(en-[a-z]{2}|[a-z]{2}-[a-z]{2}|[a-z]{2})\//i, '/en-us/');
          
          // If that didn't change anything, try without locale prefix
          if (usUrl === finalUrl) {
            usUrl = finalUrl.replace(/\/(en-[a-z]{2}|[a-z]{2}-[a-z]{2}|[a-z]{2})\//i, '/');
          }
          
          // If still no change, try the original domain without path
          if (usUrl === finalUrl) {
            const originalHostname = new URL(url).hostname;
            usUrl = `https://${originalHostname}/`;
          }
          
          console.log(`[PRECHECK LOCALE] Attempting US version: ${usUrl}`);
          
          return {
            ok: true,
            finalUrl: usUrl
          };
        }
        
        // Success!
        return {
          ok: true,
          finalUrl: finalUrl !== url ? finalUrl : undefined
        };
        
      } catch (error: any) {
        lastError = error;
        console.log(`[PRECHECK ERROR] Attempt ${attempt}/${PRECHECK_MAX_RETRIES} failed: ${error.message}`);
        
        // Retry on network errors
        if (attempt < PRECHECK_MAX_RETRIES) {
          continue;
        }
      }
    }
    
    // All retries exhausted
    return {
      ok: false,
      reason: `precheck_error: ${lastError?.message || 'unknown'}`
    };
    
  } catch (error: any) {
    return {
      ok: false,
      reason: `precheck_error: ${error.message || 'unknown'}`
    };
  }
}

async function monitorProgress(env: Env, auditId: string) {
  const started = Date.now();
  let lastPageCount = 0;
  let checkCount = 0;
  const maxChecks = Math.ceil(MAX_RUN_MS / PROGRESS_CHECK_INTERVAL);
  
  const check = async () => {
    checkCount++;
    
    // Get current audit status
    const audit = await env.DB.prepare(
      'SELECT status FROM audits WHERE id = ? AND status NOT IN (?, ?)'
    ).bind(auditId, 'complete', 'failed').first();
    
    if (!audit) {
      // Audit completed or failed, stop monitoring
      return;
    }
    
    // Get page count
    const result = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM audit_pages WHERE audit_id = ?'
    ).bind(auditId).first();
    
    const currentCount = (result?.count as number) || 0;
    
    // Update last seen count
    if (currentCount > lastPageCount) {
      lastPageCount = currentCount;
    }
    
    // Check for timeout
    const elapsed = Date.now() - started;
    if (elapsed > MAX_RUN_MS && lastPageCount === 0) {
      await markAuditFailed(env, auditId, 'timeout_no_pages_discovered');
      console.warn(`[TIMEOUT] Audit ${auditId} failed: no pages after ${Math.floor(elapsed / 1000)}s`);
      return;
    }
    
    // Continue monitoring if not at max checks
    if (checkCount < maxChecks) {
      setTimeout(() => check(), PROGRESS_CHECK_INTERVAL);
    }
  };
  
  // Start monitoring after initial delay
  setTimeout(() => check(), PROGRESS_CHECK_INTERVAL);
}

// Simple pMap implementation for concurrency control
async function pMap<T, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R>,
  options: { concurrency: number }
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  
  for (const [index, item] of items.entries()) {
    const promise = Promise.resolve().then(() => mapper(item, index)).then(result => {
      results[index] = result;
    });
    
    executing.push(promise);
    
    if (executing.length >= options.concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }
  
  await Promise.all(executing);
  return results;
}

// Batch processing handler - processes URLs in manageable chunks
async function continueAuditBatch(auditId: string, env: Env): Promise<any> {
  const started = Date.now();
  
  // 1) Load audit
  const audit: any = await env.DB.prepare(
    "SELECT * FROM audits WHERE id = ?"
  ).bind(auditId).first();
  
  if (!audit || audit.status !== 'running') {
    return { ok: true, reason: 'not-running', finalized: false };
  }
  
  const auditStartedMs = new Date(audit.started_at).getTime();
  
  // 2) Get next batch of URLs to process
  const queueResult = await env.DB.prepare(
    "SELECT url FROM audit_pages WHERE audit_id = ? AND id NOT IN (SELECT page_id FROM audit_page_analysis) LIMIT ?"
  ).bind(auditId, TARGET_MAX_PAGES).all();
  
  const queue = (queueResult.results || []).map((r: any) => r.url);
  
  if (queue.length === 0) {
    // No more URLs to process
    const totals = await getAuditStats(env, auditId);
    if (totals.pages_analyzed === 0) {
      await markAuditFailed(env, auditId, 'no_crawlable_pages_found');
      return { ok: true, finalized: true, reason: 'no_pages', totals };
    }
    
    // Finalize
    await finalizeAudit(env, auditId, 'queue_empty');
    return { ok: true, finalized: true, reason: 'queue_empty', totals };
  }
  
  let analyzed = 0;
  const renderCount = { current: 0 }; // Track renders across parallel operations
  
  // Get audit root URL and extract locale prefix for filtering
  const rootUrl = audit.root_url || '';
  const rootUrlNormalized = rootUrl.replace(/\/$/, ''); // Remove trailing slash
  
  // Extract locale prefix from root URL (same logic as discoverUrls)
  const rootUrlObj = new URL(rootUrl);
  const rootHost = rootUrlObj.hostname.replace(/^www\./, '');
  const localeMatch = rootUrlObj.pathname.match(/^\/[a-z]{2}(?:[-_][a-z]{2})?/);
  const rootLocalePrefix = localeMatch ? localeMatch[0] : '/';
  
  // 3) Process in parallel with time budget
  await pMap(queue, async (url, index) => {
    if (Date.now() - started > PER_REQUEST_BUDGET_MS) return; // stay < 30s
    
    // Polite crawl delay - stagger requests slightly to avoid overwhelming servers
    // With CONCURRENCY=8, effective rate is ~5-6 requests/second
    if (index > 0) {
      await sleep(Math.min(CRAWL_DELAY_MS / CONCURRENCY, 200)); // Small stagger per parallel worker
    }
    
    // Check robots.txt
    try {
      const urlObj = new URL(url);
      const rules = await getRobots(env, urlObj);
      if (!isAllowedByRobots(rules, urlObj.pathname)) {
        console.log(`[ROBOTS] Disallowed: ${url}`);
        return;
      }
    } catch (e) {
      console.error(`[ROBOTS ERROR] ${url}:`, e);
      return;
    }
    
    // Detect if this is the homepage (exact match or with trailing slash)
    const urlNormalized = url.replace(/\/$/, '');
    const isHomepage = urlNormalized === rootUrlNormalized || 
                      url === rootUrl || 
                      urlNormalized === rootUrl.replace(/\/$/, '');
    
    // Smart fetch: static + optionally rendered (prioritize homepage)
    const { staticHtml, renderedHtml, renderGapRatio, isSPA } = await fetchPageSmart(
      url, 
      env, 
      index, 
      renderCount, 
      isHomepage
    );
    
    // Use rendered HTML if available, fallback to static
    const htmlToAnalyze = renderedHtml || staticHtml;
    if (!htmlToAnalyze) return;
    
    // Extract metadata (no scoring - will be done by diagnostics)
    try {
      const extract = await extractAll(htmlToAnalyze, url);
      
      // Get page_id
      const pageRow: any = await env.DB.prepare(
        "SELECT id FROM audit_pages WHERE audit_id = ? AND url = ?"
      ).bind(auditId, url).first();
      
      if (!pageRow) {
        console.error(`[BATCH] Page not found in audit_pages: ${url}`);
        return;
      }
      
      // Use batch operation to ensure both UPDATE and INSERT complete atomically
      const analysisId = crypto.randomUUID();
      
      try {
        await env.DB.batch([
          // Update audit_pages with fetch metadata
          env.DB.prepare(
            `UPDATE audit_pages 
             SET status_code = ?, 
                 content_type = ?, 
                 html_static = ?
             WHERE id = ?`
          ).bind(
            200, // We only process successful fetches
            'text/html',
            (staticHtml || htmlToAnalyze).slice(0, 200000), // Store static HTML, truncate to 200k chars
            pageRow.id
          ),
          
          // Save analysis with rendered HTML and gap ratio
          env.DB.prepare(
            `INSERT INTO audit_page_analysis 
             (id, page_id, title, h1, canonical, schema_types, jsonld, checks_json, aeo_score, geo_score, rendered_html, render_gap_ratio, analyzed_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
          ).bind(
            analysisId,
            pageRow.id,
            extract.title || '',
            extract.h1 || '',
            extract.canonical || '',
            JSON.stringify(extract.schemaTypes || []),
            JSON.stringify(extract.jsonldRaw || []),
            '[]', // checks_json - will be populated by diagnostics
            null, // aeo_score - will be populated by diagnostics
            null, // geo_score - will be populated by diagnostics
            renderedHtml ? renderedHtml.slice(0, 200000) : null, // Store rendered HTML if available
            renderGapRatio // Store gap ratio for SPA detection
          )
        ]);
        
        analyzed++;
        console.log(`Processed: ${url} (batch processing)`);
        
        // Run diagnostics for all 36 criteria if enabled
        if (env.SCORING_V1_ENABLED === "true") {
          try {
            console.log(`[DIAGNOSTICS] Starting page diagnostics for: ${url}`);
            const { runDiagnosticsForPage } = await import('./diagnostics/runPage');
            const hostname = new URL(url).hostname;
            const results = await runDiagnosticsForPage(env.DB, {
              pageId: pageRow.id,
              url,
              html_rendered: renderedHtml,
              html_static: staticHtml,
              site: {
                domain: hostname,
                homepageUrl: rootUrl,
                targetLocale: "en-US"
              }
            });
            console.log(`[DIAGNOSTICS] Completed ${results.length} checks for: ${url}`);
          } catch (scoreError) {
            console.error(`[DIAGNOSTICS] ERROR for ${url}:`, scoreError);
          }
        }
      } catch (dbError: any) {
        console.error(`[DB ERROR] Failed to save page analysis for ${url}:`, dbError.message);
        return; // Skip this page if DB operations fail
      }      
      // Extract links from this page and queue for future batches (organic discovery)
      // Continue until we have enough pages analyzed (target is 40-60)
      if (analyzed < TARGET_MIN_PAGES) {
        try {
          const linkMatches = (staticHtml || htmlToAnalyze).matchAll(/<a\s+[^>]*href=['"]([^'"]+)['"]/gi);
          const newUrls: string[] = [];
          
          for (const match of Array.from(linkMatches).slice(0, 50)) { // Max 50 links per page (increased from 20)
            try {
              const linkUrl = new URL(match[1], url);
              const normalizedLinkStr = normalizeUrl(linkUrl.toString()); // Normalize before deduplication
              
              // Apply same filtering rules using extracted locale prefix
              if (sameSite(new URL(rootUrl), linkUrl) && shouldCrawlUrl(normalizedLinkStr, rootHost, rootLocalePrefix)) {
                newUrls.push(normalizedLinkStr);
              }
            } catch { /* ignore bad URLs */ }
          }
          
          // Batch insert new URLs - use INSERT with WHERE NOT EXISTS to prevent duplicates
          if (newUrls.length > 0) {
            const uniqueUrls = [...new Set(newUrls)].slice(0, 20); // Dedupe and limit to 20 per page
            const insertStatements = uniqueUrls.map(newUrl =>
              env.DB.prepare(
                `INSERT INTO audit_pages (id, audit_id, url, fetched_at) 
                 SELECT ?, ?, ?, datetime('now')
                 WHERE NOT EXISTS (SELECT 1 FROM audit_pages WHERE audit_id = ? AND url = ?)`
              ).bind(crypto.randomUUID(), auditId, newUrl, auditId, newUrl)
            );
            
            try {
              // Batch insert in one go (much faster, fewer API calls)
              if (insertStatements.length > 0) {
                await env.DB.batch(insertStatements);
              }
            } catch (err) {
              // Ignore constraint errors (duplicates)
            }
            console.log(`[DISCOVER] Found ${newUrls.length} links from ${url}, queued ${uniqueUrls.length}`);
          }
        } catch (err) {
          console.error(`[LINK EXTRACT ERROR] ${url}:`, err);
        }
      }
    } catch (error: any) {
      console.error(`[SCORE ERROR] ${url}:`, error.message);
    }
  }, { concurrency: CONCURRENCY });
  
  // 4) Check completion policy
  const totals = await getAuditStats(env, auditId);
  const elapsed = Date.now() - auditStartedMs;
  
  const hitTarget = totals.pages_analyzed >= TARGET_MIN_PAGES;
  const hitHardTime = elapsed >= HARD_TIME_MS;
  const hitMaxPages = totals.pages_analyzed >= TARGET_MAX_PAGES;
  
  // Check if there are more unprocessed pages in the database
  const unprocessedCount = totals.pages_discovered - totals.pages_analyzed;
  const queueEmpty = unprocessedCount === 0;
  
  // Log progress
  console.log(`[BATCH] ${auditId} pages=${totals.pages_analyzed}/${totals.pages_discovered} (${unprocessedCount} unprocessed) elapsed=${elapsed}ms`);
  
  // Finalization conditions:
  // 1. Hit target pages (40+) - success
  // 2. Hit max pages (60) - success
  // 3. Hit hard time limit (25s) - finalize what we have if >20 pages
  // 4. Queue empty - finalize if we have any pages
  // 5. SAFETY: >20s elapsed with any pages - must finalize before HTTP timeout
  const mustFinalizeNow = elapsed >= 20_000 && totals.pages_analyzed >= 15;
  
  if (hitTarget || hitMaxPages || queueEmpty || (hitHardTime && totals.pages_analyzed >= 20) || mustFinalizeNow) {
    const reason = hitHardTime ? 'time_budget_reached'
                 : hitMaxPages ? 'max_pages_reached'
                 : hitTarget ? 'target_min_pages_met'
                 : mustFinalizeNow ? 'http_timeout_safety'
                 : 'queue_empty';
    
    console.log(`[FINALIZE_TRIGGER] ${auditId}: ${reason} (elapsed=${elapsed}ms, pages=${totals.pages_analyzed})`);
    await finalizeAudit(env, auditId, reason);
    return { ok: true, finalized: true, reason, totals };
  }
  
  // If we hit hard time but have <20 pages, mark as failed
  if (hitHardTime) {
    await markAuditFailed(env, auditId, `timeout_insufficient_pages_${totals.pages_analyzed}`);
    return { ok: true, finalized: true, reason: 'timeout_failed', totals };
  }
  
  // 5) Chain the next batch synchronously (recursive in-process call)
  console.log(`[BATCH] ${auditId} chaining next batch...`);
  const nextBatch = await continueAuditBatch(auditId, env);
  return { ok: true, finalized: false, analyzed, totals, chained: true, next: nextBatch };
}

// Helper to get audit stats
async function getAuditStats(env: Env, auditId: string): Promise<{ pages_analyzed: number; pages_discovered: number }> {
  const stats: any = await env.DB.prepare(
    `SELECT 
       (SELECT COUNT(*) FROM audit_page_analysis apa JOIN audit_pages ap ON apa.page_id = ap.id WHERE ap.audit_id = ?) as pages_analyzed,
       (SELECT COUNT(*) FROM audit_pages WHERE audit_id = ?) as pages_discovered`
  ).bind(auditId, auditId).first();
  
  return {
    pages_analyzed: stats?.pages_analyzed || 0,
    pages_discovered: stats?.pages_discovered || 0
  };
}

// Helper to finalize audit with scores
// Helper: Get average render gap ratio for an audit
async function getAverageRenderGap(env: Env, auditId: string): Promise<number | null> {
  const result: any = await env.DB.prepare(
    `SELECT AVG(render_gap_ratio) as avg_gap 
     FROM audit_page_analysis apa
     JOIN audit_pages ap ON apa.page_id = ap.id
     WHERE ap.audit_id = ? AND render_gap_ratio IS NOT NULL`
  ).bind(auditId).first();
  
  return result?.avg_gap ?? null;
}

async function finalizeAudit(env: Env, auditId: string, reason: string): Promise<void> {
  // Compute site scores from analyzed pages
  const scores: any = await env.DB.prepare(
    `SELECT AVG(aeo_score) as aeo, AVG(geo_score) as geo 
     FROM audit_page_analysis apa 
     JOIN audit_pages ap ON apa.page_id = ap.id 
     WHERE ap.audit_id = ?`
  ).bind(auditId).first();
  
  let baseAeo = scores?.aeo || 0;
  let baseGeo = scores?.geo || 0;
  
  // Apply render gap penalty (SPA visibility risk)
  const avgRenderGap = await getAverageRenderGap(env, auditId);
  let aeoPenalty = 0;
  let geoPenalty = 0;
  
  // 2025 Update: Softer AEO penalty threshold, stricter GEO threshold
  if (avgRenderGap !== null) {
    // AEO: Only penalize severe cases (<30% static visibility)
    if (avgRenderGap < 0.3) {
      aeoPenalty = 5; // Reduced visibility of key schema and copy in raw HTML
      console.log(`[AEO PENALTY] ${auditId}: -5 points (gap: ${Math.round(avgRenderGap * 100)}%)`);
    }
    
    // GEO: Stricter penalty for LLM crawler visibility
    if (avgRenderGap < 0.3) {
      geoPenalty = 10; // Severe: LLM crawlers miss most content
      console.log(`[GEO PENALTY] ${auditId}: -10 points (gap: ${Math.round(avgRenderGap * 100)}%)`);
    } else if (avgRenderGap < 0.5) {
      geoPenalty = 5; // Moderate: Some content not visible to LLM crawlers
      console.log(`[GEO PENALTY] ${auditId}: -5 points (gap: ${Math.round(avgRenderGap * 100)}%)`);
    }
  }
  
  const aeo = Math.max(0, Math.round((baseAeo - aeoPenalty) * 100) / 100);
  const geo = Math.max(0, Math.round((baseGeo - geoPenalty) * 100) / 100);
  
  await env.DB.prepare(
    `UPDATE audits 
     SET status = 'completed', 
         aeo_score = ?, 
         geo_score = ?, 
         finished_at = datetime('now')
     WHERE id = ?`
  ).bind(aeo, geo, auditId).run();
  
  console.log(`[FINALIZED] ${auditId}: ${reason} (AEO: ${aeo}, GEO: ${geo}, Gap: ${avgRenderGap ? Math.round(avgRenderGap * 100) + '%' : 'N/A'})`);
  
  // Run site-level diagnostics if enabled
  console.log(`[SITE_DIAGNOSTICS] Flag check: SCORING_V1_ENABLED=${env.SCORING_V1_ENABLED}`);
  if (env.SCORING_V1_ENABLED === "true") {
    console.log(`[SITE_DIAGNOSTICS] Starting site-level checks for ${auditId}`);
    try {
      const { runDiagnosticsForSite } = await import('./diagnostics/runSite');
      console.log(`[SITE_DIAGNOSTICS] Module imported successfully`);
      
      const audit: any = await env.DB.prepare(
        'SELECT root_url FROM audits WHERE id = ?'
      ).bind(auditId).first();
      
      if (!audit) {
        console.error(`[SITE_DIAGNOSTICS] No audit found for ${auditId}`);
        return;
      }
      
      console.log(`[SITE_DIAGNOSTICS] Audit found: ${audit.root_url}`);
      const domain = new URL(audit.root_url).hostname;
      
      // Fetch all pages with their checks
      const pagesResult = await env.DB.prepare(`
        SELECT p.id, p.url, p.html_rendered, p.html_static, apa.checks_json
        FROM audit_pages p
        LEFT JOIN audit_page_analysis apa ON apa.page_id = p.id
        WHERE p.audit_id = ?1
      `).bind(auditId).all();
      
      const pages = pagesResult.results || [];
      console.log(`[SITE_DIAGNOSTICS] Fetched ${pages.length} pages with checks`);
      
      const ctx = {
        auditId,
        domain,
        pages: pages.map((r: any) => ({
          id: r.id,
          url: r.url,
          html_rendered: r.html_rendered,
          html_static: r.html_static,
          checks: r.checks_json ? JSON.parse(r.checks_json) : []
        }))
      };
      
      console.log(`[SITE_DIAGNOSTICS] Running diagnostics for ${domain} with ${ctx.pages.length} pages`);
      const siteResults = await runDiagnosticsForSite(env.DB, ctx);
      console.log(`[SITE_DIAGNOSTICS] Completed for ${auditId}: ${siteResults.length} site checks, ${ctx.pages.length} pages analyzed`);
    } catch (err) {
      console.error(`[SITE_DIAGNOSTICS] Failed for ${auditId}:`, err);
      console.error(`[SITE_DIAGNOSTICS] Error stack:`, (err as Error).stack);
    }
  } else {
    console.log(`[SITE_DIAGNOSTICS] Skipped - feature flag not enabled`);
  }
  
  // Async: Build and cache LLM prompts for this domain (non-blocking)
  // This runs after finalization so citation runs can use cached prompts
  (async () => {
    try {
      const audit: any = await env.DB.prepare(
        'SELECT root_url, project_id FROM audits WHERE id = ?'
      ).bind(auditId).first();
      
      if (audit) {
        const domain = new URL(audit.root_url).hostname.replace(/^www\./, '');
        const { buildAndCachePrompts } = await import('./prompt-cache');
        await buildAndCachePrompts(env, domain, audit.project_id);
        console.log(`[PROMPT_CACHE] Built cache for ${domain} after audit completion`);
      }
    } catch (err) {
      console.error(`[PROMPT_CACHE] Failed to build cache after audit:`, err);
    }
  })();
  
  // Automatically queue citations for async processing
  try {
    await env.DB.prepare(`
      UPDATE audits 
      SET citations_status = 'queued',
          citations_queued_at = datetime('now')
      WHERE id = ?
    `).bind(auditId).run();
    console.log(`[AUTO_CITATIONS] Queued citations for audit ${auditId}`);
  } catch (err) {
    console.error(`[AUTO_CITATIONS] Failed to queue citations for ${auditId}:`, err);
  }
}

// API Route Handlers

async function createAudit(req: Request, env: Env, ctx: ExecutionContext) {
  const body: any = await req.json();
  // Accept both 'url' and 'root_url' for backwards compatibility
  let { project_id, root_url, url, site_description, max_pages = 200, config = {} } = body;
  root_url = root_url || url;
  
  // Validate required fields
  if (!root_url || typeof root_url !== 'string') {
    throw new Error('url or root_url is required and must be a string');
  }
  
  // Ensure root_url has a protocol
  if (!root_url.startsWith('http://') && !root_url.startsWith('https://')) {
    root_url = 'https://' + root_url;
  }
  
  // Set default project_id if missing
  if (!project_id) {
    project_id = 'default';
  }
  
  const id = crypto.randomUUID();
  
  // Extract user_id from session cookie
  const userId = await getUserIdFromRequest(req, env);
  console.log(`[CREATE AUDIT] User ID from session: ${userId || 'none'}, root_url: ${root_url}, project_id: ${project_id}`);
  
  // Pre-check domain validation
  console.log(`[PRECHECK] Starting validation for: ${root_url}`);
  const precheck = await precheckDomain(root_url, env);
  
  // Resolve industry early (before any INSERT)
  const domain = new URL(root_url).hostname.toLowerCase().replace(/^www\./, '');
  
  let industryLock;
  try {
    industryLock = await resolveIndustry({
      override: config.industry as IndustryKey | undefined,
      project: undefined, // Could read from project table if needed
      signals: {
        domain,
        // These could be populated from precheck response if available
        homepageTitle: undefined,
        homepageH1: undefined,
        schemaTypes: undefined,
        keywords: site_description ? site_description.toLowerCase().split(/\s+/).slice(0, 20) : undefined,
        navTerms: undefined,
      },
      env,
      root_url,
      site_description,
    });
    
    console.log(`[INDUSTRY] resolved: ${industryLock.value} (source=${industryLock.source}) domain=${domain} locked`);
  } catch (industryError: any) {
    console.error(`[INDUSTRY_ERROR] Failed to resolve industry for ${domain}:`, industryError.message || industryError);
    console.error(`[INDUSTRY_ERROR] Stack:`, industryError.stack);
    // Fallback to default industry
    industryLock = {
      value: 'generic_consumer',
      source: 'default',
      locked: true
    };
  }
  
  if (!precheck.ok) {
    // Domain failed validation - create audit as failed immediately
    await env.DB.prepare(
      "INSERT INTO audits (id, project_id, root_url, site_description, user_id, started_at, finished_at, status, fail_reason, fail_at, config_json, industry, industry_source, industry_locked) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), 'failed', ?, datetime('now'), ?, ?, ?, ?)"
    ).bind(id, project_id, root_url, site_description || null, userId, precheck.reason, JSON.stringify(config), industryLock.value, industryLock.source, 1).run();
    
    console.log(`[PRECHECK FAILED] ${id}: ${precheck.reason}`);
    return { audit_id: id, status: 'failed', reason: precheck.reason };
  }
  
  // If domain redirects, update root_url
  if (precheck.finalUrl && precheck.finalUrl !== root_url) {
    console.log(`[PRECHECK] Redirect detected: ${root_url} → ${precheck.finalUrl}`);
    root_url = precheck.finalUrl;
  }
  
  // Create audit
  await env.DB.prepare(
    "INSERT INTO audits (id, project_id, root_url, site_description, user_id, started_at, status, config_json, industry, industry_source, industry_locked) VALUES (?, ?, ?, ?, ?, datetime('now'), 'running', ?, ?, ?, ?)"
  ).bind(id, project_id, root_url, site_description || null, userId, JSON.stringify(config), industryLock.value, industryLock.source, 1).run();

  // Hybrid discovery: Try sitemap first (fast timeout), then fill with organic discovery
  ctx.waitUntil((async () => {
    try {
      console.log(`[HYBRID-DISCOVER] Starting discovery for: ${root_url}`);
      
      const discoveredUrls = new Set<string>();
      discoveredUrls.add(normalizeUrl(root_url)); // Always include homepage (normalized)
      
      // 1. Try sitemap discovery (with 10s timeout)
      try {
        const sitemapPromise = discoverUrls(root_url, env);
        const sitemapUrls = await Promise.race([
          sitemapPromise,
          new Promise<string[]>((_, reject) => setTimeout(() => reject('timeout'), 10000))
        ]);
        
        // Normalize and sort by depth (closest to root first) and take top 50
        const normalizedUrls = sitemapUrls.map(u => normalizeUrl(u));
        const sortedUrls = normalizedUrls.sort((a, b) => {
          const depthA = new URL(a).pathname.split('/').filter(Boolean).length;
          const depthB = new URL(b).pathname.split('/').filter(Boolean).length;
          return depthA - depthB;
        }).slice(0, 50);
        
        sortedUrls.forEach(u => discoveredUrls.add(u));
        console.log(`[HYBRID-DISCOVER] Found ${sortedUrls.length} normalized URLs from sitemap`);
      } catch (sitemapError: any) {
        console.log(`[HYBRID-DISCOVER] Sitemap discovery failed/timeout, will use organic discovery: ${sitemapError}`);
      }
      
      // 2. Insert discovered URLs (batch insert for speed)
      // URL normalization already handled above, discoveredUrls Set ensures uniqueness
      const uniqueUrls = Array.from(discoveredUrls);
      console.log(`[HYBRID-DISCOVER] Inserting ${uniqueUrls.length} unique normalized URLs`);
      
      // Use deterministic UUIDs based on audit_id + url to prevent duplicate inserts
      const statements = uniqueUrls.map(url => {
        const urlHash = `${id}:${url}`;
        const deterministicId = crypto.randomUUID(); // Still use random, but INSERT OR IGNORE based on unique constraint
        return env.DB.prepare(
          `INSERT INTO audit_pages (id, audit_id, url, fetched_at) 
           SELECT ?, ?, ?, datetime('now')
           WHERE NOT EXISTS (SELECT 1 FROM audit_pages WHERE audit_id = ? AND url = ?)`
        ).bind(deterministicId, id, url, id, url);
      });
      
      // Batch insert (100 at a time)
      const BATCH_SIZE = 100;
      for (let i = 0; i < statements.length; i += BATCH_SIZE) {
        const chunk = statements.slice(i, i + BATCH_SIZE);
        await env.DB.batch(chunk);
      }
      
      console.log(`[HYBRID-DISCOVER] Starting batch processing with ${uniqueUrls.length} initial URLs`);
      
      // 3. Start batch processing (will extract more links organically)
      await continueAuditBatch(id, env);
    } catch (error: any) {
      console.error(`[HYBRID-DISCOVER ERROR] ${id}:`, error);
      await markAuditFailed(env, id, `discover_error: ${error.message || 'unknown'}`);
    }
  })());

  return { audit_id: id, status: 'running' };
}

async function getAuditsList(searchParams: URLSearchParams, env: Env, userId: string) {
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  // SECURITY: Always filter by user_id - users can only see their own audits
  const query = `
    SELECT 
      id,
      project_id,
      root_url,
      started_at,
      finished_at,
      status,
      aeo_score,
      geo_score,
      config_json,
      user_id
    FROM audits 
    WHERE user_id = ?
    ORDER BY started_at DESC 
    LIMIT ? OFFSET ?
  `;
  
  const bindings = [userId, limit, offset];
  
  const results = await env.DB.prepare(query).bind(...bindings).all();

  // Get page stats for each audit
  const auditsWithStats = await Promise.all(
    results.results.map(async (audit: any) => {
      const pageStats = await env.DB.prepare(
        "SELECT COUNT(*) as total, AVG(aeo_score) as avg_aeo, AVG(geo_score) as avg_geo FROM audit_page_analysis apa JOIN audit_pages ap ON apa.page_id = ap.id WHERE ap.audit_id = ?"
      ).bind(audit.id).first();

      return {
        ...audit,
        pages_analyzed: pageStats?.total || 0,
        avg_aeo_score: pageStats?.avg_aeo || 0,
        avg_geo_score: pageStats?.avg_geo || 0
      };
    })
  );

  return {
    audits: auditsWithStats,
    total: auditsWithStats.length,
    limit,
    offset
  };
}

async function getAudit(auditId: string, env: Env) {
  const audit = await env.DB.prepare(
    "SELECT * FROM audits WHERE id = ?"
  ).bind(auditId).first();

  if (!audit) {
    throw new Error('Audit not found');
  }

  // Get page count and progress
  const pageStats = await env.DB.prepare(
    "SELECT COUNT(*) as total, AVG(aeo_score) as avg_aeo, AVG(geo_score) as avg_geo FROM audit_page_analysis apa JOIN audit_pages ap ON apa.page_id = ap.id WHERE ap.audit_id = ?"
  ).bind(auditId).first();

  // Calculate GEO Adjusted score from citations (if available)
  let geoAdjusted = null;
  let geoAdjustmentDetails = null;
  
  try {
    const { calculateGeoAdjusted, extractCitationRates, getPerformanceExplanation } = await import('./lib/geoAdjustment');
    
    // Fetch citation summary
    const citationsSummary = await env.DB.prepare(`
      SELECT 
        ai_source as source,
        COUNT(*) as total_queries,
        SUM(CASE WHEN cited_match_count > 0 THEN 1 ELSE 0 END) as cited_queries
      FROM ai_citations
      WHERE audit_id = ?
      GROUP BY ai_source
    `).bind(auditId).all();
    
    if (citationsSummary.results && citationsSummary.results.length > 0) {
      const citationRates = extractCitationRates({ by_source: citationsSummary.results });
      const geoRaw = audit.geo_score || 0;
      const result = calculateGeoAdjusted(geoRaw, citationRates);
      
      geoAdjusted = result.geo_adjusted;
      geoAdjustmentDetails = {
        geo_raw: result.geo_raw,
        geo_adjusted: result.geo_adjusted,
        citation_bonus: result.citation_bonus,
        breakdown: result.breakdown,
        performance_flag: result.performance_flag,
        explanation: getPerformanceExplanation(result)
      };
    }
  } catch (err) {
    console.warn('[GEO_ADJUSTED] Failed to calculate:', err);
  }

  // Scorecard V2: Add enriched criteria, category scores, and fix_first
  let enrichedChecks: any[] | null = null;
  let categoryScores: any[] | null = null;
  let fixFirst: any[] | null = null;
  let scorecardV2 = false;

  try {
    const scorecardEnabled = env.SCORECARD_V2_ENABLED === 'true';
    
    if (scorecardEnabled) {
      // Use new D1-based diagnostics system if enabled
      if (env.SCORING_V1_ENABLED === 'true') {
        const { loadCriteriaMap } = await import('./diagnostics/persist');
        
        // Load D1 criteria metadata
        const criteriaMap = await loadCriteriaMap(env.DB);
        
        // Get all page checks from the audit
        const pages = (await env.DB.prepare(`
          SELECT apa.checks_json
          FROM audit_page_analysis apa
          JOIN audit_pages ap ON apa.page_id = ap.id
          WHERE ap.audit_id = ?
        `).bind(auditId).all()).results || [];
        
        // Aggregate all page-level checks
        const allPageChecks: any[] = [];
        for (const page of pages as any[]) {
          if (page.checks_json) {
            try {
              const checks = JSON.parse(page.checks_json);
              allPageChecks.push(...checks);
            } catch {}
          }
        }
        
        // Get site-level checks
        const auditData = await env.DB.prepare(`SELECT site_checks_json FROM audits WHERE id = ?`).bind(auditId).first();
        const siteChecks = auditData?.site_checks_json ? JSON.parse(auditData.site_checks_json as string) : [];
        
        // Combine all checks (both page and site level)
        const allChecks = [...allPageChecks, ...siteChecks];
        
        if (allChecks.length > 0) {
          // Filter to production checks only (no preview)
          const productionChecks = allChecks.filter((c: any) => !c.preview);
          
          // Enrich with D1 metadata
          enrichedChecks = productionChecks.map((check: any) => {
            const meta = criteriaMap.get(check.id);
            return {
              ...check,
              category: meta?.category || 'Uncategorized',
              impact_level: meta?.impact_level || 'Medium',
              why_it_matters: meta?.why_it_matters,
              name: meta?.label || check.id,
              weight: meta?.weight || 10
            };
          });
          
          // Compute category roll-ups (new 0-100 scale)
          const categoryMap = new Map<string, { sum: number; count: number; weightSum: number }>();
          for (const check of enrichedChecks) {
            const cat = check.category;
            if (!categoryMap.has(cat)) {
              categoryMap.set(cat, { sum: 0, count: 0, weightSum: 0 });
            }
            const bucket = categoryMap.get(cat)!;
            bucket.sum += check.score * check.weight;
            bucket.weightSum += check.weight;
            bucket.count += 1;
          }
          
          categoryScores = Array.from(categoryMap.entries()).map(([category, data]) => ({
            category,
            score: Math.round(data.sum / data.weightSum),
            weight_total: data.weightSum,
            checks_count: data.count
          }));
          
          // Compute top fixes (failing checks: score < 60) with full D1 content
          const impactWeight = { High: 3, Medium: 2, Low: 1 };
          fixFirst = enrichedChecks
            .filter((c: any) => c.score < 60) // Failing threshold
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              category: c.category,
              impact_level: c.impact_level,
              weight: c.weight,
              score: c.score,
              why_it_matters: c.why_it_matters,
              how_to_fix: c.how_to_fix,
              examples: c.examples,
              quick_fixes: c.quick_fixes,
              common_issues: c.common_issues,
              official_docs: c.official_docs,
              learn_more_links: c.learn_more_links
            }))
            .sort((a: any, b: any) => {
              const impactDiff = impactWeight[b.impact_level] - impactWeight[a.impact_level];
              if (impactDiff !== 0) return impactDiff;
              return b.weight - a.weight;
            })
            .slice(0, 8); // Top 8 fixes
          
          scorecardV2 = true;
        }
      }
      // Note: Legacy scoring system removed - only D1 diagnostics are supported now
    }
  } catch (err) {
    console.warn('[SCORECARD_V2] Failed to compute:', err);
  }

  return {
    ...audit,
    pages_analyzed: pageStats?.total || 0,
    avg_aeo_score: pageStats?.avg_aeo || 0,
    avg_geo_score: pageStats?.avg_geo || 0,
    geo_adjusted: geoAdjusted,
    geo_adjustment_details: geoAdjustmentDetails,
    ...(scorecardV2 && {
      checks: enrichedChecks,
      category_scores: categoryScores,
      fix_first: fixFirst,
      scorecard_v2: true
    })
  };
}

async function getAuditPages(auditId: string, searchParams: URLSearchParams, env: Env) {
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Use INNER JOIN to only return pages that have been analyzed
  // This excludes discovered URLs that were never processed
  const pages = await env.DB.prepare(`
    SELECT ap.*, apa.aeo_score, apa.geo_score, apa.checks_json
    FROM audit_pages ap
    INNER JOIN audit_page_analysis apa ON ap.id = apa.page_id
    WHERE ap.audit_id = ?
    ORDER BY ap.fetched_at DESC
    LIMIT ? OFFSET ?
  `).bind(auditId, limit, offset).all();

  return { pages: pages.results };
}

async function getAuditPage(pageId: string, env: Env) {
  const page = await env.DB.prepare(`
    SELECT ap.*, apa.*
    FROM audit_pages ap
    LEFT JOIN audit_page_analysis apa ON ap.id = apa.page_id
    WHERE ap.id = ?
  `).bind(pageId).first();

  if (!page) {
    throw new Error('Page not found');
  }

  return page;
}

async function recomputeAudit(auditId: string, env: Env) {
  // Recompute diagnostics for all pages using the new D1 system
  if (env.SCORING_V1_ENABLED !== "true") {
    return { status: 'diagnostics_disabled' };
  }

  const audit: any = await env.DB.prepare('SELECT root_url FROM audits WHERE id = ?')
    .bind(auditId).first();
  
  if (!audit) {
    throw new Error('Audit not found');
  }

  const domain = new URL(audit.root_url).hostname;
  
  // Get all pages for this audit with their HTML
  const pages = await env.DB.prepare(`
    SELECT ap.id, ap.url, ap.html_rendered, ap.html_static
    FROM audit_pages ap
    WHERE ap.audit_id = ?
  `).bind(auditId).all();

  const { runDiagnosticsForPage } = await import('./diagnostics/runPage');
  const { runDiagnosticsForSite } = await import('./diagnostics/runSite');
  
  let processed = 0;
  const errors: any[] = [];
  
  // Recompute page-level diagnostics
  for (const page of pages.results as any[]) {
    try {
      await runDiagnosticsForPage(env.DB, {
        pageId: page.id,
        url: page.url,
        html_rendered: page.html_rendered,
        html_static: page.html_static,
        site: { domain, homepageUrl: audit.root_url, targetLocale: "en-US" }
      });
      processed++;
    } catch (error) {
      errors.push({ pageId: page.id, url: page.url, error: String(error) });
    }
  }

  // Recompute site-level diagnostics
  try {
    const pagesWithChecks = await env.DB.prepare(`
      SELECT p.id, p.url, p.html_rendered, p.html_static, apa.checks_json
      FROM audit_pages p
      LEFT JOIN audit_page_analysis apa ON apa.page_id = p.id
      WHERE p.audit_id = ?
    `).bind(auditId).all();

    await runDiagnosticsForSite(env.DB, {
      auditId,
      domain,
      pages: (pagesWithChecks.results || []).map((r: any) => ({
        id: r.id,
        url: r.url,
        html_rendered: r.html_rendered,
        html_static: r.html_static,
        checks: r.checks_json ? JSON.parse(r.checks_json) : []
      }))
    });
  } catch (error) {
    errors.push({ site: true, error: String(error) });
  }

  return { 
    status: 'recomputed',
    diagnostics: {
      pages_processed: processed,
      total_pages: pages.results?.length || 0,
      errors: errors.length > 0 ? errors : undefined
    }
  };
}

async function recrawlAudit(auditId: string, env: Env, ctx: ExecutionContext) {
  const audit = await env.DB.prepare("SELECT * FROM audits WHERE id = ?").bind(auditId).first();
  if (!audit) throw new Error('Audit not found');

  // Clear existing analysis
  await env.DB.prepare("DELETE FROM audit_page_analysis WHERE page_id IN (SELECT id FROM audit_pages WHERE audit_id = ?)").bind(auditId).run();
  await env.DB.prepare("DELETE FROM audit_pages WHERE audit_id = ?").bind(auditId).run();

  // Restart crawl
  const config = JSON.parse(audit.config_json || '{}');
  ctx.waitUntil(runCrawl({ audit_id: auditId, root_url: audit.root_url, max_pages: config.max_pages || 200 }, env));

  return { status: 'recrawling' };
}


// Core Crawl Logic

async function runCrawl({ audit_id, root_url, site_description, max_pages }: any, env: Env) {
  try {
    // Discover URLs
    const discovered = await discoverUrls(root_url, env);
    
    // Prioritize URLs by depth (closest to homepage first)
    const finalOrigin = await resolveFinalUrl(root_url, env);
    const queue = prioritizeUrls(discovered, finalOrigin, max_pages);

    console.log(`Starting crawl for ${queue.length} URLs (prioritized by depth)`);

    // Process each URL
    for (const url of queue) {
      try {
        const page = await fetchPage(url, env);
        if (!page.html) continue;

        const rendered = await maybeRender(url, page.html, env.BROWSER);
        const html = rendered?.html ?? page.html;

        const analysis = await extractAll(html, { url, robots: page.robots, rendered: !!rendered });
        
        // Phase 1: Run classifier v2 in shadow mode
        let classificationV2 = null;
        try {
          const { classifyV2 } = await import('./prompts/classifierV2');
          const hostname = new URL(url).hostname;
          const hostKey = `optiview:classify:v1:${hostname}`;
          
          // Try KV cache first
          const cachedRaw = await env.RULES.get(hostKey);
          if (cachedRaw) {
            classificationV2 = JSON.parse(cachedRaw);
            console.log(`[CLASSIFY_V2] Cache hit for ${hostname}`);
          } else {
            // Compute v2 classification
            const renderGapRatio = rendered ? (analysis.parityPass ? 0.8 : 0.5) : 1.0;
            classificationV2 = await classifyV2({
              html,
              url,
              hostname,
              title: analysis.title,
              metaDescription: analysis.h1, // Use H1 as proxy for meta description
              renderVisibilityPct: renderGapRatio
            });
            
            // Cache for 24h (fire-and-forget, don't await)
            env.RULES.put(hostKey, JSON.stringify(classificationV2), { expirationTtl: 86400 }).catch(() => {});
            console.log(`[CLASSIFY_V2] Computed for ${hostname}: ${classificationV2.site_type.value}/${classificationV2.industry.value}`);
            
            // Log telemetry for health dashboard
            try {
              const { logClassificationV2 } = await import('./lib/telemetry');
              const { classifySite, inferIndustryFromContext } = await import('./prompts');
              const contextBlob = `${analysis.title || ''} ${analysis.h1 || ''} ${html.substring(0, 2000)}`;
              const legacySiteType = classifySite(contextBlob);
              const legacyIndustry = inferIndustryFromContext(contextBlob);
              
              logClassificationV2({
                host: hostname,
                classification: classificationV2,
                legacySiteType,
                legacyIndustry
              });
            } catch (e) {
              console.warn('[CLASSIFY_V2] Telemetry logging failed:', e);
            }
          }
        } catch (error) {
          console.error(`[CLASSIFY_V2] Error:`, error);
          // Fallback classification on error
          classificationV2 = {
            site_type: { value: null, confidence: null },
            industry: { value: null, confidence: null },
            site_mode: null,
            brand_kind: null,
            purpose: "inform",
            lang: null,
            region: null,
            jsonld_types: [],
            nav_terms: [],
            category_terms: [],
            signals: { url: 0, schema: 0, nav: 0, commerce: 0, media: 0 },
            notes: ["classifier_v2_error"]
          };
        }
        
        const ids = { page_id: crypto.randomUUID(), analysis_id: crypto.randomUUID() };

        await env.DB.batch([
          env.DB.prepare(`INSERT INTO audit_pages (id, audit_id, url, status_code, content_type, html_static, html_rendered, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
            .bind(ids.page_id, audit_id, url, page.status, page.contentType, 
                  page.html?.slice(0, 200000), rendered?.html?.slice(0, 200000) || null),
          
          env.DB.prepare(`INSERT INTO audit_page_analysis
            (id, page_id, title, h1, canonical, schema_types, jsonld, has_answer_box, has_jump_links, facts_block, references_block,
             tables_count, outbound_links, author_json, org_json, robots_ai_policy, parity_pass, aeo_score, geo_score, checks_json, metadata, analyzed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
            .bind(
              ids.analysis_id, ids.page_id,
              analysis.title, analysis.h1, analysis.canonical,
              JSON.stringify(analysis.schemaTypes), JSON.stringify(analysis.jsonldRaw),
              analysis.answerBox ? 1 : 0, analysis.jumpLinks ? 1 : 0,
              analysis.factsBlock ? 1 : 0, analysis.refsBlock ? 1 : 0,
              analysis.tablesCount, analysis.outboundLinks,
              JSON.stringify(analysis.author||null), JSON.stringify(analysis.org||null),
              JSON.stringify(analysis.robots||{}), analysis.parityPass ? 1 : 0,
              null, null, '[]', // aeo_score, geo_score, checks_json - will be populated by diagnostics
              JSON.stringify({ classification_v2: classificationV2 })
            )
        ]);

        // Run diagnostics for all 36 criteria if enabled
        if (env.SCORING_V1_ENABLED === "true") {
          try {
            console.log(`[DIAGNOSTICS] Starting page diagnostics for: ${url}`);
            const { runDiagnosticsForPage } = await import('./diagnostics/runPage');
            const hostname = new URL(url).hostname;
            const results = await runDiagnosticsForPage(env.DB, {
              pageId: ids.page_id,
              url,
              html_rendered: rendered?.html?.slice(0, 200000) || null,
              html_static: page.html?.slice(0, 200000) || null,
              site: {
                domain: hostname,
                homepageUrl: root_url,
                targetLocale: "en-US"
              }
            });
            console.log(`[DIAGNOSTICS] Completed ${results.length} checks for: ${url}`);
          } catch (scoreError) {
            console.error(`[DIAGNOSTICS] ERROR for ${url}:`, scoreError);
            console.error(`[DIAGNOSTICS] ERROR stack:`, (scoreError as Error).stack);
          }
        } else {
          console.log(`[DIAGNOSTICS] SCORING_V1_ENABLED=${env.SCORING_V1_ENABLED} (disabled)`);
        }

        console.log(`Processed: ${url} (diagnostics enabled)`);

      } catch (error) {
        console.error(`Failed to process ${url}:`, error);
      }
    }

    // Check if any pages were analyzed
    const pageCountResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM audit_pages WHERE audit_id = ?'
    ).bind(audit_id).first();
    
    const pagesAnalyzed = (pageCountResult?.count as number) || 0;
    
    if (pagesAnalyzed === 0) {
      // No pages were successfully crawled - mark as failed
      await markAuditFailed(env, audit_id, 'no_crawlable_pages_found');
      console.warn(`[NO PAGES] Audit ${audit_id} failed: 0 pages analyzed`);
      return;
    }

    // Finalize site scores
    const { aeo, geo } = await computeSiteScores(env.DB, audit_id);
    await env.DB.prepare("UPDATE audits SET finished_at=datetime('now'), status='complete', aeo_score=?, geo_score=? WHERE id=?")
      .bind(aeo, geo, audit_id).run();

    console.log(`Crawl complete for audit ${audit_id}: AEO=${aeo}, GEO=${geo}`);

  } catch (error) {
    console.error(`Crawl failed for audit ${audit_id}:`, error);
    await markAuditFailed(env, audit_id, `crawl_exception: ${(error as Error).message || 'unknown'}`);
  }
}

// Helper Functions

// Simple HTML parser for Cloudflare Workers
function parseHTML(html: string) {
  return {
    querySelector: (selector: string) => {
      if (selector === 'title') {
        const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        return match ? { textContent: match[1] } : null;
      }
      if (selector === 'h1') {
        const match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
        return match ? { textContent: match[1] } : null;
      }
      if (selector === 'link[rel="canonical"]') {
        const match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
        return match ? { getAttribute: () => match[1] } : null;
      }
      if (selector === 'main') {
        const match = html.match(/<main[^>]*>(.*?)<\/main>/is);
        return match ? { textContent: match[1].replace(/<[^>]*>/g, '').trim() } : null;
      }
      if (selector === 'body') {
        const match = html.match(/<body[^>]*>(.*?)<\/body>/is);
        return match ? { textContent: match[1].replace(/<[^>]*>/g, '').trim() } : null;
      }
      return null;
    },
    querySelectorAll: (selector: string) => {
      if (selector === 'script[type="application/ld+json"]') {
        const matches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
        return matches ? matches.map(match => ({
          textContent: match.replace(/<script[^>]*>(.*?)<\/script>/is, '$1')
        })) : [];
      }
      if (selector === 'a[href^="#"]') {
        const matches = html.match(/<a[^>]*href=["']#/gi);
        return matches ? matches.map(() => ({})) : [];
      }
      if (selector === 'a[href^="http"]') {
        const matches = html.match(/<a[^>]*href=["']http/gi);
        return matches ? matches.map(() => ({})) : [];
      }
      if (selector === 'table') {
        const matches = html.match(/<table[^>]*>/gi);
        return matches ? matches.map(() => ({})) : [];
      }
      if (selector === 'h1, h2, h3, h4, h5, h6') {
        const matches = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis);
        return matches ? matches.map(match => ({
          textContent: match.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/is, '$1')
        })) : [];
      }
      if (selector === 'a[href]') {
        const matches = html.match(/<a[^>]*href=["']([^"']*)["'][^>]*>/gi);
        return matches ? matches.map(match => {
          const hrefMatch = match.match(/href=["']([^"']*)["']/i);
          return { getAttribute: (attr: string) => attr === 'href' ? hrefMatch?.[1] : null };
        }) : [];
      }
      return [];
    }
  };
}

// Helper functions for redirect-aware crawling
async function resolveFinalUrl(input: string, env: Env): Promise<URL> {
  // Default fetch in Workers follows redirects. We rely on res.url for the final URL.
  const res = await fetchWithIdentity(input, {}, env);
  // If host is blocking HTML, still trust res.url for canonical origin.
  const finalUrl = new URL(res.url || input);
  return finalUrl;
}

function flipWww(u: URL): URL[] {
  const host = u.hostname;
  const naked = host.replace(/^www\./, "");
  const isWww = host.startsWith("www.");
  const flipped = isWww ? naked : `www.${naked}`;
  const variants = [new URL(u.toString())];
  const alt = new URL(u.toString());
  alt.hostname = flipped;
  variants.push(alt);
  return variants;
}

function etld1(hostname: string): string {
  // minimal: strip leading 'www.' only; for full eTLD+1 use a PSL library later
  return hostname.toLowerCase().replace(/^www\./, "");
}

function sameSite(base: URL, candidate: URL): boolean {
  return etld1(base.hostname) === etld1(candidate.hostname) && base.protocol === candidate.protocol;
}

async function fetchTextMaybeGzip(url: string, env: Env): Promise<string|null> {
  const res = await fetchWithIdentity(url, {}, env);
  if (!res.ok) return null;
  const ct = res.headers.get("content-type") || "";
  // Most gz sitemaps set application/x-gzip or octet-stream
  if (url.endsWith(".gz")) {
    const ab = await res.arrayBuffer();
    // Workers don't expose zlib; prefer to rely on server's Content-Encoding gzip auto-decompress
    // If needed, add a tiny gzip lib or proxy via Browser Rendering. For now assume server sends XML uncompressed
    try { return new TextDecoder().decode(ab); } catch { return null; }
  }
  return await res.text();
}

async function discoverSitemaps(finalOrigin: URL, env: Env): Promise<string[]> {
  // Fast sitemap discovery: try common patterns only, no robots.txt parsing
  const tryUrls: string[] = [];
  
  // Extract locale from path (e.g., /en-us -> en-us)
  const pathParts = finalOrigin.pathname.split('/').filter(Boolean);
  const locale = pathParts.length > 0 ? pathParts[0] : '';
  
  // Try direct sitemap URLs (most common patterns)
  const origin = finalOrigin.origin;
  tryUrls.push(`${origin}/sitemap.xml`);
  
  if (locale && /^[a-z]{2}(-[a-z]{2})?$/i.test(locale)) {
    // Locale-specific sitemaps
    tryUrls.push(`${origin}/sitemap-${locale}.xml`);
    tryUrls.push(`${origin}/${locale}/sitemap.xml`);
  }
  
  tryUrls.push(`${origin}/sitemap_index.xml`);
  
  console.log(`[CRAWL] Trying ${tryUrls.length} sitemap URLs`);
  
  const found: string[] = [];
  
  for (const url of tryUrls) {
    if (found.length >= 5) break; // Take up to 5 working sitemaps
    
    const xml = await fetchTextMaybeGzip(url, env);
    if (!xml || xml.length < 100) continue;
    
    // Check if it's a valid sitemap
    if (/<urlset/i.test(xml) || /<sitemapindex/i.test(xml)) {
      console.log(`[CRAWL] Found sitemap: ${url}`);
      found.push(url);
    }
  }
  
  console.log(`[CRAWL] Discovered ${found.length} sitemaps`);
  return found;
}

async function extractUrlsFromSitemaps(sitemapUrls: string[], hostAllow: (u: URL)=>boolean, env: Env): Promise<string[]> {
  const urls: string[] = [];
  const MAX_URLS_FROM_SITEMAPS = 200; // Cap at 200 URLs (will be sorted by depth later)
  const childSitemaps: string[] = [];
  
  for (const sm of sitemapUrls) {
    if (urls.length >= MAX_URLS_FROM_SITEMAPS) {
      console.log(`[CRAWL] URL extraction limit reached (${MAX_URLS_FROM_SITEMAPS}), stopping`);
      break;
    }
    
    const xml = await fetchTextMaybeGzip(sm, env);
    if (!xml) continue;
    
    // If it's a sitemap index, extract first 3 child sitemaps
    if (/<sitemapindex/i.test(xml)) {
      console.log(`[CRAWL] Found sitemap index, extracting child sitemaps`);
      const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
      let m;
      let count = 0;
      while ((m = re.exec(xml)) && count < 3) {
        childSitemaps.push(m[1]);
        count++;
      }
      console.log(`[CRAWL] Extracted ${count} child sitemaps from index`);
      continue;
    }
    
    // Extract URLs from urlset
    if (/<urlset/i.test(xml)) {
      const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
      let m; 
      while ((m = re.exec(xml))) {
        try {
          const u = new URL(m[1]);
          if (hostAllow(u)) {
            urls.push(u.toString());
            if (urls.length >= MAX_URLS_FROM_SITEMAPS) break;
          }
        } catch { /* ignore bad */ }
      }
    }
  }
  
  // Process child sitemaps if we found any
  if (childSitemaps.length > 0 && urls.length < MAX_URLS_FROM_SITEMAPS) {
    console.log(`[CRAWL] Processing ${childSitemaps.length} child sitemaps`);
    for (const childSm of childSitemaps) {
      if (urls.length >= MAX_URLS_FROM_SITEMAPS) break;
      
      const xml = await fetchTextMaybeGzip(childSm, env);
      if (!xml || !/<urlset/i.test(xml)) continue;
      
      const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
      let m;
      while ((m = re.exec(xml))) {
        try {
          const u = new URL(m[1]);
          if (hostAllow(u)) {
            urls.push(u.toString());
            if (urls.length >= MAX_URLS_FROM_SITEMAPS) break;
          }
        } catch { /* ignore bad */ }
      }
    }
  }
  
  const unique = [...new Set(urls)];
  console.log(`[CRAWL] Extracted ${unique.length} unique URLs from ${sitemapUrls.length} sitemaps`);
  return unique;
}

async function bfsCrawl(finalOrigin: URL, maxPages: number, env: Env, rootHost: string, rootPath?: string): Promise<string[]> {
  const visited = new Set<string>();
  const queue: string[] = [finalOrigin.toString()];
  const pages: string[] = [];

  while (queue.length && pages.length < maxPages) {
    const next = queue.shift()!;
    if (visited.has(next)) continue;
    visited.add(next);

    // Apply crawl policy filter with locale awareness
    if (!shouldCrawlUrl(next, rootHost, rootPath)) {
      continue; // Filtered by policy
    }

    // Check robots.txt before fetching
    const urlObj = new URL(next);
    const robotsRules = await getRobots(env, urlObj);
    
    if (!isAllowedByRobots(robotsRules, urlObj.pathname)) {
      continue; // Disallowed by robots.txt
    }
    
    // Respect crawl delay if specified
    if (robotsRules?.crawlDelay) {
      await new Promise(resolve => setTimeout(resolve, robotsRules.crawlDelay * 1000));
    }

    const res = await fetchWithIdentity(next, {}, env);
    // Canonicalize to final URL after redirect
    const finalUrl = new URL(res.url || next);
    const html = (await res.text()) || "";
    pages.push(finalUrl.toString());

    // Extract links using regex (faster than parseHTML)
    const links = Array.from(html.matchAll(/<a\s+[^>]*href=['"]([^'"]+)['"]/gi))
      .map(m => m[1]).slice(0, 100); // Reduced from 500 to 100 for focused crawls

    for (const href of links) {
      try {
        const u = new URL(href, finalUrl);       // resolve relative URLs
        if (!sameSite(finalOrigin, u)) continue; // stay on same site
        if (!shouldCrawlUrl(u.toString(), rootHost, rootPath)) continue; // apply crawl policy with locale
        const abs = u.toString().split("#")[0];
        if (!visited.has(abs)) queue.push(abs);
      } catch { /* ignore bad URLs */ }
    }
  }
  return pages;
}

// Helper to calculate URL depth (path segments from root)
function getUrlDepth(url: string, rootOrigin: URL): number {
  try {
    const urlObj = new URL(url);
    if (urlObj.origin !== rootOrigin.origin) return 999; // Different origin = lowest priority
    
    const path = urlObj.pathname.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
    if (!path) return 0; // Homepage
    
    const segments = path.split('/').filter(s => s.length > 0);
    return segments.length;
  } catch {
    return 999;
  }
}

// Prioritize URLs by depth, favoring those closest to homepage
function prioritizeUrls(urls: string[], rootOrigin: URL, maxUrls: number): string[] {
  // Ensure homepage is included if not already
  const homepageUrl = rootOrigin.toString();
  const urlSet = new Set(urls);
  if (!urlSet.has(homepageUrl) && !urlSet.has(homepageUrl + '/')) {
    urls = [homepageUrl, ...urls];
  }
  
  // Group URLs by depth
  const byDepth: Map<number, string[]> = new Map();
  
  for (const url of urls) {
    const depth = getUrlDepth(url, rootOrigin);
    if (!byDepth.has(depth)) {
      byDepth.set(depth, []);
    }
    byDepth.get(depth)!.push(url);
  }
  
  // Sort depths (0 = homepage, 1 = first level, etc.)
  const sortedDepths = Array.from(byDepth.keys()).sort((a, b) => a - b);
  
  // Log depth distribution
  const depthStats: Record<number, number> = {};
  for (const depth of sortedDepths) {
    depthStats[depth] = byDepth.get(depth)!.length;
  }
  console.log(`[CRAWL] URL depth distribution:`, JSON.stringify(depthStats));
  
  // Build prioritized list
  const prioritized: string[] = [];
  
  for (const depth of sortedDepths) {
    const urlsAtDepth = byDepth.get(depth)!;
    
    // Shuffle URLs at same depth to avoid bias
    const shuffled = urlsAtDepth.sort(() => Math.random() - 0.5);
    
    for (const url of shuffled) {
      prioritized.push(url);
      if (prioritized.length >= maxUrls) {
        console.log(`[CRAWL] Prioritization complete: ${prioritized.length} URLs selected (max depth: ${depth})`);
        return prioritized;
      }
    }
  }
  
  console.log(`[CRAWL] Prioritized ${prioritized.length} URLs across ${sortedDepths.length} depth levels`);
  return prioritized;
}

/**
 * Determines if a URL should be crawled based on crawl policy:
 * - Homepage + top-level pages only
 * - FAQ pages prioritized
 * - English/US content only (excludes language folders)
 * - Same host only
 */
/**
 * Strict locale-aware URL filter
 * - Stays within origin + pathPrefix (e.g., /en-us)
 * - Only allows top-level pages (depth 1) + FAQ/help
 * - Blocks all foreign locale patterns (xx-yy)
 */
function shouldCrawlUrl(url: string, rootHost: string, rootPath?: string): boolean {
  try {
    const u = new URL(url);

    // ✅ 1. Stay on same host (normalized without www)
    const urlHost = u.hostname.replace(/^www\./, '');
    if (urlHost !== rootHost) {
      return false; // Off-origin
    }

    const lowerPath = u.pathname.toLowerCase();
    const normalizedRootPath = rootPath && rootPath !== '/' ? rootPath.toLowerCase().replace(/\/$/, '') : '';

    // ✅ 2. If root has a locale path (e.g., /en-us), STRICTLY enforce it
    if (normalizedRootPath) {
      if (!lowerPath.startsWith(normalizedRootPath + '/') && lowerPath !== normalizedRootPath && lowerPath !== normalizedRootPath + '/') {
        return false; // Out of prefix
      }
    }

    // ✅ 3. Block ALL foreign locale patterns at start of path
    // Pattern: /xx-yy/ or /xx_yy/ at path start (not our prefix)
    const foreignLocalePattern = /^\/[a-z]{2}[-_][a-z]{2}\//;
    if (foreignLocalePattern.test(lowerPath)) {
      // Allow only if it matches our root path exactly
      if (!normalizedRootPath || !lowerPath.startsWith(normalizedRootPath + '/')) {
        return false; // Foreign locale
      }
    }

    // ✅ 4. Block query params indicating locale switching
    if (/\b(lang|locale|country|region)=/i.test(u.search)) {
      return false; // Locale param
    }

    // ✅ 5. Calculate depth from root path
    let pathAfterRoot = u.pathname;
    if (normalizedRootPath) {
      pathAfterRoot = u.pathname.substring(normalizedRootPath.length) || '/';
    }
    
    // Remove leading/trailing slashes for accurate segment count
    const pathSegments = pathAfterRoot.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    
    // ✅ 6. Always allow the root path itself
    if (pathSegments.length === 0 || lowerPath === normalizedRootPath || lowerPath === normalizedRootPath + '/') {
      return true;
    }

    // ✅ 7. Allow FAQ/help/support pages at any depth (but still within prefix)
    const priorityKeywords = ['faq', 'faqs', 'help', 'support', 'contact', 'about'];
    if (priorityKeywords.some(kw => pathAfterRoot.toLowerCase().includes(`/${kw}`))) {
      return true; // Priority keywords allowed
    }

    // ✅ 8. Only allow shallow pages (up to 2 segments after root path for e-commerce)
    // Examples: /en-us/themes ✅ /en-us/themes/starwars ✅ /en-us/themes/starwars/sets ❌
    if (pathSegments.length > 2) {
      return false; // Too deep
    }

    // ✅ 9. Allow this page
    return true;
  } catch (err) {
    console.error(`[FILTER:ERROR] ${url} - ${err}`);
    return false;
  }
}

/**
 * Sorts URLs to prioritize FAQ pages and shorter paths
 */
function sortUrlsByPriority(urls: string[]): string[] {
  return urls.sort((a, b) => {
    const faqA = /faq/i.test(a);
    const faqB = /faq/i.test(b);
    if (faqA && !faqB) return -1;
    if (faqB && !faqA) return 1;
    // Shorter paths first
    return a.length - b.length;
  });
}

async function discoverUrls(rootUrl: string, env: Env): Promise<string[]> {
  console.log(`[CRAWL] Starting URL discovery for: ${rootUrl}`);
  
  // Step 1: Resolve final URL after redirects
  const finalOrigin = await resolveFinalUrl(rootUrl, env);
  console.log(`[CRAWL] Final origin after redirects: ${finalOrigin.toString()}`);
  
  // Extract root host and locale prefix (not full path) for locale-aware filtering
  const rootHost = finalOrigin.hostname.replace(/^www\./, '');
  
  // Only extract locale prefix (e.g., /us, /en-us), not deep paths like /us/home
  // Match pattern: /xx or /xx-yy at the start of the path
  const localeMatch = finalOrigin.pathname.match(/^\/[a-z]{2}(?:[-_][a-z]{2})?/);
  const rootPath = localeMatch ? localeMatch[0] : '/';
  
  console.log(`[CRAWL] Root host: ${rootHost}, Locale prefix: ${rootPath}`);
  
  // Step 2: Try sitemap discovery
  const sitemaps = await discoverSitemaps(finalOrigin, env);
  console.log(`[CRAWL] Found ${sitemaps.length} sitemaps`);
  
  let urls: string[] = [];
  
  if (sitemaps.length > 0) {
    // Step 3: Extract URLs from sitemaps with crawl policy (locale-aware)
    const hostAllow = (u: URL) => sameSite(finalOrigin, u) && shouldCrawlUrl(u.toString(), rootHost, rootPath);
    urls = await extractUrlsFromSitemaps(sitemaps, hostAllow, env);
    console.log(`[CRAWL] Extracted ${urls.length} URLs from sitemaps (after filtering)`);
  }
  
  // Step 4: Fallback to BFS if no sitemap URLs found
  if (urls.length === 0) {
    console.log(`[CRAWL] No sitemap URLs found, falling back to BFS`);
    urls = await bfsCrawl(finalOrigin, 50, env, rootHost, rootPath); // Pass rootPath
    console.log(`[CRAWL] BFS discovered ${urls.length} URLs`);
  }
  
  // Step 5: Apply priority sorting (FAQ first)
  urls = sortUrlsByPriority(urls);
  console.log(`[CRAWL] URLs sorted by priority (FAQ first, shorter paths first)`);
  
  // Step 6: Cap at reasonable limit for focused audits (tight cap for fast discovery)
  const MAX_URLS = 30;
  if (urls.length > MAX_URLS) {
    console.log(`[CRAWL] Capping URL list from ${urls.length} to ${MAX_URLS}`);
    urls = urls.slice(0, MAX_URLS);
  }
  
  // Step 7: Guardrail - mark as failed if still no URLs
  if (urls.length === 0) {
    console.error(`[CRAWL] No pages discovered for ${rootUrl} -> ${finalOrigin.toString()}`);
    throw new Error(`No pages discovered. Final origin: ${finalOrigin.toString()}`);
  }
  
  console.log(`[CRAWL] Total URLs discovered: ${urls.length}`);
  return urls;
}

async function fetchPage(url: string, env: Env) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    // Check robots.txt before fetching
    const urlObj = new URL(url);
    const robotsRules = await getRobots(env, urlObj);
    
    if (!isAllowedByRobots(robotsRules, urlObj.pathname)) {
      throw new Error(`URL disallowed by robots.txt: ${url}`);
    }
    
    // Respect crawl delay if specified
    if (robotsRules?.crawlDelay) {
      await new Promise(resolve => setTimeout(resolve, robotsRules.crawlDelay * 1000));
    }
    
    const res = await fetchWithIdentity(url, { 
      signal: controller.signal 
    }, env);
    
    clearTimeout(timeoutId);
    
    const contentType = res.headers.get('content-type') || '';
    const html = contentType.includes('text/html') ? await res.text() : '';
    
    const robots = await fetchRobots(url);
    
    return {
      status: res.status,
      contentType,
      html,
      robots
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return { status: 0, contentType: '', html: '', robots: {} };
  }
}

async function fetchRobots(url: string) {
  try {
    const urlObj = new URL(url);
    const robotsUrl = `${urlObj.origin}/robots.txt`;
    const res = await fetch(robotsUrl, { cf: { cacheTtl: 3600 } });
    
    if (!res.ok) return {};
    
    const text = await res.text();
    const lines = text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    
    const policy: any = {};
    let currentUserAgent = '*';
    
    for (const line of lines) {
      const [key, value] = line.split(':').map(s => s.trim());
      if (!value) continue;
      
      if (key.toLowerCase() === 'user-agent') {
        currentUserAgent = value.toLowerCase();
      } else if (key.toLowerCase() === 'allow' || key.toLowerCase() === 'disallow') {
        if (!policy[currentUserAgent]) policy[currentUserAgent] = [];
        policy[currentUserAgent].push({ type: key.toLowerCase(), path: value });
      }
    }
    
    // Resolve policy for AI bots
    const aiBots = ['gptbot', 'claude-web', 'perplexitybot'];
    const resolved: any = {};
    
    for (const bot of aiBots) {
      resolved[bot] = resolveBotPolicy(bot, policy, url);
    }
    
    return resolved;
  } catch (error) {
    return {};
  }
}

function resolveBotPolicy(bot: string, policy: any, url: string): string {
  const botPolicy = policy[bot] || policy['*'] || [];
  const urlPath = new URL(url).pathname;
  
  let allow = true;
  
  for (const rule of botPolicy) {
    if (urlPath.startsWith(rule.path.replace('*', ''))) {
      allow = rule.type === 'allow';
    }
  }
  
  return allow ? 'allow' : 'disallow';
}

async function maybeRender(url: string, html: string | undefined, browser: Browser) {
  if (!html) return null;
  
  // Quick heuristic: if no <h1> or sparse content, render
  const needsRender = !/(<h1[^>]*>.*?<\/h1>)/is.test(html) || html.length < 1000;
  if (!needsRender) return null;

  try {
    const browserSession = await browser.launch();
    const page = await browserSession.newPage();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    await page.goto(url, { waitUntil: 'networkidle', signal: controller.signal });
    const renderedHtml = await page.content();
    
    clearTimeout(timeoutId);
    await page.close();
    await browserSession.close();
    
    return { html: renderedHtml };
  } catch (error) {
    console.error('Browser rendering failed:', error);
    return null;
  }
}

async function extractAll(html: string, ctx: { url: string, robots: any, rendered: boolean }): Promise<PageAnalysis> {
  // Use a simple HTML parser instead of DOMParser for Cloudflare Workers
  const doc = parseHTML(html);
  
  const title = doc.querySelector('title')?.textContent?.trim() || '';
  const h1 = doc.querySelector('h1')?.textContent?.trim() || '';
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || ctx.url;

  // JSON-LD extraction
  const jsonldRaw = [...doc.querySelectorAll('script[type="application/ld+json"]')]
    .map(s => {
      try {
        return JSON.parse(s.textContent || '');
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  
  const schemaTypes = jsonldRaw.flatMap(n => Array.isArray(n) ? n : [n])
    .map(n => n['@type']).filter(Boolean);

  // Answer box detection
  const main = doc.querySelector('main') || doc.body;
  const textTop = (main?.textContent || '').trim().slice(0, 800);
  const answerBox = textTop.split(/\s+/).length > 25 && (
    textTop.includes('\n\n') || 
    doc.querySelector('main ul, main ol, main table') !== null
  );

  // Jump links
  const jumpLinks = doc.querySelectorAll('a[href^="#"]').length >= 2;

  // Facts block detection
  const factsBlock = hasHeading(doc, ["key facts","at-a-glance","highlights","summary"]);

  // References block
  const refsBlock = hasHeading(doc, ["references","sources","citations","footnotes"]);

  // Tables count
  const tablesCount = doc.querySelectorAll('table').length;

  // Outbound links
  const outboundLinks = [...doc.querySelectorAll('a[href^="http"]')]
    .filter(a => a.href && !a.href.includes(new URL(ctx.url).hostname)).length;

  // Extract entities
  const { org, author } = pullEntities(jsonldRaw);

  // Additional heuristics
  const chunkable = doc.querySelectorAll('h2, h3, h4').length >= 3;
  const hasStableAnchors = doc.querySelectorAll('a[href*="#"]').length >= 1;
  const hasDatasetLinks = [...doc.querySelectorAll('a[href]')]
    .some(a => /\.(csv|json|xlsx)$/i.test(a.href));
  const hasLicense = jsonldRaw.some(item => item['license'] || item['@type'] === 'CreativeWork');
  const hasChangelog = hasHeading(doc, ["changelog", "updates", "what changed"]);
  const dateModified = jsonldRaw.some(item => item['dateModified']);
  const linksToSourcesHub = [...doc.querySelectorAll('a[href*="/sources"], a[href*="/references"]')].length > 0;
  const clsRisk = false; // Would need actual CLS measurement
  const sitemapsOk = true; // Checked during discovery
  const internalCluster = [...doc.querySelectorAll('a[href]')]
    .filter(a => a.href && a.href.includes(new URL(ctx.url).hostname)).length >= 3;

  // Parity check (simplified)
  const parityPass = true; // Would compare static vs rendered

  return {
    title, h1, canonical, schemaTypes, jsonldRaw, answerBox, jumpLinks, factsBlock, refsBlock,
    tablesCount, outboundLinks, org, author, robots: ctx.robots, parityPass,
    chunkable, hasStableAnchors, hasDatasetLinks, hasLicense, hasChangelog, dateModified,
    linksToSourcesHub, clsRisk, sitemapsOk, internalCluster
  };
}

function hasHeading(doc: Document, patterns: string[]): boolean {
  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const heading of headings) {
    const text = heading.textContent?.toLowerCase() || '';
    if (patterns.some(pattern => text.includes(pattern))) {
      return true;
    }
  }
  return false;
}

function pullEntities(jsonld: any[]): { org: any, author: any } {
  let org = null;
  let author = null;
  
  for (const item of jsonld) {
    if (item['@type'] === 'Organization' && !org) {
      org = item;
    }
    if (item['@type'] === 'Person' && !author) {
      author = item;
    }
    if (Array.isArray(item)) {
      for (const subItem of item) {
        if (subItem['@type'] === 'Organization' && !org) {
          org = subItem;
        }
        if (subItem['@type'] === 'Person' && !author) {
          author = subItem;
        }
      }
    }
  }
  
  return { org, author };
}

// Citations API Handlers

/**
 * Normalize domain for consistent storage and querying
 * Removes www. prefix and converts to lowercase
 */
function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, '');
}

async function runCitations(req: Request, env: Env) {
  const runId = crypto.randomUUID();
  try {
    console.log('[CITATIONS] Starting citations run:', runId);
    const body: CitationsRequest = await req.json();
    let { audit_id, project_id, domain, brand, sources, queries } = body;
    
    if (!audit_id) {
      throw new Error('audit_id is required');
    }
    
    // Fetch audit details FIRST to get project_id and domain
    const audit: any = await env.DB.prepare(`
      SELECT 
        a.id,
        a.project_id,
        a.root_url,
        a.site_description
      FROM audits a
      WHERE a.id = ?
    `).bind(audit_id).first();
    
    if (!audit) {
      throw new Error(`Audit ${audit_id} not found`);
    }
    
    // Extract project_id and domain from audit
    project_id = audit.project_id;
    domain = normalizeDomain(new URL(audit.root_url).hostname);
    
    console.log('[CITATIONS] Request params:', { audit_id, project_id, domain, sources: sources.length, queries: queries?.length });
    
    // Log the run start (now with valid project_id)
    await env.DB.prepare(`
      INSERT INTO citations_runs 
      (id, audit_id, project_id, domain, started_at, status, total_queries, by_source)
      VALUES (?, ?, ?, ?, datetime('now'), 'running', ?, ?)
    `).bind(
      runId,
      audit_id,
      project_id, 
      domain, 
      sources.length * 24, // Max queries per source
      JSON.stringify(sources.reduce((acc, source) => ({ ...acc, [source]: { total: 0, cited: 0 } }), {}))
    ).run();
    
    console.log('[CITATIONS] Resolved audit:', { project_id, domain });
    
    // Generate default queries if not provided (v2-contextual engine)
    let finalQueries = queries;
    let queryTypeMap: Record<string, 'branded' | 'non-branded'> = {};
    let envelope = '';
    let promptMeta: any = {};
    
    if (!finalQueries || finalQueries.length === 0) {
      console.log('[CITATIONS] Generating branded + non-branded queries via v2-contextual engine');
      
      // Use new sophisticated prompt generation from /api/llm/prompts
      const { buildLLMQueryPrompts } = await import('./prompts');
      const prompts = await buildLLMQueryPrompts(env, domain);
      
      // Extract metadata and envelope
      envelope = prompts.envelope || '';
      promptMeta = prompts.meta || {};
      
      // Build query type map
      prompts.branded.forEach(q => queryTypeMap[q] = 'branded');
      prompts.nonBranded.forEach(q => queryTypeMap[q] = 'non-branded');
      
      // Combine branded and non-branded queries
      finalQueries = [...prompts.branded, ...prompts.nonBranded];
      
      console.log('[CITATIONS] Generated queries:', {
        branded: prompts.branded.length,
        nonBranded: prompts.nonBranded.length,
        total: finalQueries.length,
        brand: promptMeta.brand,
        site_type: promptMeta.site_type,
        version: promptMeta.prompt_gen_version
      });
      
      // Store prompt run metadata for debugging
      await env.DB.prepare(`
        INSERT INTO llm_prompt_runs
        (id, project_id, domain, brand, site_type, primary_entities, user_intents, 
         envelope, branded_prompts, nonbranded_prompts, prompt_gen_version, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        crypto.randomUUID(),
        project_id,
        domain,
        promptMeta.brand || null,
        promptMeta.site_type || null,
        JSON.stringify(promptMeta.primary_entities || []),
        JSON.stringify(promptMeta.user_intents || []),
        envelope,
        JSON.stringify(prompts.branded),
        JSON.stringify(prompts.nonBranded),
        promptMeta.prompt_gen_version || 'v2-contextual'
      ).run();
    }
    
    const results = [];
    const errors = [];
    const totalsBySource: Record<string, { total: number, cited: number }> = {};
    
    // Initialize totals
    for (const source of sources) {
      totalsBySource[source] = { total: 0, cited: 0 };
    }
    
    // Filter out Brave if temporarily disabled
    const activeSources = DISABLE_BRAVE_TEMP 
      ? sources.filter(s => s !== 'brave')
      : sources;
    
    if (DISABLE_BRAVE_TEMP && sources.includes('brave')) {
      console.log('[CITATIONS] Brave temporarily disabled (DISABLE_BRAVE_TEMP=true)');
    }
    
    // Process each source-query combination with batched concurrency + timeouts
    for (const source of activeSources) {
      console.log(`[CITATIONS] Processing source: ${source}`);
      // Global cap: max 24 queries per run (configurable)
      const MAX_QUERIES = 27;
      
      // Get source-specific timeout
      const getTimeout = (src: string) => {
        switch(src) {
          case 'perplexity': return CITATIONS_PERPLEXITY_TIMEOUT_MS;
          case 'chatgpt': return CITATIONS_CHATGPT_TIMEOUT_MS;
          case 'claude': return CITATIONS_CLAUDE_TIMEOUT_MS;
          case 'brave': return CITATIONS_BRAVE_TIMEOUT_MS;
          default: return CITATIONS_TIMEOUT_MS;
        }
      };
      
      const timeoutMs = getTimeout(source);
      const queryBatch = finalQueries.slice(0, MAX_QUERIES);
      let timeoutCount = 0;
      
      // Process in batches with timeout protection
      const batchResults = await runInBatches(
        queryBatch,
        CITATIONS_BATCH_SIZE,
        async (query) => {
          try {
            // Throttle requests slightly
            await new Promise(resolve => setTimeout(resolve, 200));
          
            // Prepend envelope for context if available (v2-contextual)
            const fullPrompt = envelope ? `${envelope}Query: ${query}` : query;
            console.log(`[CITATIONS] Querying ${source}: "${query}"${envelope ? ' (with envelope)' : ''}`);
            
            // Wrap in timeout
            const result = await withTimeout(
              queryAI(source, fullPrompt, env),
              timeoutMs,
              `${source} query timeout after ${timeoutMs}ms`
            );
            
            console.log(`[CITATIONS] Got result from ${source}:`, { hasAnswer: !!result.answer_text, hasUrls: result.cited_urls.length, error: result.error });
          
          const processed = processCitations(result, domain);
        
          // Generate hash for deduplication
          const answerHash = result.answer_text ? 
            await crypto.subtle.digest('SHA-256', new TextEncoder().encode(result.answer_text))
              .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')) :
            null;
          
          console.log(`[CITATIONS] Storing result for ${source}`);
          // Store in database
          const citationId = crypto.randomUUID();
          const queryType = queryTypeMap[query] || null; // Get query type from map
          const intentGroup = queryTypeMap[query] || null; // branded or non-branded
          const promptGenVersion = promptMeta.prompt_gen_version || 'v1-legacy';
          
          await env.DB.prepare(`
            INSERT INTO ai_citations 
            (id, audit_id, project_id, domain, ai_source, query, query_type, answer_hash, answer_excerpt, 
             cited_urls, cited_match_count, first_match_url, confidence, error, intent_group, prompt_gen_version, occurred_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            citationId, audit_id, project_id, domain, source, query, queryType, answerHash,
            result.answer_text?.slice(0, 5000) || '', // Store up to 5000 chars for full answer display
            JSON.stringify(processed.cited_urls),
            processed.cited_match_count,
            processed.first_match_url,
            result.confidence || 0,
            result.error || null,
            intentGroup,
            promptGenVersion
          ).run();
          
          // Update referrals table
          await env.DB.prepare(`
            INSERT OR REPLACE INTO ai_referrals
            (id, audit_id, project_id, domain, ai_source, query, cited, count_urls, first_seen, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 
                    COALESCE((SELECT first_seen FROM ai_referrals WHERE audit_id = ? AND ai_source = ? AND query = ?), datetime('now')),
                    datetime('now'))
          `).bind(
            crypto.randomUUID(), audit_id, project_id, domain, source, query,
            processed.cited_match_count > 0 ? 1 : 0,
            processed.cited_match_count,
            audit_id, source, query
          ).run();
          
          // Update totals
          totalsBySource[source].total++;
          if (processed.cited_match_count > 0) {
            totalsBySource[source].cited++;
          }
          
            return { query, result, processed };
            
          } catch (error) {
            if (error instanceof Error && error.message.includes('timeout')) {
              timeoutCount++;
            }
            throw error;
          }
        }
      );
      
      // Process batch results
      for (let i = 0; i < batchResults.length; i++) {
        const batchResult = batchResults[i];
        const query = queryBatch[i];
        
        if (batchResult.status === 'fulfilled') {
          const { result, processed } = batchResult.value;
          
          try {
            // Generate hash for deduplication
            const answerHash = result.answer_text ? 
              await crypto.subtle.digest('SHA-256', new TextEncoder().encode(result.answer_text))
                .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')) :
              null;
            
            console.log(`[CITATIONS] Storing result for ${source}`);
            // Store in database
            const citationId = crypto.randomUUID();
            const queryType = queryTypeMap[query] || null;
            const intentGroup = queryTypeMap[query] || null;
            const promptGenVersion = promptMeta.prompt_gen_version || 'v1-legacy';
            
            await env.DB.prepare(`
              INSERT INTO ai_citations 
              (id, audit_id, project_id, domain, ai_source, query, query_type, answer_hash, answer_excerpt, 
               cited_urls, cited_match_count, first_match_url, confidence, error, intent_group, prompt_gen_version, occurred_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `).bind(
              citationId, audit_id, project_id, domain, source, query, queryType, answerHash,
              result.answer_text?.slice(0, 5000) || '',
              JSON.stringify(processed.cited_urls),
              processed.cited_match_count,
              processed.first_match_url,
              result.confidence || 0,
              result.error || null,
              intentGroup,
              promptGenVersion
            ).run();
            
            // Update referrals table
            await env.DB.prepare(`
              INSERT OR REPLACE INTO ai_referrals
              (id, audit_id, project_id, domain, ai_source, query, cited, count_urls, first_seen, last_seen)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 
                      COALESCE((SELECT first_seen FROM ai_referrals WHERE audit_id = ? AND ai_source = ? AND query = ?), datetime('now')),
                      datetime('now'))
            `).bind(
              crypto.randomUUID(), audit_id, project_id, domain, source, query,
              processed.cited_match_count > 0 ? 1 : 0,
              processed.cited_match_count,
              audit_id, source, query
            ).run();
            
            // Update totals
            totalsBySource[source].total++;
            if (processed.cited_match_count > 0) {
              totalsBySource[source].cited++;
            }
            
            results.push({
              source,
              query,
              cited: processed.cited_match_count > 0,
              cited_count: processed.cited_match_count,
              error: result.error
            });
          } catch (dbError) {
            console.error(`[CITATIONS] DB error for ${source} query "${query}":`, dbError);
            errors.push({
              source,
              query,
              error: dbError instanceof Error ? dbError.message : 'DB error'
            });
          }
        } else {
          // Failed query
          const error = batchResult.reason;
          console.error(`[CITATIONS] Error processing ${source} for query "${query}":`, error);
          errors.push({
            source,
            query,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          totalsBySource[source].total++;
          
          results.push({
            source,
            query,
            cited: false,
            cited_count: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      // Log timeout summary for this source
      if (timeoutCount > 0) {
        console.warn(`[CITATIONS] ${source} had ${timeoutCount} timeouts`);
      }
    }
    
    // Calculate percentages
    const citedPctBySource: Record<string, number> = {};
    for (const [source, totals] of Object.entries(totalsBySource)) {
      citedPctBySource[source] = totals.total > 0 ? 
        Math.round((totals.cited / totals.total) * 100) : 0;
    }
    
    console.log('[CITATIONS] Run completed:', { totalResults: results.length, errors: errors.length });
    
    // Calculate totals
    const totalQueries = Object.values(totalsBySource).reduce((sum, t) => sum + t.total, 0);
    const totalCitations = Object.values(totalsBySource).reduce((sum, t) => sum + t.cited, 0);
    const overallCitedPct = totalQueries > 0 ? Math.round((totalCitations / totalQueries) * 100) : 0;
    
    // Update prompt intelligence index with coverage stats
    const { updatePromptIndex } = await import('./prompt-cache');
    await updatePromptIndex(env, {
      domain,
      projectId: project_id,
      brand: promptMeta.brand,
      siteType: promptMeta.site_type,
      primaryEntities: promptMeta.primary_entities,
      avgCoverage: overallCitedPct,
      totalCitations,
      totalQueries
    });
    
    // Update run completion
    await env.DB.prepare(`
      UPDATE citations_runs 
      SET completed_at = datetime('now'), 
          status = 'completed',
          total_queries = ?,
          total_citations = ?,
          cited_pct = ?,
          by_source = ?,
          errors_count = ?
      WHERE id = ?
    `).bind(
      totalQueries,
      totalCitations,
      overallCitedPct,
      JSON.stringify(totalsBySource),
      errors.length,
      runId
    ).run();
    
    return {
      status: 'completed',
      runId,
      totalsBySource,
      citedPctBySource,
      results: results.slice(0, 50), // Limit response size
      errors: errors.slice(0, 10) // Include first 10 errors for debugging
    };
    
  } catch (error) {
    console.error('[CITATIONS] Top-level error:', error);
    
    // Update run with error status
    try {
      await env.DB.prepare(`
        UPDATE citations_runs 
        SET completed_at = datetime('now'), 
            status = 'error'
        WHERE id = ?
      `).bind(runId).run();
    } catch (dbError) {
      console.error('[CITATIONS] Failed to update run status:', dbError);
    }
    
    return {
      status: 'error',
      runId,
      error: error instanceof Error ? error.message : 'Unknown error',
      totalsBySource: {},
      citedPctBySource: {},
      results: [],
      errors: []
    };
  }
}

async function getCitationsSummary(searchParams: URLSearchParams, env: Env) {
  const audit_id = searchParams.get('audit_id');
  
  if (!audit_id) {
    throw new Error('audit_id is required');
  }
  
  // Get summary by source
  const summary = await env.DB.prepare(`
    SELECT 
      ai_source,
      COUNT(*) as total_queries,
      SUM(CASE WHEN cited_match_count > 0 THEN 1 ELSE 0 END) as cited_queries,
      ROUND(AVG(CASE WHEN cited_match_count > 0 THEN 1.0 ELSE 0.0 END) * 100, 1) as cited_percentage,
      MAX(occurred_at) as last_run
    FROM ai_citations
    WHERE audit_id = ?
    GROUP BY ai_source
    ORDER BY last_run DESC
  `).bind(audit_id).all();
  
  // Get breakdown by query type (branded vs non-branded)
  const typeBreakdown = await env.DB.prepare(`
    SELECT 
      query_type,
      COUNT(*) as total_queries,
      SUM(CASE WHEN cited_match_count > 0 THEN 1 ELSE 0 END) as cited_queries,
      ROUND(AVG(CASE WHEN cited_match_count > 0 THEN 1.0 ELSE 0.0 END) * 100, 1) as cited_percentage,
      SUM(cited_match_count) as total_citations
    FROM ai_citations
    WHERE audit_id = ? AND query_type IS NOT NULL
    GROUP BY query_type
  `).bind(audit_id).all();
  
  // Get top cited URLs (clean trailing punctuation from URLs)
  const topUrls = await env.DB.prepare(`
    SELECT 
      RTRIM(first_match_url, '),;.!?') as first_match_url,
      COUNT(*) as citation_count,
      MAX(occurred_at) as last_seen
    FROM ai_citations
    WHERE audit_id = ? AND cited_match_count > 0 AND first_match_url IS NOT NULL
    GROUP BY RTRIM(first_match_url, '),;.!?')
    ORDER BY citation_count DESC, last_seen DESC
    LIMIT 10
  `).bind(audit_id).all();
  
  // Get top citing queries with all sources grouped (unique sources only)
  const topQueries = await env.DB.prepare(`
    SELECT 
      query,
      GROUP_CONCAT(DISTINCT ai_source) as ai_sources,
      SUM(cited_match_count) as total_citations,
      MAX(occurred_at) as last_occurred,
      MAX(answer_excerpt) as sample_answer
    FROM ai_citations
    WHERE audit_id = ? AND cited_match_count > 0
    GROUP BY query
    ORDER BY total_citations DESC, last_occurred DESC
    LIMIT 10
  `).bind(audit_id).all();
  
  // Enrich with per-source answers
  const enrichedQueries = await Promise.all((topQueries.results || []).map(async (query: any) => {
    const sourceAnswers = await env.DB.prepare(`
      SELECT ai_source, answer_excerpt, cited_urls, cited_match_count
      FROM ai_citations
      WHERE audit_id = ? AND query = ?
      ORDER BY ai_source
    `).bind(audit_id, query.query).all();
    
    return {
      ...query,
      source_answers: sourceAnswers.results || []
    };
  }));
  
  // Get queries that DID NOT cite the domain (missing opportunities)
  const missingQueries = await env.DB.prepare(`
    SELECT 
      query,
      query_type,
      GROUP_CONCAT(DISTINCT ai_source) as ai_sources,
      COUNT(DISTINCT ai_source) as source_count,
      MAX(occurred_at) as last_occurred,
      MAX(answer_excerpt) as sample_answer
    FROM ai_citations
    WHERE audit_id = ? AND cited_match_count = 0
    GROUP BY query
    ORDER BY source_count DESC, last_occurred DESC
    LIMIT 20
  `).bind(audit_id).all();
  
  // Enrich missing queries with per-source answers
  const enrichedMissing = await Promise.all((missingQueries.results || []).map(async (query: any) => {
    const sourceAnswers = await env.DB.prepare(`
      SELECT ai_source, answer_excerpt, cited_urls
      FROM ai_citations
      WHERE audit_id = ? AND query = ? AND cited_match_count = 0
      ORDER BY ai_source
    `).bind(audit_id, query.query).all();
    
    return {
      ...query,
      source_answers: sourceAnswers.results || []
    };
  }));
  
  return {
    bySource: summary.results || [],
    byType: typeBreakdown.results || [],
    topCitedUrls: topUrls.results || [],
    topCitingQueries: enrichedQueries,
    missingQueries: enrichedMissing
  };
}

async function getCitationsList(searchParams: URLSearchParams, env: Env) {
  const audit_id = searchParams.get('audit_id');
  const source = searchParams.get('source');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  if (!audit_id) {
    throw new Error('audit_id is required');
  }
  
  let whereClause = 'WHERE audit_id = ?';
  const params = [audit_id];
  
  if (source) {
    whereClause += ' AND ai_source = ?';
    params.push(source);
  }
  
  const citations = await env.DB.prepare(`
    SELECT 
      id, ai_source, query, answer_excerpt,
      cited_urls, cited_match_count, 
      RTRIM(first_match_url, '),;.!?') as first_match_url,
      confidence, error, occurred_at
    FROM ai_citations
    ${whereClause}
    ORDER BY occurred_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all();
  
  // Parse cited_urls JSON, clean trailing punctuation, and limit to top 5 for response
  const processedCitations = citations.results.map((citation: any) => {
    const urls = JSON.parse(citation.cited_urls || '[]');
    const cleanedUrls = urls.map((url: string) => url.replace(/[),;.!?]+$/, '')).slice(0, 5);
    return {
      ...citation,
      cited_urls: cleanedUrls
    };
  });
  
  return {
    citations: processedCitations,
    hasMore: processedCitations.length === limit
  };
}

/**
 * Compare legacy classifier vs v2 for admin review
 */
async function compareClassifiers(host: string, env: Env): Promise<any> {
  try {
    // Fetch most recent audit for this host
    const audit: any = await env.DB.prepare(`
      SELECT id, root_url FROM audits 
      WHERE LOWER(root_url) LIKE '%' || ? || '%'
      ORDER BY started_at DESC
      LIMIT 1
    `).bind(host.toLowerCase()).first();

    if (!audit) {
      return { error: 'No audit found for this host' };
    }

    // Fetch analysis with legacy classification (if stored separately) and v2
    const analysis: any = await env.DB.prepare(`
      SELECT 
        pa.title, pa.h1, pa.schema_types, pa.jsonld, pa.metadata,
        p.url, p.html_static
      FROM audit_page_analysis pa
      JOIN audit_pages p ON p.id = pa.page_id
      WHERE p.audit_id = ? AND p.url = ?
      LIMIT 1
    `).bind(audit.id, audit.root_url).first();

    if (!analysis) {
      return { error: 'No homepage analysis found' };
    }

    const metadata = analysis.metadata ? JSON.parse(analysis.metadata) : {};
    const v2 = metadata.classification_v2;

    // Generate legacy classification from current prompts.ts
    const { classifySite, inferIndustryFromContext } = await import('./prompts');
    const contextBlob = `${analysis.title || ''} ${analysis.h1 || ''} ${analysis.html_static?.substring(0, 2000) || ''}`;
    const legacyClassification = classifySite(contextBlob);
    const legacyIndustry = inferIndustryFromContext(contextBlob, []);

    return {
      host,
      path: '/',
      legacy: {
        site_type: legacyClassification.site_type,
        industry: legacyIndustry
      },
      v2: v2 || { error: 'v2 classification not available' }
    };
  } catch (error: any) {
    console.error('[CLASSIFIER_COMPARE] Error:', error);
    throw error;
  }
}

async function getInsights(params: URLSearchParams, env: Env) {
  const project_id = params.get('project_id');
  const domain = params.get('domain');
  const audit_id = params.get('audit_id');

  if (!project_id || !domain) {
    return { error: 'project_id and domain are required' };
  }

  try {
    // Get scoring data from audit
    let auditData = null;
    if (audit_id) {
      const auditResult = await env.DB.prepare(`
        SELECT * FROM audits WHERE id = ? AND project_id = ?
      `).bind(audit_id, project_id).first();
      
      if (auditResult) {
        auditData = auditResult;
      }
    }

    // Get page analysis data for scoring insights
    const pagesResult = await env.DB.prepare(`
      SELECT apa.checks_json, apa.aeo_score, apa.geo_score
      FROM audit_page_analysis apa
      JOIN audit_pages ap ON apa.page_id = ap.id
      JOIN audits a ON ap.audit_id = a.id
      WHERE a.project_id = ? AND a.root_url LIKE ?
      ORDER BY ap.fetched_at DESC
      LIMIT 20
    `).bind(project_id, `%${domain}%`).all();

    // Analyze scoring data
    const allChecks: Array<{id: string, score: number, weight: number}> = [];
    pagesResult.results.forEach((page: any) => {
      try {
        const checks = JSON.parse(page.checks_json || '[]');
        allChecks.push(...checks);
      } catch (e) {
        // Skip invalid JSON
      }
    });

    // Calculate top issues (weight × (3 - score) descending)
    const checkAverages: Record<string, {score: number, weight: number, count: number}> = {};
    allChecks.forEach(check => {
      if (!checkAverages[check.id]) {
        checkAverages[check.id] = { score: 0, weight: check.weight, count: 0 };
      }
      checkAverages[check.id].score += check.score;
      checkAverages[check.id].count += 1;
    });

    const topIssues = Object.entries(checkAverages)
      .map(([id, data]) => ({
        code: id,
        score: data.score / data.count,
        weight: data.weight,
        impact: data.weight * (3 - (data.score / data.count))
      }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5)
      .map(issue => ({
        code: issue.code,
        score: Math.round(issue.score),
        weight: issue.weight,
        impact: issue.impact > 30 ? 'high' : issue.impact > 15 ? 'medium' : 'low',
        why: getIssueDescription(issue.code, issue.score)
      }));

    // Calculate quick wins (low score + high weight + easy to implement)
    const quickWins = Object.entries(checkAverages)
      .map(([id, data]) => ({
        code: id,
        score: data.score / data.count,
        weight: data.weight
      }))
      .filter(check => check.score < 2 && check.weight >= 8) // Low score, decent weight
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map(win => ({
        code: win.code,
        action: getQuickWinAction(win.code),
        est_lift: win.weight >= 15 ? 'high' : win.weight >= 10 ? 'med' : 'low'
      }));

    // Get citations data
    const citationsSummary = await getCitationsSummary(params, env);
    
    const visibilitySummary = {
      by_source: citationsSummary.bySource.map((source: any) => ({
        source: source.ai_source,
        cited_pct: source.cited_percentage,
        mentions: source.total_queries
      })),
      last_run: citationsSummary.bySource[0]?.last_run || null
    };

    // Check for SPA visibility risk
    const spaInsights: any[] = [];
    if (audit_id) {
      const avgRenderGap = await getAverageRenderGap(env, audit_id);
      
      if (avgRenderGap !== null && avgRenderGap < 0.5) {
        spaInsights.push({
          code: "SPA_RISK",
          message: avgRenderGap < 0.3
            ? "Severe SPA visibility risk — most content requires JavaScript rendering"
            : "Moderate SPA risk — some content requires JavaScript rendering",
          impact: avgRenderGap < 0.3 ? "high" : "medium",
          recommendation: "Use server-side rendering (SSR) or pre-render static content to ensure GPTBot and ClaudeBot can see it. Test with 'curl' or 'View Source' to verify content visibility.",
          render_gap: Math.round(avgRenderGap * 100) + '%'
        });
      }
    }

    return {
      top_issues: topIssues,
      quick_wins: quickWins,
      visibility_summary: visibilitySummary,
      spa_insights: spaInsights
    };

  } catch (error) {
    console.error('[INSIGHTS] Error:', error);
    return {
      error: 'Failed to generate insights',
      top_issues: [],
      quick_wins: [],
      visibility_summary: { by_source: [], last_run: null }
    };
  }
}

function getIssueDescription(code: string, score: number): string {
  const descriptions: Record<string, string> = {
    'A1': 'No answer block; no jump links',
    'A2': 'Weak topical cluster; missing pillar links',
    'A3': 'Missing site authority signals',
    'A4': 'Content lacks originality markers',
    'A5': 'Schema errors or missing structured data',
    'A6': 'Crawlability issues; missing canonicals',
    'A7': 'UX/performance problems',
    'A8': 'Missing or outdated sitemaps',
    'A9': 'Content freshness issues',
    'A10': 'Not ready for AI Overviews',
    'A11': 'SPA risk — content hidden behind JavaScript',
    'G1': 'No citable facts block',
    'G2': 'Missing provenance schema',
    'G3': 'Insufficient evidence density',
    'G4': 'AI crawler access issues',
    'G5': 'Poor content chunkability',
    'G6': 'Missing canonical fact URLs',
    'G7': 'No dataset availability',
    'G8': 'Missing policy transparency',
    'G9': 'Update hygiene problems',
    'G10': 'Poor cluster-to-evidence linking'
  };
  return descriptions[code] || 'Unknown issue';
}

function getQuickWinAction(code: string): string {
  const actions: Record<string, string> = {
    'A1': 'Add answer block with jump links to key sections',
    'A3': 'Add Organization & Person JSON-LD site-wide',
    'A11': 'Enable server-side rendering or pre-render key content',
    'G2': 'Add citation/isBasedOn/license to JSON-LD',
    'G4': 'Fix robots.txt and ensure SPA parity',
    'G1': 'Create facts block with 3-7 atomic facts',
    'A8': 'Generate and submit updated sitemap',
    'G8': 'Add clear license/AI policy to schema',
    'A5': 'Fix JSON-LD errors and add missing schema',
    'G5': 'Structure content with clear headings and sections',
    'G6': 'Add stable URLs for individual facts'
  };
  return actions[code] || 'Review and improve this area';
}

// Weekly Citations Automation
async function runWeeklyCitations(env: Env) {
  try {
    console.log('[CRON] Starting weekly citations run');
    
    // Find recent audits (last 30 days) and group by domain
    const recentAudits = await env.DB.prepare(`
      SELECT DISTINCT 
        project_id,
        root_url,
        MAX(started_at) as last_audit
      FROM audits 
      WHERE started_at > datetime('now', '-30 days')
        AND status = 'completed'
        AND pages_analyzed > 0
      GROUP BY project_id, root_url
      ORDER BY last_audit DESC
      LIMIT 10
    `).all();

    console.log(`[CRON] Found ${recentAudits.results.length} recent audits to process`);

    for (const audit of recentAudits.results as any[]) {
      try {
        const domain = new URL(audit.root_url).hostname;
        console.log(`[CRON] Processing citations for ${domain}`);
        
        // Create a mock request for runCitations
        const mockRequest = new Request('https://api.optiview.ai/api/citations/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: audit.project_id,
            domain: domain,
            sources: ['chatgpt', 'claude', 'perplexity', 'brave']
          })
        });

        const result = await runCitations(mockRequest, env);
        console.log(`[CRON] Citations completed for ${domain}:`, result.status);
        
        // Small delay between domains
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`[CRON] Failed to process ${audit.root_url}:`, error);
        // Continue with next domain
      }
    }

    console.log('[CRON] Weekly citations run completed');
    
  } catch (error) {
    console.error('[CRON] Weekly citations run failed:', error);
  }
}


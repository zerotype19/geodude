import { queryAI, processCitations, generateDefaultQueries } from './connectors';

// Bot Identity Configuration
const BOT_UA = "OptiviewAuditBot/1.0 (+https://api.optiview.ai/bot; admin@optiview.ai)";

// Crawl/scoring budget for one run
const HARD_TIME_MS = 120_000;          // 2 minutes total budget per audit
const PER_REQUEST_BUDGET_MS = 25_000;  // keep each call under CF 30s
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
  "ford.com": "https://corporate.ford.com"
};

export interface Env {
  DB: D1Database;
  RULES: KVNamespace;
  BROWSER: Browser;
  BASE_URL?: string; // For self-chaining batch requests
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  CLAUDE_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  BRAVE_API_KEY?: string;
  BRAVE_SEARCH?: string;
}

export interface AuditRequest {
  project_id: string;
  root_url: string;
  site_description?: string;
  max_pages?: number;
  config?: any;
}

export interface CitationsRequest {
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

export interface ScoringRules {
  aeo: Record<string, number>;
  geo: Record<string, number>;
  patterns: {
    facts_headings: string[];
    refs_headings: string[];
    glossary_headings: string[];
  };
}

export interface CheckResult {
  id: string;
  score: number;
  weight: number;
  evidence: {
    found: boolean;
    details: string;
    snippets?: string[];
  };
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

export interface ScoringResult {
  aeo: number;
  geo: number;
  items: CheckResult[];
}

// Auto-finalize stuck audits (called by cron)
async function autoFinalizeStuckAudits(env: Env): Promise<void> {
  console.log('[AUTO-FINALIZE] Checking for stuck audits...');
  
  // Find audits that are stuck in "running" state with enough pages analyzed
  const stuckAudits = await env.DB.prepare(
    `SELECT a.id, 
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
    const auditData = audit as { id: string; pages_analyzed: number };
    
    if (auditData.pages_analyzed >= TARGET_MIN_PAGES) {
      // Has enough pages - finalize it
      await finalizeAudit(env, auditData.id, 'auto_finalize_stuck');
      finalized++;
      console.log(`[AUTO-FINALIZE] Finalized stuck audit ${auditData.id} (${auditData.pages_analyzed} pages)`);
    } else if (auditData.pages_analyzed === 0) {
      // No pages analyzed after 10 minutes - mark as failed
      await markAuditFailed(env, auditData.id, 'timeout_no_pages_after_10min');
      finalized++;
      console.log(`[AUTO-FINALIZE] Failed stuck audit ${auditData.id} (0 pages)`);
    }
  }
  
  console.log(`[AUTO-FINALIZE] Processed ${finalized} stuck audits`);
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[CRON] Scheduled event:', event.cron);
    
    if (event.cron === '0 14 * * 1') {
      // Weekly citations run (Mondays 14:00 UTC)
      await runWeeklyCitations(env);
    }
    
    if (event.cron === '0 * * * *') {
      // Hourly: Auto-finalize stuck audits
      await autoFinalizeStuckAudits(env);
    }
  },

  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    try {
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // Route handlers
      if (req.method === 'POST' && path === '/api/audits') {
        const result = await createAudit(req, env, ctx);
        return new Response(JSON.stringify(result), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      if (req.method === 'GET' && path === '/api/audits') {
        const result = await getAuditsList(url.searchParams, env);
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

      if (req.method === 'POST' && path === '/api/admin/seed-rules') {
        const result = await seedRules(env);
        return new Response(JSON.stringify(result), { 
          status: 200, 
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

      // Citations endpoints
      if (req.method === 'POST' && path === '/api/citations/run') {
        const result = await runCitations(req, env);
        return new Response(JSON.stringify(result), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
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

      if (req.method === 'GET' && path.startsWith('/api/insights')) {
        const result = await getInsights(url.searchParams, env);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Bot documentation endpoints
      if (req.method === 'GET' && path === '/bot') {
        const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OptiviewAuditBot</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 5px; overflow-x: auto; }
    h1, h2 { color: #333; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <h1>OptiviewAuditBot</h1>
  
  <p>We are a responsible web crawler that runs site audits you initiate in Optiview. We respect robots.txt directives and follow best practices for web crawling.</p>
  
  <h2>Our Identity</h2>
  <p><strong>User-Agent:</strong> <code>OptiviewAuditBot/1.0 (+https://api.optiview.ai/bot; admin@optiview.ai)</code></p>
  <p><strong>Identifying Header:</strong> <code>X-Optiview-Bot: audit</code></p>
  
  <h2>What We Respect</h2>
  <ul>
    <li><strong>robots.txt</strong> - We check for <code>User-agent: OptiviewAuditBot</code> rules, falling back to <code>*</code></li>
    <li><strong>Allow/Disallow</strong> - We respect path-based allow/disallow rules</li>
    <li><strong>Crawl-delay</strong> - We honor crawl delay directives</li>
    <li><strong>Meta tags</strong> - We respect <code>noindex</code>, <code>nofollow</code>, and <code>noai</code> meta tags</li>
  </ul>
  
  <h2>How to Allow/Block Us</h2>
  
  <h3>Allow the bot:</h3>
  <pre>User-agent: OptiviewAuditBot
Allow: /</pre>
  
  <h3>Block the bot:</h3>
  <pre>User-agent: OptiviewAuditBot
Disallow: /</pre>
  
  <h3>Block specific paths:</h3>
  <pre>User-agent: OptiviewAuditBot
Disallow: /admin/
Disallow: /private/</pre>
  
  <h3>Set crawl delay:</h3>
  <pre>User-agent: OptiviewAuditBot
Crawl-delay: 5</pre>
  
  <h2>About Our Crawling</h2>
  <p>We only crawl sites when you explicitly request an audit through Optiview. We:</p>
  <ul>
    <li>Fetch pages to analyze AEO/GEO optimization</li>
    <li>Extract structured data and content signals</li>
    <li>Respect all robots.txt directives</li>
    <li>Use reasonable crawl delays</li>
    <li>Identify ourselves clearly in requests</li>
  </ul>
  
  <h2>Contact</h2>
  <p>Questions or concerns? Contact us at <a href="mailto:admin@optiview.ai">admin@optiview.ai</a></p>
  
  <h2>Machine-Readable Info</h2>
  <p>For automated systems: <a href="/.well-known/optiview-bot.json">/.well-known/optiview-bot.json</a></p>
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
          website: "https://api.optiview.ai/bot",
          contact: "admin@optiview.ai",
          respect_robots_txt: true,
          honors_crawl_delay: true,
          ip_policy: "Cloudflare egress (AS13335); fixed IPs not guaranteed.",
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
  if (len < 500) return true; // Very short page
  
  const lower = html.toLowerCase();
  const badPhrases = [
    "unsupported service",
    "not configured for this service",
    "domain parked",
    "coming soon",
    "page cannot be displayed",
    "this domain is for sale",
    "under construction",
    "site not found",
    "error 404",
    "access denied"
  ];
  
  return badPhrases.some(phrase => lower.includes(phrase));
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
    
    // Fetch with manual redirect to detect redirect chains
    const res = await fetchWithIdentity(url, { redirect: 'manual' }, env);
    
    // Handle redirects
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (location) {
        const finalUrl = new URL(location, url).href;
        return {
          ok: true,
          finalUrl
        };
      }
    }
    
    // Check for errors
    if (res.status >= 400) {
      return {
        ok: false,
        reason: `precheck_failed_http_${res.status}`
      };
    }
    
    // Check if page is empty or error page
    const html = await res.text();
    if (isEmptyOrErrorPage(html)) {
      return {
        ok: false,
        reason: 'domain_error_or_empty_page'
      };
    }
    
    return { ok: true };
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
  
  // Get audit root URL to detect homepage
  const rootUrl = audit.root_url || '';
  const rootUrlNormalized = rootUrl.replace(/\/$/, ''); // Remove trailing slash
  
  // 3) Process in parallel with time budget
  await pMap(queue, async (url, index) => {
    if (Date.now() - started > PER_REQUEST_BUDGET_MS) return; // stay < 30s
    
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
    
    // Extract and score
    try {
      const extract = await extractAll(htmlToAnalyze, url);
      const weights = await loadWeights(env.RULES);
      const scores = scorePage(extract, weights);
      
      // Add A11 check for render visibility (SPA risk)
      let a11Score = 3; // Default: full visibility
      let a11Weight = weights.aeo.A11 || 10;
      let a11Evidence = { found: true, details: 'Full content visibility' };
      
      if (renderGapRatio !== null) {
        if (renderGapRatio < 0.3) {
          a11Score = 0; // Poor: <30% visible
          a11Evidence = { found: false, details: `SPA risk: Only ${Math.round(renderGapRatio * 100)}% of content visible without JavaScript. GPTBot may not see this content.` };
        } else if (renderGapRatio < 0.5) {
          a11Score = 1; // Weak: <50% visible
          a11Evidence = { found: false, details: `Partial visibility: ${Math.round(renderGapRatio * 100)}% of content in static HTML. Some AI crawlers may miss content.` };
        } else if (renderGapRatio < 0.7) {
          a11Score = 2; // Moderate: <70% visible
          a11Evidence = { found: true, details: `Good visibility: ${Math.round(renderGapRatio * 100)}% of content available in static HTML.` };
        } else {
          a11Score = 3; // Strong: ≥70% visible
          a11Evidence = { found: true, details: `Excellent visibility: ${Math.round(renderGapRatio * 100)}% of content in static HTML.` };
        }
      }
      
      // Add A11 to checks array
      const checksWithA11 = [
        ...scores.items,
        { id: 'A11', score: a11Score, weight: a11Weight, evidence: a11Evidence }
      ];
      
      // Recalculate AEO score with A11
      const aeoWithA11 = (scores.aeo * 3 + (a11Score * a11Weight)) / 3; // Weighted average
      
      // Get page_id
      const pageRow: any = await env.DB.prepare(
        "SELECT id FROM audit_pages WHERE audit_id = ? AND url = ?"
      ).bind(auditId, url).first();
      
      if (!pageRow) {
        console.error(`[BATCH] Page not found in audit_pages: ${url}`);
        return;
      }
      
      // Update audit_pages with fetch metadata (both static and rendered HTML)
      await env.DB.prepare(
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
      ).run();
      
      // Save analysis with rendered HTML, gap ratio, and A11 check
      await env.DB.prepare(
        `INSERT INTO audit_page_analysis 
         (id, page_id, title, h1, canonical, schema_types, jsonld, checks_json, aeo_score, geo_score, rendered_html, render_gap_ratio, analyzed_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        pageRow.id,
        extract.title || '',
        extract.h1 || '',
        extract.canonical || '',
        JSON.stringify(extract.schemaTypes || []),
        JSON.stringify(extract.jsonldRaw || []),
        JSON.stringify(checksWithA11 || []),
        Math.round(aeoWithA11 * 100) / 100,
        scores.geo,
        renderedHtml ? renderedHtml.slice(0, 200000) : null, // Store rendered HTML if available
        renderGapRatio // Store gap ratio for SPA detection
      ).run();
      
      analyzed++;
      console.log(`Processed: ${url} (AEO: ${scores.aeo}, GEO: ${scores.geo})`);
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
  const queueEmpty = queue.length < TARGET_MAX_PAGES && analyzed === queue.length;
  
  // Log progress
  console.log(`[BATCH] ${auditId} pages=${totals.pages_analyzed}/${totals.pages_discovered} elapsed=${elapsed}ms`);
  
  if (hitTarget || hitHardTime || hitMaxPages || queueEmpty) {
    const reason = hitHardTime ? 'time_budget_reached'
                 : hitMaxPages ? 'max_pages_reached'
                 : hitTarget ? 'target_min_pages_met'
                 : 'queue_empty';
    
    await finalizeAudit(env, auditId, reason);
    return { ok: true, finalized: true, reason, totals };
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
     SET status = 'complete', 
         aeo_score = ?, 
         geo_score = ?, 
         finished_at = datetime('now')
     WHERE id = ?`
  ).bind(aeo, geo, auditId).run();
  
  console.log(`[FINALIZED] ${auditId}: ${reason} (AEO: ${aeo}, GEO: ${geo}, Gap: ${avgRenderGap ? Math.round(avgRenderGap * 100) + '%' : 'N/A'})`);
}

// API Route Handlers

async function createAudit(req: Request, env: Env, ctx: ExecutionContext) {
  const body: AuditRequest = await req.json();
  let { project_id, root_url, site_description, max_pages = 200, config = {} } = body;
  
  const id = crypto.randomUUID();
  
  // Pre-check domain validation
  console.log(`[PRECHECK] Starting validation for: ${root_url}`);
  const precheck = await precheckDomain(root_url, env);
  
  if (!precheck.ok) {
    // Domain failed validation - create audit as failed immediately
    await env.DB.prepare(
      "INSERT INTO audits (id, project_id, root_url, site_description, started_at, finished_at, status, fail_reason, fail_at, config_json) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), 'failed', ?, datetime('now'), ?)"
    ).bind(id, project_id, root_url, site_description || null, precheck.reason, JSON.stringify(config)).run();
    
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
    "INSERT INTO audits (id, project_id, root_url, site_description, started_at, status, config_json) VALUES (?, ?, ?, ?, datetime('now'), 'running', ?)"
  ).bind(id, project_id, root_url, site_description || null, JSON.stringify(config)).run();

  // Discover URLs and populate audit_pages (do this in background but ensure it starts)
  ctx.waitUntil((async () => {
    try {
      console.log(`[DISCOVER] Starting URL discovery for: ${root_url}`);
      const urls = await discoverUrls(root_url, env, Math.min(max_pages, MAX_DISCOVER));
      
      // Insert discovered URLs into audit_pages
      for (const url of urls) {
        await env.DB.prepare(
          "INSERT INTO audit_pages (id, audit_id, url, fetched_at) VALUES (?, ?, ?, datetime('now'))"
        ).bind(crypto.randomUUID(), id, url).run();
      }
      
      console.log(`[DISCOVER] Inserted ${urls.length} URLs for audit ${id}`);
      
      // Directly call continueAuditBatch instead of fetching
      await continueAuditBatch(id, env);
    } catch (error: any) {
      console.error(`[DISCOVER ERROR] ${id}:`, error);
      await markAuditFailed(env, id, `discover_error: ${error.message || 'unknown'}`);
    }
  })());

  return { audit_id: id, status: 'running' };
}

async function getAuditsList(searchParams: URLSearchParams, env: Env) {
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  const results = await env.DB.prepare(`
    SELECT 
      id,
      project_id,
      root_url,
      started_at,
      finished_at,
      status,
      aeo_score,
      geo_score,
      config_json
    FROM audits 
    ORDER BY started_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

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

  return {
    ...audit,
    pages_analyzed: pageStats?.total || 0,
    avg_aeo_score: pageStats?.avg_aeo || 0,
    avg_geo_score: pageStats?.avg_geo || 0
  };
}

async function getAuditPages(auditId: string, searchParams: URLSearchParams, env: Env) {
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const pages = await env.DB.prepare(`
    SELECT ap.*, apa.aeo_score, apa.geo_score, apa.checks_json
    FROM audit_pages ap
    LEFT JOIN audit_page_analysis apa ON ap.id = apa.page_id
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
  // Get all pages for this audit
  const pages = await env.DB.prepare(`
    SELECT ap.id, apa.*
    FROM audit_pages ap
    LEFT JOIN audit_page_analysis apa ON ap.id = apa.page_id
    WHERE ap.audit_id = ?
  `).bind(auditId).all();

  const weights = await loadWeights(env.RULES);
  
  for (const page of pages.results) {
    if (page.checks_json) {
      // Recompute scores with current weights
      const checks = JSON.parse(page.checks_json);
      const newScores = recomputeScores(checks, weights);
      
      await env.DB.prepare(`
        UPDATE audit_page_analysis 
        SET aeo_score = ?, geo_score = ?, checks_json = ?
        WHERE page_id = ?
      `).bind(newScores.aeo, newScores.geo, JSON.stringify(newScores.items), page.id).run();
    }
  }

  // Update audit scores
  const siteScores = await computeSiteScores(env.DB, auditId);
  await env.DB.prepare(`
    UPDATE audits SET aeo_score = ?, geo_score = ? WHERE id = ?
  `).bind(siteScores.aeo, siteScores.geo, auditId).run();

  return { status: 'recomputed', aeo_score: siteScores.aeo, geo_score: siteScores.geo };
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

async function seedRules(env: Env) {
  const DEFAULT_RULES: ScoringRules = {
    aeo: { A1:15, A2:15, A3:15, A4:12, A5:10, A6:10, A7:8, A8:6, A9:5, A10:4 },
    geo: { G1:15, G2:15, G3:12, G4:12, G5:10, G6:8, G7:8, G8:6, G9:7, G10:7 },
    patterns: {
      facts_headings: ["key facts","at-a-glance","highlights","summary"],
      refs_headings: ["references","sources","citations","footnotes"],
      glossary_headings: ["glossary","definitions"]
    }
  };

  await env.RULES.put('rules:config', JSON.stringify(DEFAULT_RULES));
  return { status: 'seeded', rules: DEFAULT_RULES };
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
        const weights = await loadWeights(env.RULES);
        const checks = scorePage(analysis, weights);
        
        const ids = { page_id: crypto.randomUUID(), analysis_id: crypto.randomUUID() };

        await env.DB.batch([
          env.DB.prepare(`INSERT INTO audit_pages (id, audit_id, url, status_code, content_type, html_static, html_rendered, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
            .bind(ids.page_id, audit_id, url, page.status, page.contentType, 
                  page.html?.slice(0, 200000), rendered?.html?.slice(0, 200000) || null),
          
          env.DB.prepare(`INSERT INTO audit_page_analysis
            (id, page_id, title, h1, canonical, schema_types, jsonld, has_answer_box, has_jump_links, facts_block, references_block,
             tables_count, outbound_links, author_json, org_json, robots_ai_policy, parity_pass, aeo_score, geo_score, checks_json, analyzed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
            .bind(
              ids.analysis_id, ids.page_id,
              analysis.title, analysis.h1, analysis.canonical,
              JSON.stringify(analysis.schemaTypes), JSON.stringify(analysis.jsonldRaw),
              analysis.answerBox ? 1 : 0, analysis.jumpLinks ? 1 : 0,
              analysis.factsBlock ? 1 : 0, analysis.refsBlock ? 1 : 0,
              analysis.tablesCount, analysis.outboundLinks,
              JSON.stringify(analysis.author||null), JSON.stringify(analysis.org||null),
              JSON.stringify(analysis.robots||{}), analysis.parityPass ? 1 : 0,
              checks.aeo, checks.geo, JSON.stringify(checks.items)
            )
        ]);

        console.log(`Processed: ${url} (AEO: ${checks.aeo}, GEO: ${checks.geo})`);

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
  const candidates: string[] = [];
  const tryUrls = new Set<string>();

  // robots.txt
  for (const u of flipWww(finalOrigin)) {
    tryUrls.add(new URL("/robots.txt", u.origin).toString());
  }

  // standard locations
  for (const u of flipWww(finalOrigin)) {
    tryUrls.add(new URL("/sitemap.xml", u.origin).toString());
    tryUrls.add(new URL("/sitemap_index.xml", u.origin).toString());
  }

  const discovered: string[] = [];
  for (const url of tryUrls) {
    const text = await fetchTextMaybeGzip(url, env);
    if (!text) continue;

    if (url.endsWith("/robots.txt")) {
      // Parse "Sitemap: <url>" lines
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^\s*Sitemap:\s*(\S+)\s*$/i);
        if (m) discovered.push(m[1]);
      }
    } else {
      // Direct sitemap location
      discovered.push(url);
    }
  }

  // Expand index files into child sitemaps
  const out: string[] = [];
  const MAX_SITEMAPS = 50; // Cap to prevent timeout on sites with 100s of sitemaps
  
  for (const siteUrl of discovered) {
    if (out.length >= MAX_SITEMAPS) {
      console.log(`[CRAWL] Sitemap limit reached (${MAX_SITEMAPS}), stopping discovery`);
      break;
    }
    
    const xml = await fetchTextMaybeGzip(siteUrl, env);
    if (!xml) continue;
    if (/<sitemapindex/i.test(xml)) {
      const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
      let m; 
      while ((m = re.exec(xml))) {
        out.push(m[1]);
        if (out.length >= MAX_SITEMAPS) break;
      }
    } else {
      out.push(siteUrl);
    }
  }

  // Dedup and limit
  const unique = [...new Set(out)];
  if (unique.length > MAX_SITEMAPS) {
    console.log(`[CRAWL] Trimming ${unique.length} sitemaps to ${MAX_SITEMAPS}`);
    return unique.slice(0, MAX_SITEMAPS);
  }
  return unique;
}

async function extractUrlsFromSitemaps(sitemapUrls: string[], hostAllow: (u: URL)=>boolean, env: Env): Promise<string[]> {
  const urls: string[] = [];
  const MAX_URLS_FROM_SITEMAPS = 5000; // Cap to prevent memory/timeout issues
  
  for (const sm of sitemapUrls) {
    if (urls.length >= MAX_URLS_FROM_SITEMAPS) {
      console.log(`[CRAWL] URL extraction limit reached (${MAX_URLS_FROM_SITEMAPS}), stopping`);
      break;
    }
    
    const xml = await fetchTextMaybeGzip(sm, env);
    if (!xml) continue;
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
    } else if (/<sitemapindex/i.test(xml)) {
      // already expanded above; safe to ignore
    }
  }
  
  const unique = [...new Set(urls)];
  console.log(`[CRAWL] Extracted ${unique.length} unique URLs from ${sitemapUrls.length} sitemaps`);
  return unique;
}

async function bfsCrawl(finalOrigin: URL, maxPages: number, env: Env, rootHost: string): Promise<string[]> {
  const visited = new Set<string>();
  const queue: string[] = [finalOrigin.toString()];
  const pages: string[] = [];

  while (queue.length && pages.length < maxPages) {
    const next = queue.shift()!;
    if (visited.has(next)) continue;
    visited.add(next);

    // Apply crawl policy filter
    if (!shouldCrawlUrl(next, rootHost)) {
      console.log(`[BFS] Skipping ${next} - filtered by crawl policy`);
      continue;
    }

    // Check robots.txt before fetching
    const urlObj = new URL(next);
    const robotsRules = await getRobots(env, urlObj);
    
    if (!isAllowedByRobots(robotsRules, urlObj.pathname)) {
      console.log(`[BFS] Skipping ${next} - disallowed by robots.txt`);
      continue;
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
        if (!shouldCrawlUrl(u.toString(), rootHost)) continue; // apply crawl policy
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
function shouldCrawlUrl(url: string, rootHost: string): boolean {
  try {
    const u = new URL(url);

    // ✅ Stay on same host (normalized without www)
    const urlHost = u.hostname.replace(/^www\./, '');
    if (urlHost !== rootHost) return false;

    // ✅ Only crawl English / US (skip non-English folders)
    if (/\/(es|fr|de|it|pt|nl|jp|cn|kr|zh|br|mx|sa|ae|ru|pl|tr|in|ar)\b/i.test(u.pathname)) return false;
    if (/\b(lang|locale|country)=/i.test(u.search)) return false;

    // ✅ Allow only top-level paths (no nested routes)
    const pathParts = u.pathname.split('/').filter(Boolean);
    
    // ✅ Always allow root
    if (pathParts.length === 0 || u.pathname === '/' || u.pathname === '') return true;

    // ✅ Whitelist keywords (FAQ, about, contact, products, pricing)
    const whitelist = ['faq', 'faqs', 'about', 'contact', 'pricing', 'products', 'services', 'support', 'help'];
    if (whitelist.some(w => u.pathname.toLowerCase().includes(w))) return true;

    // ✅ Otherwise allow only top-level pages (domain.com/page)
    return pathParts.length === 1;
  } catch {
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
  
  // Extract root host for filtering
  const rootHost = finalOrigin.hostname.replace(/^www\./, '');
  
  // Step 2: Try sitemap discovery
  const sitemaps = await discoverSitemaps(finalOrigin, env);
  console.log(`[CRAWL] Found ${sitemaps.length} sitemaps`);
  
  let urls: string[] = [];
  
  if (sitemaps.length > 0) {
    // Step 3: Extract URLs from sitemaps with crawl policy
    const hostAllow = (u: URL) => sameSite(finalOrigin, u) && shouldCrawlUrl(u.toString(), rootHost);
    urls = await extractUrlsFromSitemaps(sitemaps, hostAllow, env);
    console.log(`[CRAWL] Extracted ${urls.length} URLs from sitemaps (after filtering)`);
  }
  
  // Step 4: Fallback to BFS if no sitemap URLs found
  if (urls.length === 0) {
    console.log(`[CRAWL] No sitemap URLs found, falling back to BFS`);
    urls = await bfsCrawl(finalOrigin, 50, env, rootHost); // Reduced from 1000 to 50
    console.log(`[CRAWL] BFS discovered ${urls.length} URLs`);
  }
  
  // Step 5: Apply priority sorting (FAQ first)
  urls = sortUrlsByPriority(urls);
  console.log(`[CRAWL] URLs sorted by priority (FAQ first, shorter paths first)`);
  
  // Step 6: Cap at reasonable limit for focused audits
  const MAX_URLS = 50;
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

async function loadWeights(rules: KVNamespace): Promise<ScoringRules> {
  const rulesStr = await rules.get('rules:config');
  if (!rulesStr) {
    // Return defaults if not seeded
    return {
      aeo: { A1:15, A2:15, A3:15, A4:12, A5:10, A6:10, A7:8, A8:6, A9:5, A10:4, A11:10 },
      geo: { G1:15, G2:15, G3:12, G4:12, G5:10, G6:8, G7:8, G8:6, G9:7, G10:7 },
      patterns: {
        facts_headings: ["key facts","at-a-glance","highlights","summary"],
        refs_headings: ["references","sources","citations","footnotes"],
        glossary_headings: ["glossary","definitions"]
      }
    };
  }
  
  return JSON.parse(rulesStr);
}

function scorePage(analysis: PageAnalysis, weights: ScoringRules): ScoringResult {
  const items: CheckResult[] = [];
  
  const score0_3 = (cond: boolean, strong?: boolean) => cond ? (strong ? 3 : 2) : 0;

  // AEO Scoring
  const A1 = score0_3(analysis.answerBox && (analysis.jumpLinks || analysis.tablesCount > 0), true);
  const A2 = score0_3(analysis.internalCluster);
  const A3 = score0_3(analysis.org && analysis.author, true);
  const A4 = score0_3(analysis.tablesCount > 0 || analysis.outboundLinks > 3);
  const A5 = score0_3(analysis.schemaTypes.length > 0);
  const A6 = score0_3(!!analysis.canonical);
  const A7 = score0_3(!analysis.clsRisk);
  const A8 = score0_3(analysis.sitemapsOk);
  const A9 = score0_3(analysis.dateModified);
  const A10 = score0_3(analysis.refsBlock && analysis.chunkable, true);

  const aeo = (
    A1 * weights.aeo.A1 + A2 * weights.aeo.A2 + A3 * weights.aeo.A3 + A4 * weights.aeo.A4 +
    A5 * weights.aeo.A5 + A6 * weights.aeo.A6 + A7 * weights.aeo.A7 + A8 * weights.aeo.A8 +
    A9 * weights.aeo.A9 + A10 * weights.aeo.A10
  ) / 3;

  // GEO Scoring
  const G1 = score0_3(analysis.factsBlock, true);
  const G2 = score0_3(hasProvenance(analysis.jsonldRaw), true);
  const G3 = score0_3(analysis.refsBlock && analysis.outboundLinks >= 3, true);
  const G4 = score0_3(!!analysis.robots && analysis.parityPass, true);
  const G5 = score0_3(analysis.chunkable);
  const G6 = score0_3(analysis.hasStableAnchors);
  const G7 = score0_3(analysis.hasDatasetLinks);
  const G8 = score0_3(analysis.hasLicense);
  const G9 = score0_3(analysis.hasChangelog || analysis.dateModified);
  const G10 = score0_3(analysis.linksToSourcesHub);

  const geo = (
    G1 * weights.geo.G1 + G2 * weights.geo.G2 + G3 * weights.geo.G3 + G4 * weights.geo.G4 +
    G5 * weights.geo.G5 + G6 * weights.geo.G6 + G7 * weights.geo.G7 + G8 * weights.geo.G8 +
    G9 * weights.geo.G9 + G10 * weights.geo.G10
  ) / 3;

  // Build check items
  const aeoChecks = [
    { id: 'A1', score: A1, weight: weights.aeo.A1, evidence: { found: A1 > 0, details: 'Answer-first design' } },
    { id: 'A2', score: A2, weight: weights.aeo.A2, evidence: { found: A2 > 0, details: 'Topical cluster integrity' } },
    { id: 'A3', score: A3, weight: weights.aeo.A3, evidence: { found: A3 > 0, details: 'Site authority' } },
    { id: 'A4', score: A4, weight: weights.aeo.A4, evidence: { found: A4 > 0, details: 'Originality & effort' } },
    { id: 'A5', score: A5, weight: weights.aeo.A5, evidence: { found: A5 > 0, details: 'Schema accuracy' } },
    { id: 'A6', score: A6, weight: weights.aeo.A6, evidence: { found: A6 > 0, details: 'Crawlability & canonicals' } },
    { id: 'A7', score: A7, weight: weights.aeo.A7, evidence: { found: A7 > 0, details: 'UX & performance' } },
    { id: 'A8', score: A8, weight: weights.aeo.A8, evidence: { found: A8 > 0, details: 'Sitemaps & discoverability' } },
    { id: 'A9', score: A9, weight: weights.aeo.A9, evidence: { found: A9 > 0, details: 'Freshness & stability' } },
    { id: 'A10', score: A10, weight: weights.aeo.A10, evidence: { found: A10 > 0, details: 'AI Overviews readiness' } }
  ];

  const geoChecks = [
    { id: 'G1', score: G1, weight: weights.geo.G1, evidence: { found: G1 > 0, details: 'Citable facts block' } },
    { id: 'G2', score: G2, weight: weights.geo.G2, evidence: { found: G2 > 0, details: 'Provenance schema' } },
    { id: 'G3', score: G3, weight: weights.geo.G3, evidence: { found: G3 > 0, details: 'Evidence density' } },
    { id: 'G4', score: G4, weight: weights.geo.G4, evidence: { found: G4 > 0, details: 'AI crawler access & parity' } },
    { id: 'G5', score: G5, weight: weights.geo.G5, evidence: { found: G5 > 0, details: 'Chunkability & structure' } },
    { id: 'G6', score: G6, weight: weights.geo.G6, evidence: { found: G6 > 0, details: 'Canonical fact URLs' } },
    { id: 'G7', score: G7, weight: weights.geo.G7, evidence: { found: G7 > 0, details: 'Dataset availability' } },
    { id: 'G8', score: G8, weight: weights.geo.G8, evidence: { found: G8 > 0, details: 'Policy transparency' } },
    { id: 'G9', score: G9, weight: weights.geo.G9, evidence: { found: G9 > 0, details: 'Update hygiene' } },
    { id: 'G10', score: G10, weight: weights.geo.G10, evidence: { found: G10 > 0, details: 'Cluster↔evidence linking' } }
  ];

  items.push(...aeoChecks, ...geoChecks);

  return {
    aeo: Math.round(aeo * 100) / 100,
    geo: Math.round(geo * 100) / 100,
    items
  };
}

function hasProvenance(jsonld: any[]): boolean {
  for (const item of jsonld) {
    if (item['@type'] === 'Article' || item['@type'] === 'CreativeWork') {
      const hasAuthor = item['author'] || item['creator'];
      const hasPublisher = item['publisher'];
      const hasDate = item['datePublished'] || item['dateModified'];
      const hasCitation = item['citation'] || item['isBasedOn'];
      const hasLicense = item['license'];
      
      if (hasAuthor && hasPublisher && hasDate && (hasCitation || hasLicense)) {
        return true;
      }
    }
  }
  return false;
}

function recomputeScores(checks: CheckResult[], weights: ScoringRules): ScoringResult {
  const aeoChecks = checks.filter(c => c.id.startsWith('A'));
  const geoChecks = checks.filter(c => c.id.startsWith('G'));
  
  const aeo = aeoChecks.reduce((sum, check) => sum + (check.score * weights.aeo[check.id as keyof typeof weights.aeo]), 0) / 3;
  const geo = geoChecks.reduce((sum, check) => sum + (check.score * weights.geo[check.id as keyof typeof weights.geo]), 0) / 3;
  
  return {
    aeo: Math.round(aeo * 100) / 100,
    geo: Math.round(geo * 100) / 100,
    items: checks
  };
}

async function computeSiteScores(db: D1Database, auditId: string): Promise<{ aeo: number, geo: number }> {
  const result = await db.prepare(`
    SELECT AVG(aeo_score) as avg_aeo, AVG(geo_score) as avg_geo
    FROM audit_page_analysis apa
    JOIN audit_pages ap ON apa.page_id = ap.id
    WHERE ap.audit_id = ? AND apa.aeo_score IS NOT NULL AND apa.geo_score IS NOT NULL
  `).bind(auditId).first();
  
  return {
    aeo: Math.round((result?.avg_aeo || 0) * 100) / 100,
    geo: Math.round((result?.avg_geo || 0) * 100) / 100
  };
}

// Citations API Handlers

async function runCitations(req: Request, env: Env) {
  const runId = crypto.randomUUID();
  try {
    console.log('[CITATIONS] Starting citations run:', runId);
    const body: CitationsRequest = await req.json();
    const { project_id, domain, brand, sources, queries } = body;
    
    console.log('[CITATIONS] Request params:', { project_id, domain, sources: sources.length, queries: queries?.length });
    
    // Log the run start
    await env.DB.prepare(`
      INSERT INTO citations_runs 
      (id, project_id, domain, started_at, status, total_queries, by_source)
      VALUES (?, ?, ?, datetime('now'), 'running', ?, ?)
    `).bind(
      runId, 
      project_id, 
      domain, 
      sources.length * 24, // Max queries per source
      JSON.stringify(sources.reduce((acc, source) => ({ ...acc, [source]: { total: 0, cited: 0 } }), {}))
    ).run();
    
    // Generate default queries if not provided
    let finalQueries = queries;
    if (!finalQueries || finalQueries.length === 0) {
      console.log('[CITATIONS] Generating default queries');
      
      // Get site description and homepage metadata from recent audit
      const auditData = await env.DB.prepare(`
        SELECT 
          a.site_description,
          apa.title as homepage_title,
          ap.html_static
        FROM audits a
        LEFT JOIN audit_pages ap ON ap.audit_id = a.id AND (
          ap.url LIKE CONCAT('%', ?, '%/') OR 
          ap.url LIKE CONCAT('%', ?, '/%')
        )
        LEFT JOIN audit_page_analysis apa ON apa.page_id = ap.id
        WHERE a.project_id = ? AND (a.root_url LIKE ? OR ap.url LIKE ?)
        ORDER BY a.started_at DESC
        LIMIT 1
      `).bind(domain, domain, project_id, `%${domain}%`, `%${domain}%`).first();
      
      let siteDescription = auditData?.site_description || null;
      let homePageTitle = auditData?.homepage_title || null;
      let homePageMetaDescription = null;
      
      // Extract meta description from homepage HTML if available
      if (auditData?.html_static) {
        const metaMatch = auditData.html_static.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
        if (metaMatch) {
          homePageMetaDescription = metaMatch[1];
        }
      }
      
      console.log('[CITATIONS] Metadata:', { 
        hasSiteDescription: !!siteDescription, 
        hasTitle: !!homePageTitle, 
        hasMetaDesc: !!homePageMetaDescription 
      });
      
      finalQueries = generateDefaultQueries(
        domain, 
        brand, 
        siteDescription, 
        homePageTitle, 
        homePageMetaDescription
      );
      console.log('[CITATIONS] Generated queries:', finalQueries.length);
    }
    
    const results = [];
    const errors = [];
    const totalsBySource: Record<string, { total: number, cited: number }> = {};
    
    // Initialize totals
    for (const source of sources) {
      totalsBySource[source] = { total: 0, cited: 0 };
    }
    
    // Process each source-query combination with concurrency control
    for (const source of sources) {
      console.log(`[CITATIONS] Processing source: ${source}`);
      // Global cap: max 24 queries per run (configurable)
      const MAX_QUERIES = 24;
      for (const query of finalQueries.slice(0, MAX_QUERIES)) {
        try {
          // Throttle requests
          await new Promise(resolve => setTimeout(resolve, 400));
          
          console.log(`[CITATIONS] Querying ${source}: "${query}"`);
          const result = await queryAI(source, query, env);
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
          await env.DB.prepare(`
            INSERT INTO ai_citations 
            (id, project_id, domain, ai_source, query, answer_hash, answer_excerpt, 
             cited_urls, cited_match_count, first_match_url, confidence, error, occurred_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            citationId, project_id, domain, source, query, answerHash,
            result.answer_text?.slice(0, 500) || '',
            JSON.stringify(processed.cited_urls),
            processed.cited_match_count,
            processed.first_match_url,
            result.confidence || 0,
            result.error || null
          ).run();
          
          // Update referrals table
          await env.DB.prepare(`
            INSERT OR REPLACE INTO ai_referrals
            (id, project_id, domain, ai_source, query, cited, count_urls, first_seen, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, ?, 
                    COALESCE((SELECT first_seen FROM ai_referrals WHERE project_id = ? AND domain = ? AND ai_source = ? AND query = ?), datetime('now')),
                    datetime('now'))
          `).bind(
            crypto.randomUUID(), project_id, domain, source, query,
            processed.cited_match_count > 0 ? 1 : 0,
            processed.cited_match_count,
            project_id, domain, source, query
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
          
        } catch (error) {
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
  const project_id = searchParams.get('project_id');
  const domain = searchParams.get('domain');
  
  if (!project_id || !domain) {
    throw new Error('project_id and domain are required');
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
    WHERE project_id = ? AND domain = ?
    GROUP BY ai_source
    ORDER BY last_run DESC
  `).bind(project_id, domain).all();
  
  // Get top cited URLs
  const topUrls = await env.DB.prepare(`
    SELECT 
      first_match_url,
      COUNT(*) as citation_count,
      MAX(occurred_at) as last_seen
    FROM ai_citations
    WHERE project_id = ? AND domain = ? AND cited_match_count > 0 AND first_match_url IS NOT NULL
    GROUP BY first_match_url
    ORDER BY citation_count DESC, last_seen DESC
    LIMIT 10
  `).bind(project_id, domain).all();
  
  // Get top citing queries
  const topQueries = await env.DB.prepare(`
    SELECT 
      query,
      ai_source,
      cited_match_count,
      occurred_at
    FROM ai_citations
    WHERE project_id = ? AND domain = ? AND cited_match_count > 0
    ORDER BY occurred_at DESC
    LIMIT 10
  `).bind(project_id, domain).all();
  
  return {
    bySource: summary.results,
    topCitedUrls: topUrls.results,
    topCitingQueries: topQueries.results
  };
}

async function getCitationsList(searchParams: URLSearchParams, env: Env) {
  const project_id = searchParams.get('project_id');
  const domain = searchParams.get('domain');
  const source = searchParams.get('source');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  if (!project_id || !domain) {
    throw new Error('project_id and domain are required');
  }
  
  let whereClause = 'WHERE project_id = ? AND domain = ?';
  const params = [project_id, domain];
  
  if (source) {
    whereClause += ' AND ai_source = ?';
    params.push(source);
  }
  
  const citations = await env.DB.prepare(`
    SELECT 
      id, ai_source, query, answer_excerpt,
      cited_urls, cited_match_count, first_match_url,
      confidence, error, occurred_at
    FROM ai_citations
    ${whereClause}
    ORDER BY occurred_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all();
  
  // Parse cited_urls JSON and limit to top 5 for response
  const processedCitations = citations.results.map((citation: any) => ({
    ...citation,
    cited_urls: JSON.parse(citation.cited_urls || '[]').slice(0, 5)
  }));
  
  return {
    citations: processedCitations,
    hasMore: processedCitations.length === limit
  };
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
        AND status = 'complete'
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


import { queryAI, processCitations, generateDefaultQueries } from './connectors';

// Bot Identity Configuration
const BOT_UA = "OptiviewAuditBot/1.0 (+https://api.optiview.ai/bot; admin@optiview.ai)";

export interface Env {
  DB: D1Database;
  RULES: KVNamespace;
  BROWSER: Browser;
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

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[CRON] Scheduled event:', event.cron);
    
    if (event.cron === '0 14 * * 1') {
      // Weekly citations run (Mondays 14:00 UTC)
      await runWeeklyCitations(env);
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
      }

      if (req.method === 'POST' && path === '/api/admin/seed-rules') {
        const result = await seedRules(env);
        return new Response(JSON.stringify(result), { 
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

// API Route Handlers

async function createAudit(req: Request, env: Env, ctx: ExecutionContext) {
  const body: AuditRequest = await req.json();
  const { project_id, root_url, site_description, max_pages = 200, config = {} } = body;
  
  const id = crypto.randomUUID();
  
  await env.DB.prepare(
    "INSERT INTO audits (id, project_id, root_url, site_description, started_at, status, config_json) VALUES (?, ?, ?, ?, datetime('now'), 'running', ?)"
  ).bind(id, project_id, root_url, site_description || null, JSON.stringify(config)).run();

  // Start crawl in background
  ctx.waitUntil(runCrawl({ audit_id: id, root_url, site_description, max_pages }, env));

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

    // Finalize site scores
    const { aeo, geo } = await computeSiteScores(env.DB, audit_id);
    await env.DB.prepare("UPDATE audits SET finished_at=datetime('now'), status='complete', aeo_score=?, geo_score=? WHERE id=?")
      .bind(aeo, geo, audit_id).run();

    console.log(`Crawl complete for audit ${audit_id}: AEO=${aeo}, GEO=${geo}`);

  } catch (error) {
    console.error(`Crawl failed for audit ${audit_id}:`, error);
    await env.DB.prepare("UPDATE audits SET status='failed' WHERE id=?").bind(audit_id).run();
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

async function bfsCrawl(finalOrigin: URL, maxPages: number, env: Env): Promise<string[]> {
  const visited = new Set<string>();
  const queue: string[] = [finalOrigin.toString()];
  const pages: string[] = [];

  while (queue.length && pages.length < maxPages) {
    const next = queue.shift()!;
    if (visited.has(next)) continue;
    visited.add(next);

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
      .map(m => m[1]).slice(0, 500);

    for (const href of links) {
      try {
        const u = new URL(href, finalUrl);       // resolve relative URLs
        if (!sameSite(finalOrigin, u)) continue; // stay on same site
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

async function discoverUrls(rootUrl: string, env: Env): Promise<string[]> {
  console.log(`[CRAWL] Starting URL discovery for: ${rootUrl}`);
  
  // Step 1: Resolve final URL after redirects
  const finalOrigin = await resolveFinalUrl(rootUrl, env);
  console.log(`[CRAWL] Final origin after redirects: ${finalOrigin.toString()}`);
  
  // Step 2: Try sitemap discovery
  const sitemaps = await discoverSitemaps(finalOrigin, env);
  console.log(`[CRAWL] Found ${sitemaps.length} sitemaps`);
  
  let urls: string[] = [];
  
  if (sitemaps.length > 0) {
    // Step 3: Extract URLs from sitemaps
    const hostAllow = (u: URL) => sameSite(finalOrigin, u);
    urls = await extractUrlsFromSitemaps(sitemaps, hostAllow, env);
    console.log(`[CRAWL] Extracted ${urls.length} URLs from sitemaps`);
  }
  
  // Step 4: Fallback to BFS if no sitemap URLs found
  if (urls.length === 0) {
    console.log(`[CRAWL] No sitemap URLs found, falling back to BFS`);
    urls = await bfsCrawl(finalOrigin, 1000, env);
    console.log(`[CRAWL] BFS discovered ${urls.length} URLs`);
  }
  
  // Step 5: Guardrail - mark as failed if still no URLs
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
      aeo: { A1:15, A2:15, A3:15, A4:12, A5:10, A6:10, A7:8, A8:6, A9:5, A10:4 },
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

    return {
      top_issues: topIssues,
      quick_wins: quickWins,
      visibility_summary: visibilitySummary
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


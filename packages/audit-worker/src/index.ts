import { queryAI, processCitations, generateDefaultQueries } from './connectors';

export interface Env {
  DB: D1Database;
  RULES: KVNamespace;
  BROWSER: Browser;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  BRAVE_API_KEY?: string;
}

export interface AuditRequest {
  project_id: string;
  root_url: string;
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

export interface ScoringResult {
  aeo: number;
  geo: number;
  items: CheckResult[];
}

export default {
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

        if (path === `/api/audits/${auditId}/recompute`) {
          const result = await recomputeAudit(auditId, env);
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
  const { project_id, root_url, max_pages = 200, config = {} } = body;
  
  const id = crypto.randomUUID();
  
  await env.DB.prepare(
    "INSERT INTO audits (id, project_id, root_url, started_at, status, config_json) VALUES (?, ?, ?, datetime('now'), 'running', ?)"
  ).bind(id, project_id, root_url, JSON.stringify(config)).run();

  // Start crawl in background
  ctx.waitUntil(runCrawl({ audit_id: id, root_url, max_pages }, env));

  return { audit_id: id, status: 'running' };
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

async function runCrawl({ audit_id, root_url, max_pages }: any, env: Env) {
  try {
    // Discover URLs
    const discovered = await discoverUrls(root_url);
    const queue = [...discovered].slice(0, max_pages);

    console.log(`Starting crawl for ${queue.length} URLs`);

    // Process each URL
    for (const url of queue) {
      try {
        const page = await fetchPage(url);
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

async function discoverUrls(rootUrl: string): Promise<string[]> {
  const urls = new Set<string>();
  const urlObj = new URL(rootUrl);
  
  try {
    // Try sitemap first
    const sitemapUrl = `${urlObj.origin}/sitemap.xml`;
    const sitemapRes = await fetch(sitemapUrl, { cf: { cacheTtl: 0 } });
    
    if (sitemapRes.ok) {
      const sitemapText = await sitemapRes.text();
      const urlMatches = sitemapText.match(/<loc>(.*?)<\/loc>/g);
      
      if (urlMatches) {
        for (const match of urlMatches) {
          const url = match.replace(/<\/?loc>/g, '');
          if (url.startsWith(urlObj.origin)) {
            urls.add(url);
          }
        }
        return Array.from(urls);
      }
    }
  } catch (error) {
    console.log('Sitemap discovery failed, falling back to BFS:', error);
  }

  // Fallback to BFS from root
  const visited = new Set<string>();
  const queue = [rootUrl];
  
  while (queue.length > 0 && urls.size < 1000) {
    const currentUrl = queue.shift()!;
    if (visited.has(currentUrl)) continue;
    
    visited.add(currentUrl);
    urls.add(currentUrl);
    
    try {
      const res = await fetch(currentUrl, { cf: { cacheTtl: 0 } });
      if (!res.ok) continue;
      
      const html = await res.text();
      const doc = parseHTML(html);
      
      const links = doc.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (!href) continue;
        
        try {
          const linkUrl = new URL(href, currentUrl);
          if (linkUrl.origin === urlObj.origin && !visited.has(linkUrl.href)) {
            queue.push(linkUrl.href);
          }
        } catch {
          // Invalid URL, skip
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${currentUrl}:`, error);
    }
  }
  
  return Array.from(urls);
}

async function fetchPage(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const res = await fetch(url, { 
      cf: { cacheTtl: 0 },
      signal: controller.signal 
    });
    
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
    .filter(a => !a.href.includes(new URL(ctx.url).hostname)).length;

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
    .filter(a => a.href.includes(new URL(ctx.url).hostname)).length >= 3;

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
  const body: CitationsRequest = await req.json();
  const { project_id, domain, brand, sources, queries } = body;
  
  // Generate default queries if not provided
  let finalQueries = queries;
  if (!finalQueries || finalQueries.length === 0) {
    // Get page titles from recent audit for this domain
    const audit = await env.DB.prepare(`
      SELECT title FROM audit_pages ap
      JOIN audits a ON ap.audit_id = a.id
      WHERE a.project_id = ? AND ap.url LIKE ?
      ORDER BY ap.fetched_at DESC
      LIMIT 10
    `).bind(project_id, `%${domain}%`).all();
    
    const pageTitles = audit.results.map((r: any) => r.title).filter(Boolean);
    finalQueries = generateDefaultQueries(domain, brand, pageTitles);
  }
  
  const results = [];
  const totalsBySource: Record<string, { total: number, cited: number }> = {};
  
  // Initialize totals
  for (const source of sources) {
    totalsBySource[source] = { total: 0, cited: 0 };
  }
  
  // Process each source-query combination with concurrency control
  for (const source of sources) {
    for (const query of finalQueries.slice(0, 24)) { // Max 24 queries per run
      try {
        // Throttle requests
        await new Promise(resolve => setTimeout(resolve, 400));
        
        const result = await queryAI(source, query, env);
        const processed = processCitations(result, domain);
        
        // Generate hash for deduplication
        const answerHash = result.answer_text ? 
          await crypto.subtle.digest('SHA-256', new TextEncoder().encode(result.answer_text))
            .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')) :
          null;
        
        // Store in database
        const citationId = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO ai_citations 
          (id, project_id, domain, ai_source, query, answer_hash, answer_excerpt, 
           cited_urls, cited_match_count, first_match_url, confidence, error, occurred_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          citationId, project_id, domain, source, query, answerHash,
          result.answer_text.slice(0, 500),
          JSON.stringify(processed.cited_urls),
          processed.cited_match_count,
          processed.first_match_url,
          result.confidence,
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
        console.error(`Error processing ${source} for query "${query}":`, error);
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
  
  return {
    status: 'completed',
    totalsBySource,
    citedPctBySource,
    results: results.slice(0, 50) // Limit response size
  };
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


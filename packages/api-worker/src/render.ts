// Cloudflare Browser Rendering using official @cloudflare/puppeteer adapter
// Falls back to HTML + Readability when browser unavailable

import puppeteer from '@cloudflare/puppeteer';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

type Mode = 'browser' | 'html';

export interface RenderResult {
  mode: Mode;
  statusCode: number;
  html: string;
  text: string;
  words: number;
  snippet: string;
  hasH1: boolean;
  jsonLdCount: number;
  faqOnPage: boolean; // True only if this page has FAQPage JSON-LD
}

async function extractFromHTML(html: string): Promise<Omit<RenderResult, 'mode' | 'statusCode'>> {
  const { document } = parseHTML(html);
  
  // Use Readability for main content
  const reader = new Readability(document as any);
  const article = reader.parse();
  const text = (article?.textContent || document.body?.textContent || '').trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const snippet = (article?.excerpt || text.slice(0, 240)).trim();

  const hasH1 = !!document.querySelector('h1');
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  const jsonLdCount = jsonLdScripts.length;
  
  // Detect FAQPage on this specific page
  const faqOnPage = detectFaqOnPage(document);

  return { html, text, words, snippet, hasH1, jsonLdCount, faqOnPage };
}

/**
 * Detects if this page has a FAQPage JSON-LD block.
 * Only returns true if @type includes "FAQPage" (case-insensitive).
 */
function detectFaqOnPage(document: any): boolean {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  
  for (const s of scripts) {
    const txt = ((s as any).textContent || '').trim();
    if (!txt) continue;
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(txt);
      const blocks = Array.isArray(parsed) ? parsed : [parsed];
      
      for (const block of blocks) {
        const type = block?.['@type'];
        if (!type) continue;
        
        const types = Array.isArray(type) ? type : [type];
        if (types.some((t: any) => String(t).toLowerCase() === 'faqpage')) {
          return true;
        }
      }
    } catch {
      // Best-effort fallback: regex check for FAQPage in raw text
      if (/"@type"\s*:\s*"FAQPage"/i.test(txt)) {
        return true;
      }
    }
  }
  
  return false;
}

// Browser service health check
async function isBrowserServiceAvailable(env: any): Promise<boolean> {
  try {
    // Quick test to see if browser service responds
    const testBrowser = await puppeteer.launch(env.BROWSER);
    await testBrowser.close();
    return true;
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes('503') || errorMsg.includes('No browser available')) {
      console.warn('[render] Browser service unavailable (503/No browser available), skipping browser rendering');
      return false;
    }
    // Don't throw other errors, just return false
    console.warn('[render] Browser service check failed:', errorMsg);
    return false;
  }
}

export async function renderPage(
  env: any,
  url: string,
  opts?: { force?: Mode; userAgent?: string; debug?: boolean }
): Promise<RenderResult> {
  const force = opts?.force;

  // PR-3: 3-tier strategy for browser rendering stability
  // 1) Browser attempt with navigation timeout
  const browserResult = await tryBrowserRender(env, url, { 
    navTimeoutMs: parseInt(env.RENDER_NAV_TIMEOUT_MS || '10000'),
    userAgent: opts?.userAgent,
    force: force === 'html' ? false : true
  });
  
  if (browserResult.ok) {
    return browserResult.value;
  }

  // 2) Retry once with fresh session (short backoff)
  await sleep(300);
  console.log(`[render] Browser failed, retrying with fresh session for ${url}`);
  
  const retryResult = await tryBrowserRender(env, url, { 
    navTimeoutMs: parseInt(env.RENDER_NAV_TIMEOUT_MS || '10000') + 2000, // Slightly longer timeout
    userAgent: opts?.userAgent,
    force: force === 'html' ? false : true,
    freshSession: true
  });
  
  if (retryResult.ok) {
    return retryResult.value;
  }

  // 3) Fallback to basic HTTP fetch
  console.log(`[render] Browser failed, falling back to basic fetch for ${url}`);
  return await tryBasicFetch(env, url, { 
    timeoutMs: parseInt(env.BASIC_FETCH_TIMEOUT_MS || '8000'),
    userAgent: opts?.userAgent
  });
}

/**
 * Try browser rendering with retries and resource blocking
 */
async function tryBrowserRender(
  env: any,
  url: string,
  opts: { navTimeoutMs: number; userAgent?: string; force?: boolean; freshSession?: boolean }
): Promise<{ ok: boolean; value?: RenderResult; error?: string }> {
  // Check browser service availability before attempting
  const browserAvailable = !opts.force && env.BROWSER && await isBrowserServiceAvailable(env);
  
  if (!browserAvailable) {
    return { ok: false, error: 'Browser service unavailable' };
  }

  const startTime = Date.now();
  try {
    console.log(`[render] attempting browser mode for ${url} (timeout: ${opts.navTimeoutMs}ms)`);
    
    // Official Cloudflare Browser Rendering API
    const browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(opts.navTimeoutMs);

    // Set user agent if provided
    if (opts?.userAgent) {
      await page.setUserAgent(opts.userAgent);
    }

    // Block heavy assets to speed up rendering (images, media, fonts)
    // We only need text content, not visuals
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Navigate and wait for content with configurable timeout
    const response = await page.goto(url, {
      waitUntil: ['load', 'domcontentloaded', 'networkidle0'] as any,
      timeout: opts.navTimeoutMs,
    });
    
    // Get status code from response (0 = unknown/network error)
    const statusCode = response?.status() ?? 0;

    // Get full HTML after JS runs
    const html: string = await page.content();

    // Extract metadata from browser DOM (more reliable than linkedom)
    const browserData = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      return {
        hasH1: !!h1,
        h1Text: h1?.textContent?.trim() || null,
        jsonLdCount: jsonLdScripts.length
      };
    });

    // Clean up
    await browser.close();

    const extracted = await extractFromHTML(html);
    const renderTime = Date.now() - startTime;
    console.log(`[render] browser: ${url} -> ${extracted.words} words, status ${statusCode}, H1: ${browserData.hasH1}, in ${renderTime}ms`);
    
    // Override H1 detection with browser's result (more reliable than linkedom)
    return { 
      ok: true,
      value: {
        mode: 'browser', 
        statusCode, 
        ...extracted,
        hasH1: browserData.hasH1,
        jsonLdCount: browserData.jsonLdCount 
      }
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`[render] browser failed for ${url}:`, errorMsg);
    
    return { ok: false, error: errorMsg };
  }
}

/**
 * Basic HTTP fetch fallback with structured response
 */
async function tryBasicFetch(
  env: any,
  url: string,
  opts: { timeoutMs: number; userAgent?: string }
): Promise<RenderResult> {
  console.log(`[render] basic fetch for ${url} (timeout: ${opts.timeoutMs}ms)`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);
    
    const resp = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': opts?.userAgent || 
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 OptiviewAudit/0.16',
      },
      cf: { cacheTtl: 300, cacheEverything: true } as any,
    });
    
    clearTimeout(timeoutId);
    
    const statusCode = resp.status;
    const html = await resp.text();
    const extracted = await extractFromHTML(html);
    
    console.log(`[render] basic fetch: ${url} -> ${extracted.words} words, status ${statusCode}`);
    return { mode: 'html', statusCode, ...extracted };
  } catch (err: any) {
    console.error(`[render] basic fetch failed for ${url}:`, err?.message);
    
    // Return empty result with error status
    return {
      mode: 'html',
      statusCode: 0,
      html: '',
      text: '',
      words: 0,
      snippet: '',
      hasH1: false,
      jsonLdCount: 0,
      faqOnPage: false
    };
  }
}

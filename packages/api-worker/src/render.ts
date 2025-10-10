// Cloudflare Browser Rendering using official @cloudflare/puppeteer adapter
// Falls back to HTML + Readability when browser unavailable

import puppeteer from '@cloudflare/puppeteer';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

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
  faqPresent: boolean;
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
  
  // Check for FAQ schema in JSON-LD
  let faqPresent = false;
  for (let i = 0; i < jsonLdScripts.length; i++) {
    try {
      const content = jsonLdScripts[i].textContent || '';
      const data = JSON.parse(content);
      const type = Array.isArray(data) ? data.map(d => d['@type']).join(',') : data['@type'];
      if (type && (type.includes('FAQPage') || type.includes('Question'))) {
        faqPresent = true;
        break;
      }
    } catch {
      // Ignore parse errors
    }
  }

  return { html, text, words, snippet, hasH1, jsonLdCount, faqPresent };
}

export async function renderPage(
  env: any,
  url: string,
  opts?: { force?: Mode; userAgent?: string; debug?: boolean }
): Promise<RenderResult> {
  const force = opts?.force;

  // Try Browser first unless forced to html
  if (force !== 'html' && env.BROWSER) {
    const startTime = Date.now();
    try {
      console.log(`[render] attempting browser mode for ${url}`);
      
      // Official Cloudflare Browser Rendering API
      const browser = await puppeteer.launch(env.BROWSER);
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(30_000);

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

      // Navigate and wait for content
      const response = await page.goto(url, {
        waitUntil: ['load', 'domcontentloaded', 'networkidle0'] as any,
        timeout: 30_000,
      });
      
      // Get status code from response
      const statusCode = response?.status() ?? 200;

      // Get full HTML after JS runs
      const html: string = await page.content();

      // Clean up
      await browser.close();

      const extracted = await extractFromHTML(html);
      const renderTime = Date.now() - startTime;
      console.log(`[render] browser: ${url} -> ${extracted.words} words, status ${statusCode}, in ${renderTime}ms`);
      
      return { mode: 'browser', statusCode, ...extracted };
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error(`[render] browser failed for ${url}, falling back:`, errorMsg);
      
      // Surface error in debug mode
      if (opts?.debug) {
        (globalThis as any).__render_error_hint = errorMsg;
      }
      
      // Fall through to HTML mode
    }
  }

  // HTML fallback (fetch + Readability)
  console.log(`[render] html mode for ${url}`);
  try {
    const resp = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': opts?.userAgent || 
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 OptiviewAudit/0.16',
      },
      cf: { cacheTtl: 300, cacheEverything: true } as any,
    });
    
    const statusCode = resp.status;
    const html = await resp.text();
    const extracted = await extractFromHTML(html);
    
    console.log(`[render] html: ${url} -> ${extracted.words} words, status ${statusCode}`);
    return { mode: 'html', statusCode, ...extracted };
  } catch (err: any) {
    console.error(`[render] html fetch failed for ${url}:`, err?.message);
    
    // Return empty result
    return {
      mode: 'html',
      statusCode: 0,
      html: '',
      text: '',
      words: 0,
      snippet: '',
      hasH1: false,
      jsonLdCount: 0,
      faqPresent: false,
    };
  }
}

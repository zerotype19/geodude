// Unified renderer: "browser" (CF Browser), "browserless", "html" (fallback).
// Returns { mode, html, text, status, hasH1, jsonLdCount, snippet, words }

import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

export interface RenderResult {
  mode: 'browser' | 'browserless' | 'html';
  html: string;
  text: string;
  status: number;
  hasH1: boolean;
  jsonLdCount: number;
  snippet: string;
  words: number;
}

const ABSOLUTE_TIMEOUT_MS = 30_000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 OptiviewAudit/0.16';

function extractReadable(html: string): {
  text: string;
  words: number;
  hasH1: boolean;
  jsonLdCount: number;
  snippet: string;
} {
  const { document } = parseHTML(html);

  const hasH1 = !!document.querySelector('h1');
  const jsonLdCount = document.querySelectorAll('script[type="application/ld+json"]').length;

  // Use Readability for main content
  const documentClone = document.cloneNode(true) as Document;
  const reader = new Readability(documentClone);
  const article = reader.parse();
  const text = (article?.textContent || document.body?.textContent || '')
    .trim()
    .replace(/\s+/g, ' ');
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const snippet = (article?.excerpt || text).slice(0, 280);

  return { text, words, hasH1, jsonLdCount, snippet };
}

/**
 * Render a page using Cloudflare Browser Rendering when available,
 * otherwise fall back to fetch + Readability.
 */
export async function renderPage(
  env: any,
  url: string,
  userAgent?: string
): Promise<RenderResult> {
  const controller = new AbortController();
  const kill = setTimeout(() => controller.abort(), ABSOLUTE_TIMEOUT_MS);

  try {
    if (env.BROWSER) {
      // ---- Browser mode (Cloudflare Browser Rendering) ----
      try {
        console.log(`[render] browser mode for ${url}`);
        
        // Cloudflare binding exposes newContext() directly; no launch()
        const context = await env.BROWSER.newContext({
          userAgent: userAgent || USER_AGENT,
          javaScriptEnabled: true,
          deviceScaleFactor: 1,
          viewport: { width: 1366, height: 900 },
        });

        const page = await context.newPage();
        page.setDefaultNavigationTimeout(ABSOLUTE_TIMEOUT_MS);
        
        let status = 200;
        try {
          const response = await page.goto(url, { waitUntil: 'networkidle' });
          if (response && typeof response.status === 'function') {
            status = response.status();
          }
        } catch (e) {
          console.log(`[render] navigation warning for ${url}:`, e);
        }

        // Optionally wait for body to have some content
        try {
          await page.waitForSelector('body', { timeout: 5000 });
        } catch (e) {
          console.log(`[render] body wait timeout for ${url}`);
        }

        const html = await page.content();
        
        await page.close();
        await context.close();

        const { text, words, hasH1, jsonLdCount, snippet } = extractReadable(html);
        
        console.log(`[render] browser: ${url} -> ${words} words`);
        return { mode: 'browser', html, text, status, hasH1, jsonLdCount, snippet, words };
      } catch (error) {
        console.error(`[render] browser failed for ${url}, falling back to HTML:`, error);
        // Fall through to HTML mode
      }
    }

    if (env.BROWSERLESS_URL) {
      // ---- Browserless mode ----
      try {
        console.log(`[render] browserless mode for ${url}`);
        const body = {
          url,
          options: { waitUntil: 'networkidle', timeout: ABSOLUTE_TIMEOUT_MS },
          gotoOptions: { waitUntil: 'networkidle' },
          html: true,
        };
        const r = await fetch(`${env.BROWSERLESS_URL}/playwright?stealth=true`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const status = r.status;
        const html = await r.text();
        const { text, words, hasH1, jsonLdCount, snippet } = extractReadable(html);
        
        console.log(`[render] browserless: ${url} -> ${words} words`);
        return { mode: 'browserless', html, text, status, hasH1, jsonLdCount, snippet, words };
      } catch (error) {
        console.error(`[render] browserless failed for ${url}, falling back to HTML:`, error);
        // Fall through to HTML mode
      }
    }

    // ---- HTML fallback (fetch + Readability) ----
    console.log(`[render] html mode for ${url}`);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': userAgent || USER_AGENT,
        accept: 'text/html,*/*;q=0.9',
      },
    });
    const status = resp.status;
    const html = await resp.text();

    const { text, words, hasH1, jsonLdCount, snippet } = extractReadable(html);
    
    console.log(`[render] html: ${url} -> ${words} words`);
    return { mode: 'html', html, text, status, hasH1, jsonLdCount, snippet, words };
  } finally {
    clearTimeout(kill);
  }
}

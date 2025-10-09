// Unified renderer: "browser" (CF Browser), "browserless", "html" (fallback).
// Returns { html, text, status, hasH1, jsonLdCount, snippet, words }

import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

export interface RenderResult {
  html: string;
  text: string;
  status: number;
  hasH1: boolean;
  jsonLdCount: number;
  snippet: string;
  words: number;
}

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
  const words = text ? text.split(/\s+/).length : 0;
  const snippet = text.slice(0, 240);

  return { text, words, hasH1, jsonLdCount, snippet };
}

export async function renderPage(
  env: any,
  url: string,
  userAgent = 'OptiviewAuditBot/1.0'
): Promise<RenderResult> {
  const mode = (env.RENDER_MODE || 'html').toLowerCase();
  const timeout = Number(env.RENDER_TIMEOUT_MS || 8000);

  if (mode === 'browser' && env.BROWSER) {
    // Cloudflare Browser Rendering
    try {
      const browser = env.BROWSER;
      const page = await browser.newPage();
      
      let status = 200;
      try {
        const response = await Promise.race([
          page.goto(url, { waitUntil: 'load' }),
          new Promise<null>((_, rej) => setTimeout(() => rej(new Error('timeout')), timeout)),
        ]);
        
        if (response && typeof response === 'object' && 'status' in response) {
          status = (response as any).status();
        }
      } catch (e) {
        console.log(`Browser navigation warning for ${url}:`, e);
        // Continue with whatever content we got
      }

      const html = await page.content();
      await page.close();

      const { text, words, hasH1, jsonLdCount, snippet } = extractReadable(html);
      return { html, text, status, hasH1, jsonLdCount, snippet, words };
    } catch (error) {
      console.error(`Browser rendering failed for ${url}, falling back to HTML:`, error);
      // Fall through to HTML mode
    }
  }

  if (mode === 'browserless' && env.BROWSERLESS_URL) {
    // Browserless /playwright
    try {
      const body = {
        url,
        options: { waitUntil: 'networkidle', timeout },
        gotoOptions: { waitUntil: 'networkidle' },
        html: true,
      };
      const r = await fetch(`${env.BROWSERLESS_URL}/playwright?stealth=true`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const status = r.status;
      const html = await r.text();
      const { text, words, hasH1, jsonLdCount, snippet } = extractReadable(html);
      return { html, text, status, hasH1, jsonLdCount, snippet, words };
    } catch (error) {
      console.error(`Browserless rendering failed for ${url}, falling back to HTML:`, error);
      // Fall through to HTML mode
    }
  }

  // Fallback: raw HTML
  try {
    const r = await fetch(url, { 
      headers: { 'user-agent': userAgent },
      signal: AbortSignal.timeout(timeout)
    });
    const status = r.status;
    const html = await r.text();
    const { text, words, hasH1, jsonLdCount, snippet } = extractReadable(html);
    return { html, text, status, hasH1, jsonLdCount, snippet, words };
  } catch (error) {
    console.error(`HTML fetch failed for ${url}:`, error);
    // Return empty result
    return {
      html: '',
      text: '',
      status: 0,
      hasH1: false,
      jsonLdCount: 0,
      snippet: '',
      words: 0,
    };
  }
}


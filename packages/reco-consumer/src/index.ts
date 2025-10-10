// Content Recommendation Consumer Worker
// Uses Cloudflare Browser Rendering + GPT-4o to generate page recommendations

import puppeteer from '@cloudflare/puppeteer';
import Ajv from 'ajv';

interface Env {
  DB: D1Database;
  BROWSER: any;
  RECO_CACHE: KVNamespace;
  OPENAI_API_KEY: string;
  OPENAI_API_BASE: string;
  OPENAI_MODEL: string;
}

interface QueueMessage {
  id: string;
  url: string;
  audit_id?: string;
  page_id?: string;
  refresh?: boolean;
}

interface PageFacts {
  title: string;
  metaDescription: string;
  canonical: string;
  h1: string;
  h2: string[];
  h3: string[];
  faqPairs: Array<{ q: string; a: string }>;
  existingLD: string[];
  path: string;
}

interface ModelOutput {
  detected_intent: 'FAQPage' | 'WebPage' | 'Article' | 'Product' | 'BreadcrumbList';
  missing_schemas: string[];
  suggested_jsonld: Array<{ '@context': string; '@type': string; [key: string]: any }>;
  content_suggestions: Array<{
    title: string;
    priority: 'High' | 'Medium' | 'Low';
    note: string;
  }>;
}

export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Env) {
    for (const msg of batch.messages) {
      const { id, url, audit_id, page_id, refresh } = msg.body;
      
      console.log(`[reco] Processing job ${id} for ${url}${refresh ? ' (refresh)' : ''}`);
      
      try {
        // Step 0: Validate URL (SSRF protection)
        if (!isValidUrl(url)) {
          throw new Error('Invalid URL: must be public HTTP(S)');
        }
        
        // Step 1: Mark as rendering
        await mark(env, id, 'rendering');

        // Step 2: Render via Browser Rendering and extract facts
        const { html, etag, facts } = await renderAndExtract(env, url);

        // Step 3: Check KV cache for de-duplication (unless refresh requested)
        if (!refresh) {
          const cacheKey = `reco:${url}:${etag}`;
          const cached = await env.RECO_CACHE.get(cacheKey);
          if (cached) {
            console.log(`[reco] Cache hit for ${url}`);
            await save(env, id, 'done', etag, cached);
            continue;
          }
        }

        // Step 4: Mark as analyzing
        await mark(env, id, 'analyzing');

        // Step 5: Ask GPT-4o for recommendations
        const modelOut = await recommendWithGPT4(env, { url, etag, facts });

        // Step 6: Validate output (with URL check)
        validateReco(modelOut, url);

        // Step 7: Persist + cache
        const asText = JSON.stringify(modelOut);
        await env.RECO_CACHE.put(cacheKey, asText, { expirationTtl: 60 * 60 * 24 * 7 }); // 7 days
        await save(env, id, 'done', etag, asText);

        console.log(`[reco] Job ${id} completed successfully`);
      } catch (err: any) {
        console.error(`[reco] Job ${id} failed:`, err);
        await env.DB
          .prepare(`UPDATE reco_jobs SET status='error', updated_at=?, error=? WHERE id=?`)
          .bind(Date.now(), String(err?.stack || err?.message || err), id)
          .run();
      }
    }
  }
};

// SSRF Protection: Validate URL is public HTTP(S)
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    
    // Must be HTTP or HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }
    
    // Block private/internal IPs
    const hostname = url.hostname.toLowerCase();
    
    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }
    
    // Block private IP ranges (simple check)
    if (
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./)
    ) {
      return false;
    }
    
    // Block metadata endpoints
    if (hostname === '169.254.169.254') {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// Update job status
async function mark(env: Env, id: string, status: string) {
  await env.DB.prepare(
    `UPDATE reco_jobs SET status=?, updated_at=? WHERE id=?`
  ).bind(status, Date.now(), id).run();
}

// Save final result
async function save(env: Env, id: string, status: string, etag: string, result: string) {
  await env.DB.prepare(
    `UPDATE reco_jobs SET status=?, updated_at=?, input_hash=?, result_json=? WHERE id=?`
  ).bind(status, Date.now(), etag, result, id).run();
}

// Render page using Browser Rendering and extract structured facts
async function renderAndExtract(env: Env, target: string): Promise<{ html: string; etag: string; facts: PageFacts }> {
  console.log(`[reco] Launching browser for ${target}`);
  
  const browser = await puppeteer.launch(env.BROWSER);
  const page = await browser.newPage();

  // Block heavy assets for performance
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
  await page.goto(target, {
    waitUntil: ['load', 'domcontentloaded', 'networkidle0'] as any,
    timeout: 30_000,
  });

  // Get rendered HTML
  const html: string = await page.content();
  
  // Generate hash for caching
  const etag = await hash(html);

  // Extract page facts in browser context
  const facts = await page.evaluate(() => {
    const q = (sel: string) => document.querySelector(sel);
    const qa: Array<{ q: string; a: string }> = [];

    // Q/A detection: ARIA accordions (better for modern medical sites)
    const accordionButtons = Array.from(document.querySelectorAll(
      '[role="button"][aria-controls], [role="button"][aria-expanded], .accordion button, .accordion-button, [data-accordion] button, [data-faq] button'
    ));
    
    for (const btn of accordionButtons.slice(0, 60)) {
      const question = btn.textContent?.trim() || '';
      if (!question || question.length < 5) continue;
      
      // Try to find associated answer region
      const regionId = btn.getAttribute('aria-controls');
      let answerRegion: Element | null = null;
      
      if (regionId) {
        answerRegion = document.getElementById(regionId);
      } else {
        // Fallback: look for sibling or parent-adjacent region
        answerRegion = btn.nextElementSibling?.matches('[role="region"], .accordion-panel, .accordion-content')
          ? btn.nextElementSibling
          : btn.closest('.accordion-item, .accordion, [data-accordion]')?.querySelector('[role="region"], .accordion-panel, .accordion-content') || null;
      }
      
      if (answerRegion) {
        let answer = answerRegion.textContent?.trim() || '';
        // Strip common boilerplate patterns
        answer = answer.replace(/^(Show|Hide|Expand|Collapse)\s+/i, '');
        answer = answer.replace(/\s+(back to top|return to top|↑|⬆)\s*$/i, '');
        
        if (answer.length > 80) {
          qa.push({ q: question, a: answer.slice(0, 1200) });
        }
      }
    }

    // Fallback: H2/H3 with following paragraphs (for non-accordion layouts)
    if (qa.length < 3) {
      const heads = Array.from(document.querySelectorAll('h2, h3'));
      for (const h of heads) {
        const question = h.textContent?.trim() || '';
        if (!question || qa.some(item => item.q === question)) continue;
        
        let a = '';
        let n = h.nextElementSibling;
        let hops = 0;
        while (n && hops < 8 && !/^H[1-6]$/.test(n.tagName)) {
          if (n.tagName === 'P' || n.getAttribute('role') === 'region' || n.tagName === 'DIV') {
            a += ' ' + (n.textContent || '').trim();
          }
          n = n.nextElementSibling;
          hops++;
        }
        if (question && a.trim().length > 60) {
          qa.push({ q: question, a: a.trim().slice(0, 1200) });
        }
      }
    }

    // Extract JSON-LD scripts
    const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map((s: Element) => s.textContent?.trim() || '')
      .filter(Boolean);

    // Helper to extract all text from elements
    const h = (s: string) =>
      Array.from(document.querySelectorAll(s)).map((e) => e.textContent?.trim() || '');

    return {
      title: document.title || '',
      metaDescription: (q('meta[name="description"]') as HTMLMetaElement)?.content || '',
      canonical: (q('link[rel="canonical"]') as HTMLLinkElement)?.href || location.href,
      h1: h('h1')[0] || '',
      h2: h('h2'),
      h3: h('h3'),
      faqPairs: qa.slice(0, 40),
      existingLD: ld,
      path: location.pathname,
    };
  }) as PageFacts;

  await browser.close();
  
  console.log(`[reco] Extracted facts: ${facts.h1}, ${facts.faqPairs.length} Q&A pairs, ${facts.existingLD.length} LD-JSON`);

  return { html, etag, facts };
}

// Generate SHA-256 hash
async function hash(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Call GPT-4o for recommendations
async function recommendWithGPT4(
  env: Env,
  payload: { url: string; etag: string; facts: PageFacts }
): Promise<ModelOutput> {
  const looksFAQ = /faq/i.test(payload.facts.path) || payload.facts.faqPairs.length >= 3;

  const system = [
    "You are Optiview's Content Recommender.",
    'Produce minimal, correct Schema.org JSON-LD and concise content edits.',
    'Voice: clear, empathetic, medically accurate, non-alarming (US 6th–8th grade reading level).',
    'Never invent clinical claims or medical facts. Only summarize what is explicitly shown on the page.',
    'If information is missing, use placeholders like "[Page description]" rather than making assumptions.',
    'For medical/health pages, maintain compliant language (e.g., "screening test" not "diagnostic test").',
  ].join(' ');

  const jsonSchema = {
    type: 'object',
    required: ['detected_intent', 'missing_schemas', 'suggested_jsonld', 'content_suggestions'],
    properties: {
      detected_intent: { enum: ['FAQPage', 'WebPage', 'Article', 'Product', 'BreadcrumbList'] },
      missing_schemas: { type: 'array', items: { type: 'string' } },
      suggested_jsonld: {
        type: 'array',
        items: {
          type: 'object',
          required: ['@context', '@type'],
          additionalProperties: true,
        },
      },
      content_suggestions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'priority', 'note'],
          properties: {
            title: { type: 'string' },
            priority: { enum: ['High', 'Medium', 'Low'] },
            note: { type: 'string' },
          },
        },
      },
    },
    additionalProperties: false,
  };

  const userMessage = {
    desired: looksFAQ ? 'FAQPage' : 'WebPage',
    pageFacts: payload.facts,
    instructions:
      'Return missing_schemas; suggested_jsonld (ready-to-paste, minimal, include url); ' +
      'If FAQPage, build mainEntity from faqPairs. Prefer canonical for url/name. ' +
      'If WebPage-only, include name, description (2 sentences max), url. ' +
      'Do not duplicate existing LD if equivalent exists—improve it.',
  };

  console.log(`[reco] Calling ${env.OPENAI_MODEL} for ${payload.url}`);

  const res = await fetch(`${env.OPENAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      temperature: 0.25,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'OptiviewReco',
          schema: jsonSchema,
          strict: true,
        },
      },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(userMessage) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }

  const data = await res.json<any>();
  const content = data.choices[0].message.content;
  
  console.log(`[reco] Model response: ${content.slice(0, 200)}...`);
  
  return JSON.parse(content);
}

// Validate model output with enhanced Schema.org checks
function validateReco(obj: any, requestUrl?: string): asserts obj is ModelOutput {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const schema = {
    type: 'object',
    required: ['detected_intent', 'missing_schemas', 'suggested_jsonld', 'content_suggestions'],
  };
  
  const ok = ajv.validate(schema, obj);
  if (!ok) {
    throw new Error('Validation failed: ' + ajv.errorsText());
  }

  // Schema.org sanity checks
  for (const ld of obj.suggested_jsonld || []) {
    if (!ld['@context'] || !ld['@type']) {
      throw new Error('LD-JSON missing @context/@type');
    }
    
    // URL validation: must match request URL or canonical
    if (ld.url && requestUrl) {
      try {
        const ldHost = new URL(ld.url).host.toLowerCase().replace(/^www\./, '');
        const reqHost = new URL(requestUrl).host.toLowerCase().replace(/^www\./, '');
        if (ldHost !== reqHost) {
          throw new Error(`Schema.org URL host mismatch: ${ld.url} vs ${requestUrl}`);
        }
      } catch (e) {
        console.warn('URL validation warning:', e);
      }
    }
    
    // WebPage validation
    if (ld['@type'] === 'WebPage') {
      if (ld.name && (ld.name.length < 5 || ld.name.length > 120)) {
        throw new Error('WebPage.name must be 5-120 characters');
      }
      if (ld.description && (ld.description.length < 50 || ld.description.length > 160)) {
        throw new Error('WebPage.description must be 50-160 characters');
      }
    }
    
    // FAQPage validation
    if (ld['@type'] === 'FAQPage') {
      if (!Array.isArray(ld.mainEntity) || ld.mainEntity.length === 0) {
        throw new Error('FAQPage requires non-empty mainEntity');
      }
      
      for (const q of ld.mainEntity) {
        if (q['@type'] !== 'Question') {
          throw new Error('FAQPage mainEntity items must be Question');
        }
        if (!q.name || q.name.length < 5) {
          throw new Error('Question.name required (min 5 chars)');
        }
        if (
          !q.acceptedAnswer ||
          q.acceptedAnswer['@type'] !== 'Answer' ||
          !q.acceptedAnswer.text ||
          q.acceptedAnswer.text.length < 10
        ) {
          throw new Error('Question.acceptedAnswer.text required (min 10 chars)');
        }
      }
    }
  }
}


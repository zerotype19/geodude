// Simple synchronous content recommendation generator
// Uses existing renderPage() + OpenAI API (no queue needed!)

import { renderPage } from './render';

export interface RecoInput {
  url: string;
  audit_id?: string | null;
  page_id?: string | null;
  refresh?: boolean;
}

export interface RecoOutput {
  detected_intent: 'FAQPage' | 'WebPage' | 'Article' | 'Product' | 'BreadcrumbList';
  missing_schemas: string[];
  suggested_jsonld: Array<{ '@context': string; '@type': string; [key: string]: any }>;
  content_suggestions: Array<{
    title: string;
    priority: 'High' | 'Medium' | 'Low';
    note: string;
  }>;
  _meta?: {
    render_ms?: number;
    model_ms?: number;
    total_ms?: number;
    words?: number;
    cached?: boolean;
  };
}

/**
 * SSRF protection: block private IPs, localhost, internal domains
 */
function validateUrl(urlString: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Only allow HTTP(S)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Protocol ${parsed.protocol} not allowed`);
  }

  const host = parsed.hostname.toLowerCase();

  // Block localhost
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    throw new Error('Localhost URLs are not allowed');
  }

  // Block private IP ranges
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
    throw new Error('Private IP addresses are not allowed');
  }

  // Block internal/local domains
  if (host.endsWith('.internal') || host.endsWith('.local')) {
    throw new Error('Internal domains are not allowed');
  }
}

/**
 * Generate content recommendations for a single page.
 * Uses existing renderPage() from the audit system, so no duplicate browser overhead!
 */
export async function generateRecommendations(
  env: any,
  input: RecoInput
): Promise<RecoOutput> {
  const t0 = Date.now();
  
  // Step 0: SSRF protection
  validateUrl(input.url);
  
  // Step 1: Check KV cache (unless refresh requested)
  if (!input.refresh && env.RECO_CACHE) {
    const cacheKey = `reco:v2:${input.url}`;
    const cached = await env.RECO_CACHE.get(cacheKey, 'text');
    if (cached) {
      try {
        const result = JSON.parse(cached);
        result._meta = { ...result._meta, cached: true, total_ms: Date.now() - t0 };
        console.log(`[reco] Cache hit for ${input.url}`);
        return result;
      } catch (e) {
        console.warn(`[reco] Invalid cache for ${input.url}:`, e);
      }
    }
  }

  // Step 2: Render the page (reuses audit infrastructure)
  console.log(`[reco] Rendering ${input.url}...`);
  const t1 = Date.now();
  
  const rendered = await renderPage(env, input.url, {
    force: 'browser', // Always use browser for best quality
    debug: false
  });
  
  const render_ms = Date.now() - t1;
  console.log(`[reco] Rendered in ${render_ms}ms (${rendered.words} words)`);

  // Step 3: Extract facts for GPT prompt
  const facts = await extractFacts(rendered.html, rendered.text, input.url);
  
  // Step 4: Call GPT
  console.log(`[reco] Calling ${env.OPENAI_MODEL || 'gpt-4o'}...`);
  const t2 = Date.now();
  
  const result = await callGPT(env, {
    url: input.url,
    facts,
    words: rendered.words
  });
  
  const model_ms = Date.now() - t2;
  console.log(`[reco] GPT responded in ${model_ms}ms`);

  // Step 5: Validate result quality
  validateRecommendations(result, input.url);

  // Step 6: Cache result
  result._meta = {
    render_ms,
    model_ms,
    total_ms: Date.now() - t0,
    words: rendered.words,
    cached: false
  };

  if (env.RECO_CACHE) {
    const cacheKey = `reco:v2:${input.url}`;
    await env.RECO_CACHE.put(cacheKey, JSON.stringify(result), {
      expirationTtl: 60 * 60 * 24 * 7 // 7 days
    });
  }

  return result;
}

/**
 * Extract structured facts from rendered HTML (lightweight DOM parsing)
 */
async function extractFacts(html: string, text: string, url: string) {
  // Use linkedom for lightweight parsing (already imported in render.ts)
  const { parseHTML } = await import('linkedom');
  const { document } = parseHTML(html);

  const q = (sel: string) => document.querySelector(sel);
  const qa: Array<{ q: string; a: string }> = [];

  // FAQ detection: H2/H3 followed by paragraphs
  const heads = Array.from(document.querySelectorAll('h2, h3'));
  for (const h of heads) {
    const question = (h.textContent || '').trim();
    if (!question || question.length < 10) continue;

    let answer = '';
    let sibling = h.nextElementSibling;
    let hops = 0;

    while (sibling && hops < 8 && !/^H[1-6]$/.test(sibling.tagName)) {
      if (['P', 'DIV', 'UL', 'OL'].includes(sibling.tagName)) {
        const text = (sibling.textContent || '').trim();
        // Strip common boilerplate patterns
        const cleaned = text
          .replace(/^(read more|learn more|see more|show more|expand|collapse|toggle)/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleaned.length > 10) {
          answer += ' ' + cleaned;
        }
      }
      sibling = sibling.nextElementSibling;
      hops++;
    }

    if (answer.trim().length >= 60) {
      qa.push({
        q: question,
        a: answer.trim().slice(0, 1200)
      });
    }
  }

  // Existing JSON-LD
  const existingLD = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((s: any) => (s.textContent || '').trim())
    .filter(Boolean);

  const h = (sel: string) => Array.from(document.querySelectorAll(sel))
    .map((e: any) => (e.textContent || '').trim())
    .filter(Boolean);

  const metaDesc = (q('meta[name="description"]') as any)?.getAttribute('content') || '';
  const canonical = (q('link[rel="canonical"]') as any)?.getAttribute('href') || url;

  return {
    url,
    title: document.title || '',
    metaDescription: metaDesc,
    canonical,
    path: new URL(url).pathname,
    h1: h('h1')[0] || '',
    h2: h('h2').slice(0, 10),
    h3: h('h3').slice(0, 15),
    faqPairs: qa.slice(0, 40),
    existingLD,
    textSnippet: text.slice(0, 2000) // First 2000 chars of clean text
  };
}

/**
 * Call OpenAI GPT with medical-safe prompt
 */
async function callGPT(env: any, payload: { url: string; facts: any; words: number }): Promise<RecoOutput> {
  const looksFAQ = /faq/i.test(payload.facts.path) || payload.facts.faqPairs.length >= 3;

  const systemPrompt = [
    "You are Optiview's Content Recommender.",
    'Produce minimal, correct Schema.org JSON-LD and concise content edits.',
    'Voice: clear, empathetic, medically accurate, non-alarming (US 6th–8th grade reading level).',
    'Never invent clinical claims or medical facts. Only summarize what is explicitly shown on the page.',
    'If information is missing, use placeholders like "[Page description]" rather than making assumptions.',
    'For medical/health pages, maintain compliant language (e.g., "screening test" not "diagnostic test").',
  ].join(' ');

  const jsonSchema = {
    detected_intent: 'FAQPage or WebPage or Article',
    missing_schemas: ['list of schema types that would benefit this page'],
    suggested_jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': '...',
        note: 'Ready-to-paste, minimal, includes url'
      }
    ],
    content_suggestions: [
      {
        title: 'Suggestion title',
        priority: 'High or Medium or Low',
        note: 'Concise actionable note'
      }
    ]
  };

  const userMessage = JSON.stringify({
    url: payload.url,
    desired: looksFAQ ? 'FAQPage' : 'WebPage',
    pageFacts: payload.facts,
    wordCount: payload.words,
    instructions: [
      'Return missing_schemas array.',
      'Return suggested_jsonld (ready-to-paste, minimal, include url from canonical).',
      'If FAQPage: build mainEntity from faqPairs. Each Question must have name and acceptedAnswer.Answer.text.',
      'If WebPage: include name, description (2 sentences max), url.',
      'Do not duplicate existing LD if equivalent—improve it instead.',
      'Keep JSON concise. No explanatory text outside the JSON structure.'
    ].join(' ')
  });

  const apiBase = env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  const model = env.OPENAI_MODEL || 'gpt-4.5-turbo';

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${userMessage}\n\nExpected JSON schema (for guidance):\n${JSON.stringify(jsonSchema, null, 2)}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }

  const data: any = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  const parsed = JSON.parse(content);

  // Basic validation
  if (!parsed.detected_intent || !parsed.suggested_jsonld || !parsed.content_suggestions) {
    throw new Error('GPT response missing required fields');
  }

  return parsed as RecoOutput;
}


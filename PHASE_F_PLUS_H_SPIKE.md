# Phase F+ & H Spike Implementation Plan

**Goal**: Expand Brave AI coverage + transparency, spike UI scraping adapter pattern  
**Timeline**: ~6-8 hours implementation + 1 hour QA  
**Status**: 🟡 In Progress

---

## Overview

### Phase F+ (Brave "Max" Mode)
Increase query coverage from 20 → 50, add diagnostics, show what we're asking and why results are empty.

### Phase H Spike (UI Adapters)
Prove we can capture real UI answers (Perplexity, You.com, Bing Copilot) via proxy vendors, behind a feature flag.

---

## Configuration (✅ Complete - F1)

### Added to `wrangler.toml`:

```toml
# Phase F+ Brave AI Configuration
BRAVE_AI_MAX_QUERIES = "50"         # Max queries per audit (was 20)
BRAVE_AI_HARD_CAP = "100"           # Absolute max (was 40)
BRAVE_MAX_CONCURRENT = "2"          # Max concurrent requests
BRAVE_QUERY_STRATEGY = "smart"      # smart | basic | aggressive

# Phase H: UI Scrape Adapters
LLM_UI_ENABLED = "false"            # Master flag
LLM_UI_MAX_QUERIES = "10"           # Max UI queries per audit
LLM_UI_TIMEOUT_MS = "30000"         # 30s per query
LLM_UI_PROVIDERS = "perplexity"     # Comma-separated list
```

---

## Phase F+ Implementation

### F2: Smart Query Builder

**File**: `packages/api-worker/src/brave/queryBuilder.ts` (new)

```typescript
export type QueryBucket = 
  | 'brand_basics'      // "{brand}", "{brand} faq", "{brand} pricing"
  | 'product_how_to'    // "how to use {brand}", "how {brand} works"
  | 'jobs_to_be_done'   // "{problem} + {brand}", "{brand} for {segment}"
  | 'schema_probes'     // "faq about {brand}", "is {brand} covered"
  | 'competitor_compare'// "{brand} vs {competitor}"
  | 'path_specific';    // Based on actual site paths

export type SmartQuery = {
  query: string;
  bucket: QueryBucket;
  source: string; // 'template' | 'h1' | 'title' | 'path'
  priority: number; // 1-5, higher = more important
};

export function buildSmartQueries(params: {
  domain: string;
  brand: string;
  pages: Array<{url: string; title?: string; h1?: string}>;
  strategy?: 'basic' | 'smart' | 'aggressive';
  maxQueries?: number;
}): SmartQuery[] {
  const { domain, brand, pages, strategy = 'smart', maxQueries = 50 } = params;
  const queries: SmartQuery[] = [];
  
  // 1. Brand Basics (always include)
  queries.push(
    { query: brand, bucket: 'brand_basics', source: 'template', priority: 5 },
    { query: `${brand} faq`, bucket: 'brand_basics', source: 'template', priority: 4 },
    { query: `${brand} pricing`, bucket: 'brand_basics', source: 'template', priority: 4 },
    { query: `${brand} vs`, bucket: 'competitor_compare', source: 'template', priority: 3 },
    { query: `${brand} alternatives`, bucket: 'competitor_compare', source: 'template', priority: 3 }
  );
  
  // 2. Product/How-to (if strategy >= smart)
  if (strategy !== 'basic') {
    queries.push(
      { query: `how to use ${brand}`, bucket: 'product_how_to', source: 'template', priority: 4 },
      { query: `how ${brand} works`, bucket: 'product_how_to', source: 'template', priority: 4 },
      { query: `${brand} features`, bucket: 'product_how_to', source: 'template', priority: 3 },
      { query: `${brand} setup`, bucket: 'product_how_to', source: 'template', priority: 3 },
      { query: `${brand} eligibility`, bucket: 'schema_probes', source: 'template', priority: 3 }
    );
  }
  
  // 3. Path-specific queries (map paths to questions)
  const pathQueries = pages
    .filter(p => p.url)
    .map(p => {
      const path = new URL(p.url).pathname;
      if (path.includes('/faq')) return { query: `${brand} frequently asked questions`, bucket: 'schema_probes' as QueryBucket, source: 'path', priority: 4 };
      if (path.includes('/pricing')) return { query: `${brand} cost`, bucket: 'brand_basics' as QueryBucket, source: 'path', priority: 4 };
      if (path.includes('/how')) return { query: `how does ${brand} work`, bucket: 'product_how_to' as QueryBucket, source: 'path', priority: 4 };
      return null;
    })
    .filter(Boolean) as SmartQuery[];
  
  queries.push(...pathQueries);
  
  // 4. H1-driven queries (top 5 H1s)
  const h1Queries = pages
    .filter(p => p.h1 && p.h1.length > 10 && p.h1.length < 100)
    .slice(0, 5)
    .map(p => ({
      query: p.h1!,
      bucket: 'jobs_to_be_done' as QueryBucket,
      source: 'h1',
      priority: 3
    }));
  
  queries.push(...h1Queries);
  
  // 5. Aggressive: add more permutations
  if (strategy === 'aggressive') {
    queries.push(
      { query: `${brand} reviews`, bucket: 'brand_basics', source: 'template', priority: 2 },
      { query: `${brand} side effects`, bucket: 'jobs_to_be_done', source: 'template', priority: 2 },
      { query: `${brand} insurance`, bucket: 'schema_probes', source: 'template', priority: 2 },
      { query: `is ${brand} covered by insurance`, bucket: 'schema_probes', source: 'template', priority: 2 },
      { query: `${brand} instructions`, bucket: 'product_how_to', source: 'template', priority: 2 }
    );
  }
  
  // Deduplicate, sort by priority, cap
  const seen = new Set<string>();
  const deduped = queries.filter(q => {
    const key = q.query.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  return deduped
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxQueries);
}
```

### F3: Query Diagnostics

**File**: `packages/api-worker/src/brave/ai.ts` (extend existing)

```typescript
export type QueryDiagnostic = {
  query: string;
  bucket?: string;
  api: 'search' | 'summarizer';
  status: number;
  ok: boolean;
  reason?: 'success' | 'no_results' | 'rate_limited' | 'timeout' | 'error' | 'api_disabled';
  tookMs: number;
  resultCount: number;
  domainSources: number;
  domainPaths: string[];
  error?: string | null;
  ts: number;
};

// Update runBraveAIQueries to return diagnostics
export async function runBraveAIQueries(
  env: Env,
  queries: SmartQuery[],
  domain: string,
  opts?: {
    timeoutMs?: number;
    maxConcurrent?: number;
  }
): Promise<QueryDiagnostic[]> {
  const maxConcurrent = opts?.maxConcurrent || parseInt(env.BRAVE_MAX_CONCURRENT || '2');
  const timeoutMs = opts?.timeoutMs || parseInt(env.BRAVE_TIMEOUT_MS || '10000');
  
  const limit = pLimit(maxConcurrent);
  const diagnostics: QueryDiagnostic[] = [];
  
  await Promise.all(
    queries.map(sq =>
      limit(async () => {
        const startTs = Date.now();
        
        try {
          // Try Web Search first (with summary=1)
          const result = await fetchBraveWebSearch(env, sq.query, { timeoutMs });
          const tookMs = Date.now() - startTs;
          
          const domainPaths = extractDomainPaths(result.sources, domain);
          
          diagnostics.push({
            query: sq.query,
            bucket: sq.bucket,
            api: 'search',
            status: result.status,
            ok: result.ok,
            reason: result.ok ? (result.sources.length > 0 ? 'success' : 'no_results') : 'error',
            tookMs,
            resultCount: result.sources.length,
            domainSources: result.sources.filter(s => s.url.includes(domain)).length,
            domainPaths,
            ts: Date.now()
          });
          
        } catch (err: any) {
          const tookMs = Date.now() - startTs;
          
          diagnostics.push({
            query: sq.query,
            bucket: sq.bucket,
            api: 'search',
            status: 0,
            ok: false,
            reason: err.message?.includes('429') ? 'rate_limited' : 
                    err.message?.includes('timeout') ? 'timeout' : 'error',
            tookMs,
            resultCount: 0,
            domainSources: 0,
            domainPaths: [],
            error: String(err.message || err),
            ts: Date.now()
          });
        }
      })
    )
  );
  
  return diagnostics.sort((a, b) => b.ts - a.ts);
}
```

### F4: Retry Logic & Concurrency

Already handled in `pLimit` above + add retry wrapper:

```typescript
async function fetchWithRetry(
  fn: () => Promise<any>,
  opts: { maxRetries?: number; retryOn5xx?: boolean } = {}
): Promise<any> {
  const { maxRetries = 1, retryOn5xx = true } = opts;
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    try {
      const result = await fn();
      if (retryOn5xx && result.status >= 500 && result.status < 600 && attempt < maxRetries) {
        attempt++;
        await sleep(500 * Math.pow(2, attempt)); // Exponential backoff
        continue;
      }
      return result;
    } catch (err) {
      if (attempt < maxRetries) {
        attempt++;
        await sleep(500 * Math.pow(2, attempt));
        continue;
      }
      throw err;
    }
  }
}
```

### F5: Persist Diagnostics

**File**: `packages/api-worker/src/audit.ts` (update Brave section)

```typescript
// After running queries
const queryDiagnostics = await runBraveAIQueries(env, smartQueries, property.domain, {
  timeoutMs: parseInt(env.BRAVE_TIMEOUT_MS || '10000'),
  maxConcurrent: parseInt(env.BRAVE_MAX_CONCURRENT || '2')
});

// Build new brave_ai_json structure
const braveAIData = {
  version: '2.0', // Indicate new format
  runAt: Date.now(),
  strategy: env.BRAVE_QUERY_STRATEGY || 'smart',
  queries: queryDiagnostics,
  summary: {
    total: queryDiagnostics.length,
    successful: queryDiagnostics.filter(q => q.ok && q.resultCount > 0).length,
    noResults: queryDiagnostics.filter(q => q.ok && q.resultCount === 0).length,
    errors: queryDiagnostics.filter(q => !q.ok).length,
    rateLimited: queryDiagnostics.filter(q => q.reason === 'rate_limited').length,
    avgTookMs: Math.round(queryDiagnostics.reduce((sum, q) => sum + q.tookMs, 0) / queryDiagnostics.length),
    pagesCited: new Set(queryDiagnostics.flatMap(q => q.domainPaths)).size,
    byBucket: {} // Group counts by bucket
  }
};

// Store in audits.brave_ai_json
await env.DB.prepare(
  `UPDATE audits SET brave_ai_json = ? WHERE id = ?`
).bind(JSON.stringify(braveAIData), auditId).run();
```

### F6: Queries Endpoint

**File**: `packages/api-worker/src/index.ts`

```typescript
// GET /v1/audits/:id/brave/queries (already exists, but enhance pagination)
if (path.match(/^\/v1\/audits\/[^/]+\/brave\/queries$/) && request.method === 'GET') {
  const auditId = path.split('/')[3];
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '50');
  const bucket = url.searchParams.get('bucket'); // Filter by bucket
  
  try {
    const audit = await env.DB.prepare(
      `SELECT brave_ai_json FROM audits WHERE id = ?`
    ).bind(auditId).first<{ brave_ai_json: string }>();
    
    if (!audit?.brave_ai_json) {
      return json({ ok: false, error: 'No Brave AI data found' }, 404);
    }
    
    const braveData = JSON.parse(audit.brave_ai_json);
    let queries = braveData.queries || [];
    
    // Filter by bucket if specified
    if (bucket) {
      queries = queries.filter((q: any) => q.bucket === bucket);
    }
    
    // Paginate
    const total = queries.length;
    const start = (page - 1) * pageSize;
    const items = queries.slice(start, start + pageSize);
    
    return json({
      ok: true,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      filters: { bucket },
      summary: braveData.summary,
      items
    });
  } catch (err: any) {
    return json({ ok: false, error: String(err) }, 500);
  }
}
```

---

## Phase H Spike Implementation

### H1: LLM Provider Interface

**File**: `packages/api-worker/src/llm/providers/base.ts` (new)

```typescript
export type LlmAnswer = {
  provider: 'perplexity' | 'you' | 'bing' | 'gemini' | 'poe';
  query: string;
  snippet?: string;
  citations: Array<{ title?: string; url: string }>;
  timestamp: string;
  geo?: string;
  mode: 'AEO' | 'GEO' | 'unknown';
  metadata?: {
    screenshotUrl?: string;
    renderTimeMs?: number;
    error?: string;
  };
};

export interface LlmProvider {
  name: string;
  fetchAnswers(query: string, opts?: any): Promise<LlmAnswer | null>;
}
```

**File**: `packages/api-worker/src/llm/providers/perplexity.ts` (new)

```typescript
import type { LlmProvider, LlmAnswer } from './base';

export class PerplexityProvider implements LlmProvider {
  name = 'perplexity';
  
  constructor(private env: any) {}
  
  async fetchAnswers(query: string, opts: { timeoutMs?: number } = {}): Promise<LlmAnswer | null> {
    const { timeoutMs = 30000 } = opts;
    
    // Check if vendor key exists
    if (!this.env.OXYLABS_KEY && !this.env.CLORO_KEY) {
      throw new Error('No UI scraping vendor configured');
    }
    
    // Use Oxylabs/Cloro to scrape Perplexity
    // This is a spike - real implementation would use vendor SDK
    const startTs = Date.now();
    
    try {
      // Pseudo-code for vendor integration:
      // const result = await oxylabs.scrape({
      //   url: `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`,
      //   render: 'html',
      //   waitForSelector: '[data-testid="answer-container"]'
      // });
      
      // For now, return null (spike phase)
      console.log(`[SPIKE] Would scrape Perplexity for: "${query}"`);
      
      return null; // Spike: no real implementation yet
      
    } catch (err: any) {
      console.error(`Perplexity scrape failed: ${err.message}`);
      return null;
    }
  }
}
```

### H2: Feature Flag & Secrets

Added to wrangler.toml (done above).

Secrets to set manually:
```bash
wrangler secret put OXYLABS_KEY    # For Oxylabs proxy
wrangler secret put CLORO_KEY      # For Cloro proxy (alternative)
```

### H3: Orchestrator

**File**: `packages/api-worker/src/llm/orchestrator.ts` (new)

```typescript
import { PerplexityProvider } from './providers/perplexity';
import type { LlmAnswer } from './providers/base';

export async function fetchLlmAnswers(
  env: any,
  queries: string[],
  opts: {
    maxQueries?: number;
    timeoutMs?: number;
    providers?: string[];
  } = {}
): Promise<LlmAnswer[]> {
  if (env.LLM_UI_ENABLED !== 'true') {
    return [];
  }
  
  const { 
    maxQueries = parseInt(env.LLM_UI_MAX_QUERIES || '10'),
    timeoutMs = parseInt(env.LLM_UI_TIMEOUT_MS || '30000'),
    providers = (env.LLM_UI_PROVIDERS || 'perplexity').split(',')
  } = opts;
  
  const answers: LlmAnswer[] = [];
  const queriesToRun = queries.slice(0, maxQueries);
  
  for (const providerName of providers) {
    if (providerName === 'perplexity') {
      const provider = new PerplexityProvider(env);
      
      for (const query of queriesToRun) {
        try {
          const answer = await provider.fetchAnswers(query, { timeoutMs });
          if (answer) answers.push(answer);
        } catch (err) {
          console.error(`LLM provider ${providerName} failed for "${query}":`, err);
        }
      }
    }
    // Add more providers here (You.com, Bing, etc.)
  }
  
  return answers;
}
```

### H4: Storage & API Exposure

**In audit.ts**:
```typescript
// After Brave queries, optionally run UI scraping
let llmUIAnswers: LlmAnswer[] = [];
if (env.LLM_UI_ENABLED === 'true') {
  const topQueries = smartQueries.slice(0, 5).map(q => q.query);
  llmUIAnswers = await fetchLlmAnswers(env, topQueries, {
    maxQueries: parseInt(env.LLM_UI_MAX_QUERIES || '10'),
    timeoutMs: parseInt(env.LLM_UI_TIMEOUT_MS || '30000')
  });
}

// Store in audits.llm_ui_answers_json
await env.DB.prepare(
  `ALTER TABLE audits ADD COLUMN llm_ui_answers_json TEXT`
).run().catch(() => {}); // Ignore if already exists

await env.DB.prepare(
  `UPDATE audits SET llm_ui_answers_json = ? WHERE id = ?`
).bind(JSON.stringify(llmUIAnswers), auditId).run();
```

**In GET /v1/audits/:id**:
```typescript
// Parse llm_ui_answers_json if present
let uiAnswers = null;
if (audit.llm_ui_answers_json) {
  try {
    uiAnswers = JSON.parse(audit.llm_ui_answers_json);
  } catch (e) {
    console.error('Failed to parse llm_ui_answers_json:', e);
  }
}

// Add to site object
site.uiAnswers = uiAnswers;
```

---

## Frontend Implementation

### F7: Queries Modal

**File**: `apps/app/src/components/BraveQueriesModal.tsx` (enhance existing)

Add table columns:
- Bucket (badge with color)
- Reason (tooltip with details)
- Duration (ms)
- Results (count with icon)

### F8: Page Tooltip

**File**: `apps/app/src/components/PagesTable.tsx`

```typescript
<td style={{ textAlign: 'right' }} className="tabular-nums">
  {(p.aiAnswers ?? 0) > 0 && auditId ? (
    <span 
      title={`Citing queries:\n${getCitingQueries(p.url).join('\n')}`}
      style={{ cursor: 'help', borderBottom: '1px dotted' }}
    >
      <Link to={`/a/${auditId}?tab=citations&provider=Brave&path=${encodeURIComponent(formatUrl(p.url))}`}>
        {p.aiAnswers}
      </Link>
    </span>
  ) : (
    <span>{p.aiAnswers ?? 0}</span>
  )}
</td>
```

### F9: Brave-Only Filter

**File**: `apps/app/src/components/Citations.tsx`

Add quick filter button:
```typescript
<button 
  onClick={() => setProviderFilter('brave')}
  className={providerFilter === 'brave' ? 'active' : ''}
>
  🤖 Brave AI Only
</button>
```

---

## Acceptance Criteria

### Phase F+
- [ ] Audit shows **50 queries** (or configured max) in modal
- [ ] Queries are grouped by bucket with color-coded badges
- [ ] "No results" queries show reason (timeout / rate-limited / no answers)
- [ ] Page tooltip lists the exact queries that cited that page
- [ ] Citations tab "Brave AI only" filter works + preserves global counts

### Phase H Spike
- [ ] With `LLM_UI_ENABLED=true` and vendor key, at least one query returns UI answer
- [ ] UI answers show with `provenance: 'ui'` tag in Citations
- [ ] Header chip shows "UI Answers: X" (separate from Brave)
- [ ] Page Report has "UI Answers" panel listing providers + queries

---

## Deployment Checklist

1. [ ] Deploy API worker with updated config
2. [ ] Set secrets: `OXYLABS_KEY` or `CLORO_KEY` (for H spike)
3. [ ] Deploy frontend with new modals/filters
4. [ ] Run audit on domain with FAQ/pricing pages
5. [ ] Verify queries modal shows buckets + diagnostics
6. [ ] Enable `LLM_UI_ENABLED=true` and test UI scraping
7. [ ] Document vendor setup in `docs/llm-ui-providers.md`

---

**Status**: Configuration complete, now building core implementations.



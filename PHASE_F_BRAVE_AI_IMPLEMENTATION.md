# Phase F — Brave AI Answer Integration

**Goal:** Track which pages appear in actual Brave AI answers (grounding & summarizer APIs) and surface this as a first-class signal in the audit.

---

## 🎯 Overview

This phase extends the existing Phase C (AEO/GEO classification) and Phase D (page-citation linking) to include **real AI answer data** from Brave's AI APIs:

- **Grounding API**: Quick answers with source citations
- **Summarizer API**: Detailed answers with block-level citations

We'll store this data per audit, map it to pages, and surface it in the UI as:
1. **Brave AI chip** in audit header
2. **"AI (Brave)" column** in Pages table
3. **Provider filters** in Citations tab
4. **Per-page AI answer inclusion** in Page Report

---

## 1. Database Migration

**File:** `packages/api-worker/migrations/XXXX_add_brave_ai_json.sql`

```sql
-- Add column to store Brave AI query results
ALTER TABLE audits ADD COLUMN brave_ai_json TEXT;
```

**Deployment:**
```bash
cd packages/api-worker
wrangler d1 migrations apply geodude-db --remote
```

---

## 2. Brave AI Integration Module

**File:** `packages/api-worker/src/brave/ai.ts` (NEW)

```typescript
/**
 * Brave AI Answer Integration
 * Tracks which pages appear in Brave AI answers (grounding & summarizer)
 */

export type BraveAIMode = 'grounding' | 'summarizer';

export interface BraveAISource {
  url: string;
  title?: string;
  description?: string;
}

export interface BraveAIQuery {
  query: string;
  mode: BraveAIMode;
  answerText?: string;
  sources: BraveAISource[];
  timestamp: number;
  raw?: any; // Full API response for debugging
}

export interface BraveAIData {
  queries: BraveAIQuery[];
  totalQueries: number;
  totalSources: number;
  pagesCited: number; // Unique pages cited across all queries
}

/**
 * Extract pathname consistently (matches citations.ts)
 */
export function extractPathname(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return null;
  }
}

/**
 * Fetch Brave AI Grounding results
 * API Docs: https://brave.com/search/api/
 */
export async function fetchGrounding(
  apiKey: string,
  query: string
): Promise<BraveAIQuery> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&summary=1`;
  
  const response = await fetch(url, {
    headers: {
      'X-Subscription-Token': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Grounding API failed: ${response.status}`);
  }

  const data: any = await response.json();
  
  // Extract AI answer and sources
  const answerText = data.summarizer?.text || data.summary?.text;
  const sources: BraveAISource[] = [];
  
  // Sources from summarizer
  if (data.summarizer?.citations) {
    data.summarizer.citations.forEach((citation: any) => {
      sources.push({
        url: citation.url,
        title: citation.title,
        description: citation.snippet,
      });
    });
  }
  
  // Sources from web results (fallback)
  if (sources.length === 0 && data.web?.results) {
    data.web.results.slice(0, 5).forEach((result: any) => {
      sources.push({
        url: result.url,
        title: result.title,
        description: result.description,
      });
    });
  }

  return {
    query,
    mode: 'grounding',
    answerText,
    sources,
    timestamp: Date.now(),
    raw: data,
  };
}

/**
 * Fetch Brave AI Summarizer results
 * Note: Summarizer API may have different endpoint/response format
 */
export async function fetchSummarizer(
  apiKey: string,
  query: string
): Promise<BraveAIQuery> {
  // For now, use the same endpoint as grounding
  // TODO: Update when Brave releases dedicated summarizer API
  return fetchGrounding(apiKey, query);
}

/**
 * Run Brave AI queries for an audit
 */
export async function runBraveAIQueries(
  apiKey: string,
  domain: string,
  brand?: string
): Promise<BraveAIData> {
  const queries: BraveAIQuery[] = [];
  
  // Generate query set
  const queryStrings = [
    `site:${domain}`,
    `${brand || domain}`,
    `${brand || domain} FAQ`,
    `${brand || domain} how to use`,
    `${brand || domain} reviews`,
  ];

  // Fetch each query (with rate limiting)
  for (const queryString of queryStrings) {
    try {
      const result = await fetchGrounding(apiKey, queryString);
      queries.push(result);
      
      // Politeness delay
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`Failed to fetch Brave AI for "${queryString}":`, error);
    }
  }

  // Calculate aggregates
  const totalSources = queries.reduce((sum, q) => sum + q.sources.length, 0);
  const uniquePaths = new Set<string>();
  
  queries.forEach(q => {
    q.sources.forEach(s => {
      const path = extractPathname(s.url);
      if (path) uniquePaths.add(path);
    });
  });

  return {
    queries,
    totalQueries: queries.length,
    totalSources,
    pagesCited: uniquePaths.size,
  };
}
```

---

## 3. Audit Pipeline Integration

**File:** `packages/api-worker/src/audit.ts`

Add Brave AI query step after citations:

```typescript
import { runBraveAIQueries, extractPathname } from './brave/ai';

export async function runAudit(/* ... */) {
  // ... existing crawl, citations logic ...

  // Run Brave AI queries (after citations, before scoring)
  console.log('Running Brave AI queries...');
  let braveAI = null;
  
  if (env.BRAVE_SEARCH) {
    try {
      braveAI = await runBraveAIQueries(
        env.BRAVE_SEARCH,
        property.domain,
        property.name || property.domain.replace(/^www\./, '').split('.')[0]
      );
      console.log(`Brave AI: ${braveAI.queries.length} queries, ${braveAI.pagesCited} pages cited`);
    } catch (error) {
      console.error('Brave AI queries failed:', error);
    }
  }

  // ... existing scoring logic ...

  // Save audit with Brave AI data
  await env.DB.prepare(`
    UPDATE audits 
    SET status = ?, 
        score_overall = ?,
        /* ... other fields ... */
        brave_ai_json = ?,
        completed_at = ?
    WHERE id = ?
  `).bind(
    'completed',
    scoreOverall,
    /* ... other values ... */
    braveAI ? JSON.stringify(braveAI) : null,
    Date.now(),
    auditId
  ).run();

  // ... rest of audit logic ...
}
```

---

## 4. API Response Enhancement

**File:** `packages/api-worker/src/index.ts`

### A) GET /v1/audits/:id - Add braveAI to response

```typescript
// After fetching audit from DB
const audit = await env.DB.prepare(
  `SELECT id, property_id, status, /* ... */, brave_ai_json, /* ... */
   FROM audits WHERE id = ?`
).bind(auditId).first();

// Parse Brave AI data
let braveAI = null;
if (audit.brave_ai_json) {
  try {
    braveAI = JSON.parse(audit.brave_ai_json);
  } catch (err) {
    console.error('Failed to parse brave_ai_json:', err);
  }
}

// Add to response
const response = {
  /* ... existing fields ... */
  site: {
    /* ... existing site fields ... */
    braveAI: braveAI,
  },
  /* ... pages, issues, citations ... */
};
```

### B) Enhance pages with aiAnswers count

```typescript
// When building pages array
const pagesOut = pages.results.map((p: any) => {
  let path = '/';
  try {
    path = new URL(p.url).pathname.replace(/\/+$/, '') || '/';
  } catch {}

  // Count AI answer appearances
  let aiAnswers = 0;
  if (braveAI) {
    braveAI.queries.forEach((q: any) => {
      q.sources.forEach((s: any) => {
        const sourcePath = extractPathname(s.url);
        if (sourcePath === path) {
          aiAnswers++;
        }
      });
    });
  }

  return {
    /* ... existing fields ... */
    aiAnswers,
  };
});
```

### C) GET /v1/audits/:id/citations - Add provider filter

```typescript
// Parse filter params
const typeFilter = url.searchParams.get('type') as 'AEO' | 'GEO' | 'Organic' | null;
const pathFilter = url.searchParams.get('path');
const providerFilter = url.searchParams.get('provider'); // NEW: 'Brave' or null

// When filtering citations
let allCitations = (result.results || []).map((c: any) => ({
  ...c,
  type: classifyCitation(c),
  pagePathname: extractPath(c.url),
  provider: c.engine, // 'brave' from DB
}));

// Apply provider filter
if (providerFilter) {
  allCitations = allCitations.filter((c: any) => 
    c.provider?.toLowerCase() === providerFilter.toLowerCase()
  );
}

// Apply type filter (existing)
if (typeFilter) {
  allCitations = allCitations.filter((c: any) => c.type === typeFilter);
}

// Apply path filter (existing)
if (pathFilter) {
  allCitations = allCitations.filter((c: any) => c.pagePathname === pathFilter);
}
```

---

## 5. Frontend Updates

### A) API Types

**File:** `apps/app/src/services/api.ts`

```typescript
export interface BraveAISource {
  url: string;
  title?: string;
  description?: string;
}

export interface BraveAIQuery {
  query: string;
  mode: 'grounding' | 'summarizer';
  answerText?: string;
  sources: BraveAISource[];
  timestamp: number;
}

export interface BraveAIData {
  queries: BraveAIQuery[];
  totalQueries: number;
  totalSources: number;
  pagesCited: number;
}

export type SiteMeta = {
  /* ... existing fields ... */
  braveAI?: BraveAIData | null;
};

export type AuditPage = {
  /* ... existing fields ... */
  aiAnswers?: number; // NEW: Brave AI answer count
};

// Update getAuditCitations to support provider filter
export async function getAuditCitations(
  auditId: string,
  opts?: {
    type?: CitationType;
    path?: string;
    provider?: string; // NEW
    page?: number;
    pageSize?: number;
  },
  signal?: AbortSignal
): Promise<CitationsResponse> {
  const params = new URLSearchParams();
  if (opts?.type) params.set('type', opts.type);
  if (opts?.path) params.set('path', opts.path);
  if (opts?.provider) params.set('provider', opts.provider); // NEW
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.pageSize) params.set('pageSize', String(opts.pageSize));
  
  const queryString = params.toString();
  const url = `${API_BASE}/v1/audits/${auditId}/citations${queryString ? '?' + queryString : ''}`;
  
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`getAuditCitations failed: ${res.status}`);
  return res.json() as Promise<CitationsResponse>;
}
```

### B) Audit Header - Brave AI Chip

**File:** `apps/app/src/routes/PublicAudit.tsx`

Add after existing AI Access chips:

```tsx
{/* Brave AI Answer Summary */}
{audit.site?.braveAI && audit.site.braveAI.pagesCited > 0 && (
  <div style={{ 
    marginTop: 12, 
    padding: '8px 12px', 
    background: '#6366f1', 
    borderRadius: 6,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8
  }}>
    <span style={{ fontSize: 13, fontWeight: 500 }}>
      🤖 Brave AI: {audit.site.braveAI.pagesCited} page{audit.site.braveAI.pagesCited !== 1 ? 's' : ''} cited
    </span>
    <span style={{ fontSize: 12, opacity: 0.8 }}>
      ({audit.site.braveAI.totalQueries} queries)
    </span>
  </div>
)}
```

### C) Pages Table - Add "AI (Brave)" Column

**File:** `apps/app/src/components/PagesTable.tsx`

Add column after "Cites":

```tsx
<th style={{ textAlign: 'right' }} title="Brave AI answer appearances">
  AI (Brave)
</th>

{/* In tbody */}
<td style={{ textAlign: 'right' }} className="tabular-nums">
  {(p.aiAnswers ?? 0) > 0 && auditId ? (
    <Link
      to={`/a/${auditId}?tab=citations&path=${encodeURIComponent(formatUrl(p.url))}&provider=Brave&type=AEO`}
      style={{ color: '#6366f1', textDecoration: 'underline', cursor: 'pointer' }}
      title="View Brave AI citations for this page"
    >
      {p.aiAnswers}
    </Link>
  ) : (
    <span>—</span>
  )}
</td>
```

### D) Citations Tab - Add Provider Filter

**File:** `apps/app/src/components/Citations.tsx`

Add provider filter state and UI:

```tsx
const [providerFilter, setProviderFilter] = useState<string | null>(
  params.get('provider') || null
);

// Update URL effect to include provider
useEffect(() => {
  const newParams = new URLSearchParams(location.search);
  // ... existing tab handling ...
  if (typeFilter) newParams.set('ct', typeFilter);
  if (pathFilter) newParams.set('path', pathFilter);
  if (providerFilter) newParams.set('provider', providerFilter); // NEW
  // ... navigate ...
}, [typeFilter, pathFilter, providerFilter, /* ... */]);

// Fetch with provider filter
useEffect(() => {
  getAuditCitations(auditId, {
    type: typeFilter || undefined,
    path: pathFilter || undefined,
    provider: providerFilter || undefined, // NEW
    page,
    pageSize
  })
  // ...
}, [auditId, typeFilter, pathFilter, providerFilter, page, pageSize]);

{/* Provider filter pills (add after type filter pills) */}
<div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
  <button onClick={() => setProviderFilter(null)}>All Providers</button>
  <button onClick={() => setProviderFilter('Brave')}>Brave Only</button>
</div>

{/* Provider filter chip (show when active) */}
{providerFilter && (
  <div style={{ /* chip styling */ }}>
    <span>Provider: <strong>{providerFilter}</strong></span>
    <button onClick={() => setProviderFilter(null)}>✕ Clear</button>
  </div>
)}
```

### E) Page Report - AI Answer Inclusion Panel

**File:** `apps/app/src/pages/PageReport.tsx`

Add after Citations panel in Overview tab:

```tsx
{/* Brave AI Answer Inclusion */}
{audit.site?.braveAI && data.page.aiAnswers > 0 && (
  <>
    <h2 style={{ margin: '32px 0 16px', fontSize: '24px' }}>
      Brave AI Answers ({data.page.aiAnswers})
    </h2>
    <div style={{ 
      padding: 16, 
      background: '#1e1f23', 
      borderRadius: 8,
      border: '1px solid #6366f1'
    }}>
      <p style={{ marginTop: 0, fontSize: 14, opacity: 0.8 }}>
        This page appears in {data.page.aiAnswers} Brave AI answer{data.page.aiAnswers !== 1 ? 's' : ''}:
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {audit.site.braveAI.queries.map((query, idx) => {
          const cited = query.sources.some(s => {
            const path = extractPathname(s.url);
            const targetPath = extractPathname(target);
            return path === targetPath;
          });
          
          if (!cited) return null;
          
          return (
            <li key={idx} style={{ 
              padding: 12, 
              marginTop: 8,
              background: '#2a2b2e', 
              borderRadius: 6,
              borderLeft: '3px solid #6366f1'
            }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>
                Query: "{query.query}"
              </div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Mode: {query.mode} • {query.sources.length} sources
              </div>
              {query.answerText && (
                <div style={{ 
                  marginTop: 8, 
                  padding: 8, 
                  background: '#1a1b1e', 
                  borderRadius: 4,
                  fontSize: 13,
                  fontStyle: 'italic'
                }}>
                  "{query.answerText.substring(0, 200)}..."
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  </>
)}
```

---

## 6. Environment Configuration

**File:** `packages/api-worker/wrangler.toml`

Ensure Brave API key is configured:

```toml
[vars]
BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search"
# BRAVE_SEARCH secret should be set via: wrangler secret put BRAVE_SEARCH
```

---

## 7. QA Checklist

### API Tests

```bash
# 1. Audit includes braveAI data
curl -s 'https://api.optiview.ai/v1/audits/YOUR_AUDIT_ID' | \
  jq '.site.braveAI'

# Expected: {queries: [...], totalQueries: N, pagesCited: M}

# 2. Pages have aiAnswers counts
curl -s 'https://api.optiview.ai/v1/audits/YOUR_AUDIT_ID' | \
  jq '.pages[0:3] | .[] | {url, aiAnswers, citationCount}'

# Expected: Each page shows aiAnswers count

# 3. Citations filter by provider
curl -s 'https://api.optiview.ai/v1/audits/YOUR_AUDIT_ID/citations?provider=Brave&pageSize=5' | \
  jq '{total, items: [.items[] | {url, provider, type}]}'

# Expected: Only Brave citations

# 4. Citations filter by provider + type
curl -s 'https://api.optiview.ai/v1/audits/YOUR_AUDIT_ID/citations?provider=Brave&type=AEO' | \
  jq '.counts'

# Expected: counts reflect filtered subset
```

### UI Tests

1. **Audit Header**
   - [ ] Brave AI chip appears when pagesCited > 0
   - [ ] Shows correct query count and pages cited

2. **Pages Table**
   - [ ] "AI (Brave)" column visible
   - [ ] Clickable counts navigate to filtered Citations
   - [ ] URL includes ?provider=Brave&type=AEO

3. **Citations Tab**
   - [ ] Provider filter pills visible
   - [ ] Click "Brave Only" filters correctly
   - [ ] Provider chip appears with clear button
   - [ ] Counts update when filtering

4. **Page Report**
   - [ ] AI Answer panel appears for pages with aiAnswers > 0
   - [ ] Lists queries that cited the page
   - [ ] Shows query text and answer snippet
   - [ ] Empty state for pages not in AI answers

---

## 8. Deployment Steps

```bash
# 1. Run migration
cd packages/api-worker
wrangler d1 migrations apply geodude-db --remote

# 2. Set Brave API key (if not already set)
wrangler secret put BRAVE_SEARCH

# 3. Deploy API
pnpm run deploy

# 4. Build and deploy frontend
cd ../../apps/app
pnpm run build
pnpm run deploy

# 5. Verify deployment
curl -s https://api.optiview.ai/status | jq .

# 6. Run test audit
# Navigate to app.optiview.ai and trigger new audit
```

---

## 9. Future Enhancements

- **Historical tracking**: Store Brave AI results over time to track trends
- **Query suggestions**: Auto-generate optimal queries based on page content
- **Answer quality scoring**: Rank pages by how prominently they appear in answers
- **Multi-provider support**: Add Google SGE, Bing Copilot, Perplexity, etc.
- **Alert system**: Notify when pages drop out of AI answers

---

## Notes

- Brave API rate limits: Check current tier (typically 2,000 queries/month on free tier)
- API response caching: Consider caching Brave AI results for 24-48 hours
- Cost monitoring: Track API usage per audit to avoid unexpected charges
- Error handling: Gracefully degrade if Brave API is unavailable
- Privacy: Brave AI data is audit-specific, not persisted long-term by default

---

**Ready to implement!** 🚀

This phase transforms Optiview from "heuristic AEO tracking" to "actual AI answer tracking" with real Brave data.


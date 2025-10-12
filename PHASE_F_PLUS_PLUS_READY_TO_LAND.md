# Phase F++ Ready to Land 🚀

## ✅ **Backend 100% Complete** (Just Deployed)

### What's Live Right Now

**Latest Deployment**: `8bfd71fd-be78-4d96-b35e-2db9dc609a7c` (2025-10-12)

1. ✅ **Deep Link Filter**: `GET /v1/audits/:id/citations?provider=Brave&query=<q>`
2. ✅ **Query Exports**: 
   - `GET /v1/audits/:id/brave/queries.csv?bucket=...&status=...`
   - `GET /v1/audits/:id/brave/queries.json?...`
3. ✅ **Run More**: `POST /v1/audits/:id/brave/run-more` with `{ add?, extraTerms? }`
4. ✅ **Mapping Metadata**: Every page now includes `aiAnswerMappings[]` with `reason` + `confidence`

### Sample API Response

```json
{
  "pages": [
    {
      "url": "https://www.cologuard.com/how-it-works",
      "aiAnswers": 2,
      "aiAnswerQueries": ["how cologuard works", "how to use cologuard"],
      "aiAnswerMappings": [
        {"reason": "canonical", "confidence": 0.95},
        {"reason": "title_fuzzy", "confidence": 0.62}
      ]
    }
  ]
}
```

**Mapping Reasons**:
- `path`: Exact pathname match (confidence: 1.0)
- `canonical`: Matched via `<link rel="canonical">` (confidence: 0.95)
- `title_fuzzy`: Fuzzy title/H1 text match (confidence: 0.3-1.0)

---

## 🔲 **Frontend: Minimal Diff to Finish**

All backend work is done. Here's the **exact** frontend checklist:

### **1. BraveQueriesModal.tsx** (Main Component)

**Location**: `apps/app/src/components/BraveQueriesModal.tsx`

#### A) Header Metrics Bar

Insert below the title, above the filter pills:

```tsx
{/* Metrics Bar */}
{data && (
  <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
    <div className="flex gap-6 text-sm">
      <div>
        <span className="text-gray-700">Answer Rate:</span>
        <span className="ml-2 font-bold text-emerald-600">
          {Math.round((data.diagnostics.ok / data.total) * 100)}%
        </span>
      </div>
      <div>
        <span className="text-gray-700">Domain-Hit Rate:</span>
        <span className="ml-2 font-bold text-blue-600">
          {Math.round((data.items.filter(q => (q.domainSources || 0) > 0).length / data.total) * 100)}%
        </span>
      </div>
      <div>
        <span className="text-gray-700">Pages Cited:</span>
        <span className="ml-2 font-bold text-purple-600">
          {new Set(data.items.flatMap(q => q.domainPaths || [])).size}
        </span>
      </div>
    </div>
    
    {/* Per-bucket badges */}
    <div className="mt-2 flex flex-wrap gap-2">
      {['brand_core', 'product_how_to', 'jobs_to_be_done', 'schema_probes', 'content_seeds', 'competitive'].map(b => {
        const bucketItems = data.items.filter(q => q.bucket === b);
        const answered = bucketItems.filter(q => q.queryStatus === 'ok').length;
        if (bucketItems.length === 0) return null;
        return (
          <span key={b} className={`text-xs px-2 py-1 rounded font-medium ${getBucketColor(b)}`}>
            {b.replace(/_/g, ' ')}: {answered}/{bucketItems.length}
          </span>
        );
      })}
    </div>
  </div>
)}
```

#### B) Export Buttons

Add next to the close button in the header:

```tsx
<div className="flex gap-2 mr-4">
  <a
    href={`https://api.optiview.ai/v1/audits/${auditId}/brave/queries.csv${bucket ? `?bucket=${bucket}` : ''}${status ? `${bucket ? '&' : '?'}status=${status}` : ''}`}
    download
    className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
  >
    Export CSV
  </a>
  <a
    href={`https://api.optiview.ai/v1/audits/${auditId}/brave/queries.json${bucket ? `?bucket=${bucket}` : ''}${status ? `${bucket ? '&' : '?'}status=${status}` : ''}`}
    download
    className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
  >
    Export JSON
  </a>
</div>
```

#### C) "View Citations" Link Per Row

Add a new column to the table (after "MS"):

```tsx
<th className="text-left text-xs font-medium text-gray-600 px-3">Actions</th>

{/* In tbody */}
<td className="py-2 px-3">
  {q.sourcesTotal > 0 && (
    <a
      href={`/a/${auditId}?tab=citations&provider=Brave&query=${encodeURIComponent(q.q)}`}
      className="text-xs text-blue-600 hover:underline"
      title="View citations from this query"
    >
      View ({q.sourcesTotal})
    </a>
  )}
</td>
```

#### D) "Run +10 More" Button + Custom Queries

Add below the filters section:

```tsx
{/* Run More Section */}
<div className="border-b border-gray-200 p-4 bg-blue-50">
  <div className="flex items-start gap-4">
    <button
      onClick={async () => {
        try {
          setLoading(true);
          const response = await fetch(`https://api.optiview.ai/v1/audits/${auditId}/brave/run-more`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              add: 10, 
              extraTerms: customQueries.split('\n').map(q => q.trim()).filter(Boolean)
            })
          });
          const result = await response.json();
          if (result.ok) {
            // Refresh modal data
            setPage(1);
            alert(`✓ Added ${result.added} new queries!`);
          } else {
            alert(`⚠ Error: ${result.error}`);
          }
        } catch (err: any) {
          alert(`✗ Failed: ${err.message}`);
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading || isRateLimited}
      className={`px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition ${isRateLimited ? 'opacity-50' : ''}`}
      title={
        isRateLimited
          ? `Rate limit detected. Lower BRAVE_MAX_QUERIES or upgrade Brave plan.`
          : 'Run 10 additional smart queries'
      }
    >
      {loading ? 'Running...' : isRateLimited ? '⚠ Rate Limited' : 'Run +10 More'}
    </button>
    
    <div className="flex-1">
      <label className="text-xs font-medium text-gray-700 block mb-1">
        Custom queries (optional, one per line):
      </label>
      <textarea
        value={customQueries}
        onChange={(e) => setCustomQueries(e.target.value)}
        placeholder="cologuard insurance coverage
cologuard Medicare
cologuard doctor recommendation"
        className="w-full p-2 text-xs border border-gray-300 rounded resize-none font-mono"
        rows={3}
      />
    </div>
  </div>
</div>
```

**State**: Add at top of component:
```tsx
const [customQueries, setCustomQueries] = useState('');

// Rate limit detection
const recentRateLimits = data?.items.filter(q => 
  q.queryStatus === 'rate_limited' && 
  Date.now() - (q.ts || 0) < 3600000 // Last hour
).length || 0;
const isRateLimited = recentRateLimits > 5;
```

#### E) Enhanced Status Tooltips

Update the status cell rendering:

```tsx
<td className="py-2 px-3">
  <span
    className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(q.queryStatus)}`}
    title={
      q.queryStatus === 'rate_limited'
        ? `Brave free tier limit hit. Lower queries to 20-30 or upgrade to paid plan. (${recentRateLimits} recent 429s)`
        : q.queryStatus === 'empty'
        ? 'Brave returned no answer block for this query. Try broader or how-to variants.'
        : q.queryStatus === 'timeout'
        ? `Query exceeded 7s timeout. Check network or increase BRAVE_TIMEOUT_MS.`
        : q.queryStatus === 'error'
        ? `HTTP error: ${q.error || 'Unknown'}`
        : 'Query succeeded and returned results'
    }
  >
    {q.queryStatus || 'unknown'}
  </span>
</td>
```

---

### **2. PagesTable.tsx** (Mapping Reason Tooltips)

**Location**: `apps/app/src/components/PagesTable.tsx`

Update the AI (Brave) column tooltip:

```tsx
title={
  p.aiAnswerQueries && p.aiAnswerQueries.length > 0
    ? `Cited by ${p.aiAnswers} Brave AI answer${p.aiAnswers === 1 ? '' : 's'}\n\nTop queries:\n${
        p.aiAnswerQueries.map((q, idx) => {
          const mapping = p.aiAnswerMappings?.[idx];
          const reason = mapping?.reason 
            ? ` (via ${mapping.reason === 'title_fuzzy' ? 'title match' : mapping.reason})` 
            : '';
          return `• ${q}${reason}`;
        }).join('\n')
      }`
    : "No Brave AI answers cited this page (yet)"
}
```

---

### **3. api.ts** (Add Query Filter)

**Location**: `apps/app/src/services/api.ts`

Update `getAuditCitations`:

```tsx
export async function getAuditCitations(
  auditId: string,
  opts?: {
    page?: number;
    pageSize?: number;
    type?: CitationType | null;
    path?: string | null;
    provider?: string | null;
    mode?: string | null;
    query?: string | null; // NEW: Phase F++
  }
): Promise<CitationsResponse> {
  const params = new URLSearchParams();
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.pageSize) params.set('pageSize', String(opts.pageSize));
  if (opts?.type) params.set('type', opts.type);
  if (opts?.path) params.set('path', opts.path);
  if (opts?.provider) params.set('provider', opts.provider);
  if (opts?.mode) params.set('mode', opts.mode);
  if (opts?.query) params.set('query', opts.query); // NEW

  const response = await fetch(`${API_BASE}/v1/audits/${auditId}/citations?${params}`);
  if (!response.ok) throw new Error('Failed to fetch citations');
  return response.json();
}
```

Also add the `aiAnswerMappings` field to the `AuditPage` type:

```tsx
export type AuditPage = {
  // ... existing fields ...
  aiAnswerQueries?: string[];
  aiAnswerMappings?: Array<{ reason: 'path' | 'canonical' | 'title_fuzzy'; confidence: number }>; // NEW
};
```

---

### **4. PageReport.tsx** (Cited/Near-Miss Sections)

**Location**: `apps/app/src/routes/PageReport.tsx`

Add after the existing content in the Recommendations tab:

```tsx
{/* Brave AI Query Performance */}
{(citedQueries.length > 0 || nearMissQueries.length > 0) && (
  <div className="bg-white border border-gray-200 rounded-lg p-6 mt-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">Brave AI Query Performance</h3>
    
    {/* Cited Queries */}
    {citedQueries.length > 0 && (
      <div className="mb-6">
        <h4 className="text-sm font-medium text-emerald-700 mb-2">
          ✓ Cited Queries ({citedQueries.length})
        </h4>
        <p className="text-sm text-gray-600 mb-3">
          These Brave AI queries successfully cited this page:
        </p>
        <div className="space-y-2">
          {citedQueries.map((q, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <span className="text-emerald-600">•</span>
              <span className="flex-1">
                "{q.query}" <span className="text-gray-500">({q.sourceCount} sources)</span>
              </span>
              <a
                href={`/a/${auditId}?tab=citations&provider=Brave&query=${encodeURIComponent(q.query)}`}
                className="text-xs text-blue-600 hover:underline"
              >
                View
              </a>
            </div>
          ))}
        </div>
      </div>
    )}
    
    {/* Near-Miss Queries */}
    {nearMissQueries.length > 0 && (
      <div>
        <h4 className="text-sm font-medium text-yellow-700 mb-2">
          ⚠ Near-Miss Queries ({nearMissQueries.length})
        </h4>
        <p className="text-sm text-gray-600 mb-3">
          These queries returned results but didn't cite your page. Consider:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 mb-3">
          <li>Adding FAQ schema if query contains "faq" or "questions"</li>
          <li>Strengthening H1/H2 to match query intent</li>
          <li>Adding a section that directly answers the query</li>
        </ul>
        <div className="space-y-2">
          {nearMissQueries.map((q, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <span className="text-yellow-600">•</span>
              <span className="flex-1">
                "{q.query}" <span className="text-gray-500">({q.totalSources} sources, 0 yours)</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
)}
```

**Data Fetching**: Add state and useEffect:

```tsx
const [citedQueries, setCitedQueries] = useState<any[]>([]);
const [nearMissQueries, setNearMissQueries] = useState<any[]>([]);

useEffect(() => {
  if (!auditId || !pagePathname) return;
  
  fetch(`https://api.optiview.ai/v1/audits/${auditId}/brave/queries?pageSize=200`)
    .then(res => res.json())
    .then(data => {
      const queries = data.items || [];
      
      // Cited queries (domainPaths includes this page)
      const cited = queries
        .filter(q => (q.domainPaths || []).includes(pagePathname) && q.queryStatus === 'ok')
        .map(q => ({ query: q.q, sourceCount: q.sourcesTotal }));
      
      // Near-miss queries (ok status, has sources, but didn't cite this page)
      const nearMiss = queries
        .filter(q => 
          q.queryStatus === 'ok' && 
          q.sourcesTotal > 0 && 
          !(q.domainPaths || []).includes(pagePathname)
        )
        .map(q => ({ query: q.q, totalSources: q.sourcesTotal }))
        .slice(0, 5); // Top 5
      
      setCitedQueries(cited);
      setNearMissQueries(nearMiss);
    })
    .catch(err => console.error('Failed to fetch Brave queries:', err));
}, [auditId, pagePathname]);
```

---

## 🧪 **Quick QA Script** (15 Minutes)

Run this after deploying frontend:

```bash
# 1. Modal Flow
Open audit → Click "Brave AI" chip → Modal opens
✓ Check: Metrics bar shows Answer %, Domain-hit %, Pages cited
✓ Check: Per-bucket badges show (e.g., "brand_core: 8/10")
✓ Check: Click a query's "View" link → lands on Citations tab with provider=Brave&query=<q>

# 2. Exports
✓ Check: Apply bucket filter (e.g., "How-to") → Export CSV → file has only how-to queries
✓ Check: Apply status filter (e.g., "OK") → Export JSON → file has only OK queries

# 3. Run +10 More
✓ Check: Click "Run +10 More" → rows increase; new queries appear
✓ Check: Add custom term "cologuard benefits" → runs query → appears in list
✓ Check: If 5+ recent 429s → button disabled with tooltip

# 4. Pages Table
✓ Check: Hover AI (Brave) count → tooltip shows "• how it works (via canonical)"

# 5. Page Report
✓ Check: Open a page with aiAnswers > 0 → see "Cited Queries" section
✓ Check: Click "View" link → opens Citations with query filter
```

---

## 📝 **Gotchas to Avoid**

1. **API Base URL**: All new fetch calls use `https://api.optiview.ai` (not relative)
2. **URL State**: When navigating to Citations tab, preserve existing query params
3. **429 Detection**: Check `Date.now() - q.ts < 3600000` (last hour) for rate limiting
4. **Export URLs**: Include both `bucket` and `status` filters in query string
5. **Refresh After Run-More**: Reset pagination (`setPage(1)`) after successful POST

---

## 🎯 **When Complete**

Phase F++ transforms the Brave AI Queries modal from "informative" to "indispensable":
- ✅ **Transparency**: Every query + reason why it worked/didn't
- ✅ **Actionability**: Deep links to citations + exports for analysis
- ✅ **Control**: Run +10 More + custom queries on demand
- ✅ **Intelligence**: Near-miss suggestions feed recommendations

**No competitor does this.** This is a **massive moat**.

---

**Created**: 2025-10-12  
**Backend Status**: ✅ 100% Complete & Deployed  
**Frontend Status**: 🔲 Ready to implement (estimated 2-3 hours)  
**API Version**: `8bfd71fd-be78-4d96-b35e-2db9dc609a7c`


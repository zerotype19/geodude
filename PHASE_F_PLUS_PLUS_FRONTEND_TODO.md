# Phase F++ Frontend Implementation Guide

## ✅ Backend Complete

All backend work is done and deployed:
- ✅ `sourceUrls[]` persisted in Brave query logs
- ✅ Fuzzy text matching utilities (Jaccard + Levenshtein)
- ✅ Enhanced page mapping with canonical/title fallback
- ✅ `GET /v1/audits/:id/citations?query=<q>` filter
- ✅ `GET /v1/audits/:id/brave/queries.csv` export
- ✅ `GET /v1/audits/:id/brave/queries.json` export
- ✅ `POST /v1/audits/:id/brave/run-more` (already existed)

---

## 🔲 Frontend TODOs (Priority Order)

### 1. **BraveQueriesModal Enhancements**

**File**: `apps/app/src/components/BraveQueriesModal.tsx`

#### A) Add Header Metrics Bar (Gap #2)

Insert after the "Brave AI Queries" title (before filters section):

```tsx
{/* Metrics Summary Bar */}
{data && (
  <div className="mt-4 flex gap-6 text-sm">
    <div>
      <span className="text-gray-600">Answer Rate:</span>
      <span className="ml-2 font-bold text-emerald-600">
        {Math.round((data.diagnostics.ok / data.total) * 100)}%
      </span>
    </div>
    <div>
      <span className="text-gray-600">Domain-Hit Rate:</span>
      <span className="ml-2 font-bold text-blue-600">
        {Math.round((data.items.filter(q => (q.domainSources || 0) > 0).length / data.total) * 100)}%
      </span>
    </div>
    <div>
      <span className="text-gray-600">Pages Cited:</span>
      <span className="ml-2 font-bold text-purple-600">
        {new Set(data.items.flatMap(q => q.domainPaths || [])).size}
      </span>
    </div>
  </div>
)}

{/* Per-bucket breakdown */}
{data && (
  <div className="mt-2 flex flex-wrap gap-2">
    {['brand_core', 'product_how_to', 'jobs_to_be_done', 'schema_probes', 'content_seeds', 'competitive'].map(b => {
      const bucketItems = data.items.filter(q => q.bucket === b);
      const answered = bucketItems.filter(q => q.queryStatus === 'ok').length;
      if (bucketItems.length === 0) return null;
      return (
        <span key={b} className={`text-xs px-2 py-1 rounded ${getBucketColor(b)}`}>
          {b.replace('_', ' ')}: {answered}/{bucketItems.length}
        </span>
      );
    })}
  </div>
)}
```

#### B) Add Export Buttons (Gap #4)

Add to the header section (next to close button):

```tsx
{/* Export buttons */}
<div className="flex gap-2">
  <a
    href={`/api/v1/audits/${auditId}/brave/queries.csv?${bucket ? `bucket=${bucket}&` : ''}${status ? `status=${status}` : ''}`}
    download
    className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
  >
    Export CSV
  </a>
  <a
    href={`/api/v1/audits/${auditId}/brave/queries.json?${bucket ? `bucket=${bucket}&` : ''}${status ? `status=${status}` : ''}`}
    download
    className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
  >
    Export JSON
  </a>
</div>
```

**Note**: Update the API URLs to use `https://api.optiview.ai` instead of `/api`.

#### C) Add "View Citations" Link Per Row (Gap #1)

In the table body, add a new column after "MS":

```tsx
<thead>
  {/* ... existing columns ... */}
  <th className="text-left text-xs font-medium text-gray-600">Actions</th>
</thead>

<tbody>
  {data.items.map((q, idx) => (
    <tr key={idx} className="border-b border-gray-100">
      {/* ... existing cells ... */}
      <td className="py-2 px-3">
        {q.sourcesTotal > 0 && (
          <a
            href={`/a/${auditId}?tab=citations&provider=Brave&query=${encodeURIComponent(q.q)}`}
            className="text-xs text-blue-600 hover:underline"
            title="View citations from this query"
          >
            View citations ({q.sourcesTotal})
          </a>
        )}
      </td>
    </tr>
  ))}
</tbody>
```

#### D) Add "Run +10 More" Button + Custom Queries (Gap #5)

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
            body: JSON.stringify({ add: 10, extraTerms: customQueries.split('\n').filter(Boolean) })
          });
          const result = await response.json();
          if (result.ok) {
            // Refresh data
            setPage(1);
            setBucket(null);
            setStatus(null);
            alert(`Added ${result.added} new queries!`);
          } else {
            alert(`Error: ${result.error}`);
          }
        } catch (err) {
          alert(`Failed: ${err.message}`);
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Running...' : 'Run +10 More'}
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
        className="w-full p-2 text-xs border border-gray-300 rounded resize-none"
        rows={3}
        style={{ fontFamily: 'monospace' }}
      />
    </div>
  </div>
</div>
```

**State**: Add `const [customQueries, setCustomQueries] = useState('');` at the top of the component.

#### E) Add Status Tooltips (Gap #7)

Update the status badge rendering to include helpful tooltips:

```tsx
<td className="py-2 px-3">
  <span
    className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(q.queryStatus)}`}
    title={
      q.queryStatus === 'rate_limited'
        ? 'Brave free tier limit hit. Lower queries to 20-30 or upgrade to paid plan.'
        : q.queryStatus === 'empty'
        ? 'Brave returned no answer block for this query. Try broader or how-to variants.'
        : q.queryStatus === 'timeout'
        ? `Query exceeded ${7000}ms timeout. Check network or increase BRAVE_TIMEOUT_MS.`
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

### 2. **Pages Table Enhancements**

**File**: `apps/app/src/components/PagesTable.tsx`

#### Update AI (Brave) Column Tooltip (Gap #6)

Current tooltip shows top 3 queries. Add mapping reason info:

```tsx
title={
  p.aiAnswerQueries && p.aiAnswerQueries.length > 0
    ? `Cited by ${p.aiAnswers} Brave AI answer${p.aiAnswers === 1 ? '' : 's'}\n\nTop queries:\n${
        p.aiAnswerQueries.map((q, idx) => {
          const mapping = p.aiAnswerMappings?.[idx]; // New field from backend
          const reason = mapping?.reason ? ` (via ${mapping.reason})` : '';
          return `• ${q}${reason}`;
        }).join('\n')
      }`
    : "No Brave AI answers cited this page (yet)"
}
```

**Backend TODO**: Update `GET /v1/audits/:id` to include `aiAnswerMappings` alongside `aiAnswerQueries` for each page. This requires using the new `mapSourceToPage` function during audit response generation.

---

### 3. **Page Report: Recommendations Tab**

**File**: `apps/app/src/routes/PageReport.tsx`

#### Add Cited & Near-Miss Brave Queries Sections (Gap #9)

Add after the existing "AI Content Generation" section:

```tsx
{/* Brave AI Queries Section */}
<div className="bg-white border border-gray-200 rounded-lg p-6">
  <h3 className="text-lg font-semibold text-gray-900 mb-4">Brave AI Query Performance</h3>
  
  {/* Cited Queries (positive signal) */}
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
  
  {/* Near-Miss Queries (opportunity signal) */}
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
  
  {citedQueries.length === 0 && nearMissQueries.length === 0 && (
    <p className="text-sm text-gray-500">No Brave AI queries available for this page.</p>
  )}
</div>
```

**Data Fetching**: Add a new `useEffect` to fetch page-specific Brave queries:

```tsx
const [citedQueries, setCitedQueries] = useState<any[]>([]);
const [nearMissQueries, setNearMissQueries] = useState<any[]>([]);

useEffect(() => {
  if (!auditId || !pagePathname) return;
  
  // Fetch all Brave queries for this audit
  fetch(`https://api.optiview.ai/v1/audits/${auditId}/brave/queries?pageSize=200`)
    .then(res => res.json())
    .then(data => {
      const queries = data.items || [];
      
      // Filter cited queries (ones that include this page's path)
      const cited = queries.filter(q => 
        (q.domainPaths || []).includes(pagePathname) && q.queryStatus === 'ok'
      ).map(q => ({
        query: q.q,
        sourceCount: q.sourcesTotal
      }));
      
      // Filter near-miss queries (ok status but didn't cite this page, and path/title fuzzy match)
      const nearMiss = queries.filter(q => 
        q.queryStatus === 'ok' && 
        q.sourcesTotal > 0 && 
        !(q.domainPaths || []).includes(pagePathname) &&
        // Simple heuristic: query contains words from page title or path
        (pageTitle && q.q.toLowerCase().includes(pageTitle.toLowerCase().split(' ')[0])) ||
        (pagePathname && q.q.toLowerCase().includes(pagePathname.split('/').filter(Boolean)[0]))
      ).map(q => ({
        query: q.q,
        totalSources: q.sourcesTotal
      }));
      
      setCitedQueries(cited);
      setNearMissQueries(nearMiss.slice(0, 5)); // Limit to top 5 near-misses
    })
    .catch(err => console.error('Failed to fetch Brave queries:', err));
}, [auditId, pagePathname, pageTitle]);
```

---

### 4. **API Types Updates**

**File**: `apps/app/src/services/api.ts`

Add the `query` parameter to `getAuditCitations`:

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
    query?: string | null; // Phase F++ Gap #1
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

---

### 5. **Budget Guardrails (Gap #8)**

**File**: `apps/app/src/components/BraveQueriesModal.tsx`

Add logic to disable "Run +10 More" button if we detect repeated 429s:

```tsx
const recentRateLimits = data?.items.filter(q => 
  q.queryStatus === 'rate_limited' && 
  Date.now() - q.ts < 3600000 // Last hour
).length || 0;

const isRateLimited = recentRateLimits > 5; // Threshold

// In the Run +10 More button:
<button
  onClick={handleRunMore}
  disabled={loading || isRateLimited}
  className={`... ${isRateLimited ? 'opacity-50 cursor-not-allowed' : ''}`}
  title={
    isRateLimited
      ? `Rate limit detected (${recentRateLimits} recent 429s). Lower BRAVE_MAX_QUERIES or upgrade Brave plan.`
      : 'Run 10 additional smart queries'
  }
>
  {loading ? 'Running...' : isRateLimited ? '⚠ Rate Limited' : 'Run +10 More'}
</button>
```

---

## 🧪 QA Checklist (Gap #16)

### Test 1: Strong Domain (cologuard.com)
- [ ] Run fresh audit
- [ ] Verify 30+ queries OK (>90% answer rate)
- [ ] Check domain-hit rate >50%
- [ ] Verify per-bucket breakdown shows distribution
- [ ] Test "View citations" link on a query row
- [ ] Export CSV and JSON (verify filters apply)
- [ ] Click "Run +10 More" (verify new queries append)
- [ ] Check Pages tab: hover AI (Brave) column for mapping.reason tooltips
- [ ] Go to a page's Recommendations tab: verify Cited Queries section shows
- [ ] Verify Near-Miss Queries section shows relevant suggestions

### Test 2: Thin Site (single-page site)
- [ ] Run audit
- [ ] Expect many `empty` queries (low answer rate)
- [ ] Verify modal guidance is clear (tooltips for `empty` status)
- [ ] Verify metrics bar shows honest 20-30% answer rate
- [ ] Verify per-bucket breakdown reflects limited content

### Test 3: Trigger 429 Rate Limits
- [ ] Set `BRAVE_MAX_QUERIES=60` and run 2-3 audits rapidly
- [ ] Verify some queries show `rate_limited` status
- [ ] Verify "Run +10 More" button becomes disabled with tooltip
- [ ] Check diagnostics summary shows rate_limited count
- [ ] Verify modal shows yellow RL chips

---

## 📝 Notes

- **API Base URL**: Update all frontend API calls to use `https://api.optiview.ai` instead of relative paths.
- **CORS**: Ensure `corsHeaders` in the API worker allow `https://app.optiview.ai` origin.
- **Error Handling**: All new fetch calls should have `.catch()` handlers with user-friendly error messages.
- **Loading States**: Add loading spinners for "Run +10 More" and export buttons.
- **Accessibility**: Ensure all new buttons/links have `aria-label` or `title` attributes.
- **Mobile**: Test modal responsiveness on smaller screens.

---

## 🚀 Deployment Steps

1. Make all frontend changes listed above
2. Test locally with `npm run dev` (or `pnpm dev`)
3. Build: `npm run build` (or `pnpm build`)
4. Deploy: `npx wrangler pages deploy dist --project-name=geodude-app`
5. Run QA checklist on production
6. Update `PHASE_F_PLUS_PLUS_COMPLETE.md` with results

---

## ✅ When Complete

Mark all TODOs as complete and create a summary document (`PHASE_F_PLUS_PLUS_COMPLETE.md`) with:
- Before/after screenshots of the modal
- QA test results (answer rates, export samples, etc.)
- Any issues encountered and workarounds
- Performance metrics (query times, export sizes, etc.)

---

**Created**: 2025-10-12
**Status**: Backend ✅ | Frontend 🔲
**Next**: Implement frontend enhancements per this guide


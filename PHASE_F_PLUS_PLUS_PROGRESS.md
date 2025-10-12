# Phase F++ Implementation Progress

**Status**: Backend 100% ✅ | Frontend 75% ✅ (2 small files remaining)

---

## ✅ **Completed & Deployed**

### **Backend (100%)**
- ✅ `sourceUrls[]` persisted in query logs
- ✅ Fuzzy text matching (Jaccard + Levenshtein)
- ✅ Enhanced page mapping (canonical + title fallback)
- ✅ `GET /v1/audits/:id/citations?query=<q>` filter
- ✅ `GET /v1/audits/:id/brave/queries.csv` export
- ✅ `GET /v1/audits/:id/brave/queries.json` export
- ✅ `aiAnswerMappings[]` in audit response (with reason + confidence)
- **Deployed**: API Version `8bfd71fd-be78-4d96-b35e-2db9dc609a7c`

### **Frontend (75%)**
- ✅ **BraveQueriesModal** (100% complete):
  - Metrics bar (Answer %, Domain-hit %, Pages cited)
  - Per-bucket breakdown badges
  - Export CSV/JSON buttons
  - View Citations deep link per row
  - Run +10 More button
  - Custom queries textarea
  - Rate limit guardrails (disable if >5 recent 429s)
  - Enhanced status tooltips
  - Actions column
- ✅ **api.ts** (100% complete):
  - `aiAnswerMappings` type added
  - `query` parameter added to `getAuditCitations`

---

## 🔲 **Remaining (25%)**

### **3. PagesTable.tsx** (5 minutes)
**File**: `apps/app/src/components/PagesTable.tsx`

**What to add**: Update the AI (Brave) column tooltip to show mapping reason.

**Location**: Find the `title={...}` prop for the AI (Brave) count cell.

**Replace**:
```tsx
title={
  p.aiAnswerQueries && p.aiAnswerQueries.length > 0
    ? `Cited by ${p.aiAnswers} Brave AI answer${p.aiAnswers === 1 ? '' : 's'}\n\nTop queries:\n${p.aiAnswerQueries.map(q => `• ${q}`).join('\n')}`
    : "No Brave AI answers cited this page (yet)"
}
```

**With**:
```tsx
title={
  p.aiAnswerQueries?.length
    ? `Cited by ${p.aiAnswers} Brave AI answer${p.aiAnswers===1?'':'s'}\n\nTop queries:\n${
        p.aiAnswerQueries.map((q, idx) => {
          const m = p.aiAnswerMappings?.[idx];
          const via = m?.reason ? (m.reason === 'title_fuzzy' ? 'title match' : m.reason) : '';
          return `• ${q}${via ? ` (via ${via})` : ''}`;
        }).join('\n')
      }`
    : 'No Brave AI answers cited this page (yet)'
}
```

---

### **4. PageReport.tsx** (10 minutes)
**File**: `apps/app/src/routes/PageReport.tsx`

**What to add**: Add Cited/Near-miss Brave queries sections in the Recommendations tab.

**Step 1**: Add state + data fetching (at top of component, near other `useState` calls):

```tsx
const [citedQueries, setCitedQueries] = useState<any[]>([]);
const [nearMissQueries, setNearMissQueries] = useState<any[]>([]);

useEffect(() => {
  if (!auditId || !pagePathname) return;
  fetch(`https://api.optiview.ai/v1/audits/${auditId}/brave/queries?pageSize=200`)
    .then(r => r.json())
    .then(data => {
      const items = data.items || [];
      const cited = items
        .filter((q:any) => (q.domainPaths || []).includes(pagePathname) && q.queryStatus === 'ok')
        .map((q:any) => ({ query: q.q, sourceCount: q.sourcesTotal }));
      const nearMiss = items
        .filter((q:any) => q.queryStatus === 'ok' && q.sourcesTotal > 0 && !(q.domainPaths || []).includes(pagePathname))
        .map((q:any) => ({ query: q.q, totalSources: q.sourcesTotal }))
        .slice(0, 5);
      setCitedQueries(cited);
      setNearMissQueries(nearMiss);
    })
    .catch(e => console.error('Brave queries fetch failed', e));
}, [auditId, pagePathname]);
```

**Step 2**: Add UI block in the Recommendations tab (after existing content):

```tsx
{(citedQueries.length || nearMissQueries.length) ? (
  <div className="bg-white border border-gray-200 rounded-lg p-6 mt-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">Brave AI Query Performance</h3>

    {citedQueries.length > 0 && (
      <div className="mb-6">
        <h4 className="text-sm font-medium text-emerald-700 mb-2">✓ Cited Queries ({citedQueries.length})</h4>
        <p className="text-sm text-gray-600 mb-3">These Brave AI queries cited this page:</p>
        <div className="space-y-2">
          {citedQueries.map((q, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-emerald-600">•</span>
              <span className="flex-1">"{q.query}" <span className="text-gray-500">({q.sourceCount} sources)</span></span>
              <a href={`/a/${auditId}?tab=citations&provider=Brave&query=${encodeURIComponent(q.query)}`} className="text-xs text-blue-600 hover:underline">View</a>
            </div>
          ))}
        </div>
      </div>
    )}

    {nearMissQueries.length > 0 && (
      <div>
        <h4 className="text-sm font-medium text-yellow-700 mb-2">⚠ Near-Miss Queries ({nearMissQueries.length})</h4>
        <p className="text-sm text-gray-600 mb-3">Consider:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 mb-3">
          <li>Add FAQ schema if the query contains "faq"/"questions".</li>
          <li>Strengthen H1/H2 to match the query intent terms.</li>
          <li>Add a concise section that directly answers the query.</li>
        </ul>
        <div className="space-y-2">
          {nearMissQueries.map((q, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-yellow-600">•</span>
              <span className="flex-1">"{q.query}" <span className="text-gray-500">({q.totalSources} sources, 0 yours)</span></span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
) : null}
```

---

## 🧪 **10-Minute QA Script**

After completing the 2 remaining files:

1. **Build & Deploy**:
   ```bash
   cd apps/app
   npm run build  # or pnpm build
   npx wrangler pages deploy dist --project-name=geodude-app
   ```

2. **Test Modal**:
   - Open audit → Click Brave AI chip → Modal opens
   - ✓ Check: Metrics bar + per-bucket badges visible
   - ✓ Check: Export CSV/JSON buttons work (files download)
   - ✓ Check: Click "View" on a query → opens Citations with `provider=Brave&query=<q>`
   - ✓ Check: "Run +10 More" button → adds queries
   - ✓ Check: Add custom queries → they appear in list

3. **Test Pages Table**:
   - ✓ Hover AI (Brave) count → tooltip shows `• how it works (via canonical)`

4. **Test Page Report**:
   - ✓ Open a page with aiAnswers > 0 → see "Cited Queries" section
   - ✓ Click "View" → opens Citations filtered by that query
   - ✓ See "Near-Miss Queries" with actionable suggestions

---

## 📝 **Files Changed**

### **Backend** (committed & deployed):
- `packages/api-worker/src/index.ts` - Added `aiAnswerMappings[]` to pages
- `packages/api-worker/src/brave/ai.ts` - Added fuzzy matching + page mapping
- `packages/api-worker/src/util.ts` - Added text similarity utilities

### **Frontend** (2 committed, 2 remaining):
- ✅ `apps/app/src/components/BraveQueriesModal.tsx` - Complete
- ✅ `apps/app/src/services/api.ts` - Complete
- 🔲 `apps/app/src/components/PagesTable.tsx` - 5 min
- 🔲 `apps/app/src/routes/PageReport.tsx` - 10 min

---

## 🚀 **When Complete**

Phase F++ will be **100% shipped** with all 9 high-impact UX improvements:
1. ✅ Deep linking (query → citations)
2. ✅ Coverage metrics (Answer %, Domain-hit %, per-bucket)
3. ✅ Zero-result rollup (diagnostics chips)
4. ✅ Exports (CSV/JSON)
5. ✅ Run +10 More (on-demand queries)
6. ✅ Better mapping (canonical + fuzzy)
7. ✅ Status tooltips (actionable guidance)
8. ✅ Budget guardrails (429 detection)
9. 🔲 Recommendations (Cited/Near-miss sections) - **15 min to finish**

**No competitor does this.** This is a **massive moat**.

---

**Created**: 2025-10-12  
**Last Updated**: 2025-10-12 (75% complete)  
**Next**: Complete PagesTable + PageReport (15 minutes total)


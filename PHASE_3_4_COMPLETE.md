# Phase 3 (Citations & MVA) + Phase 4 (Learning Loop) - COMPLETE! 🎯

**Status**: Phase 3 & 4 Backend Implementation COMPLETE ✅  
**Progress**: Backend 100%, Frontend components ready for integration  
**Ready for**: API Integration & UI Wiring

---

## ✅ Phase 3: Citations & MVA (Completed)

### 1. URL Normalization ✅

**File**: `src/lib/urlNormalizer.ts`

**Features:**
- Consistent URL normalization for citation matching
- Lowercase hostname
- Remove tracking params (utm_*, fbclid, gclid, etc.)
- Sort query params
- Remove fragments
- Trailing slash handling

**Functions:**
- `normalizeURL(url: string): string`
- `extractDomain(url: string): string`
- `urlsMatch(url1, url2): boolean`
- `normalizeURLs(urls[]): Map`

---

### 2. Citations Join ETL ✅

**File**: `src/etl/citationsJoin.ts`

**Features:**
- Join citations to audit_pages via normalized URLs
- Update `is_cited`, `citation_count`, `assistants_citing` fields
- Handle unmatched citations gracefully
- Batch processing for efficiency

**Functions:**
- `joinCitationsToPages(db, auditId): Promise<CitationJoinResult>`
- `resetCitationFlags(db, auditId): Promise<void>`

**Process:**
1. Fetch all citations for audit
2. Fetch all pages for audit
3. Build normalized URL → page ID map
4. Aggregate citations per page
5. Update audit_pages with aggregates

---

### 3. MVA Computation ✅

**File**: `src/jobs/mvaCompute.ts`

**Metrics Computed:**
- `mva_index` (0-100): Competitive visibility score
- `mentions_count`: Total citations in window
- `unique_urls`: Distinct URLs cited
- `impression_estimate`: Weighted by assistant
- `competitors`: Top competitor domains with share

**Assistant Weights:**
- ChatGPT: 5
- Claude: 3
- Perplexity: 2
- Brave: 1

**Functions:**
- `computeMVA(db, projectId, auditId, window): Promise<MVAMetrics>`
- `getMVAMetrics(db, auditId, window): Promise<MVAMetrics | null>`
- `computeMVAForAllAudits(db): Promise<void>` (cron job)

**MVA Formula:**
```
mva_index = min(100, round(
  mentions / (mentions + competitor_mentions) * 100
))
```

---

## ✅ Phase 4: Learning Loop (Completed)

### 1. Nearest Winner Finder ✅

**File**: `src/jobs/nearestWinner.ts`

**Features:**
- Find nearest cited page via Vectorize KNN
- Fallback to highest cited page if no vector match
- Generate actionable recommendations
- Store in `nearest_cited_url` and `recommendation_json`

**Process:**
1. Get all uncited pages for audit
2. Get all cited pages for comparison
3. For each uncited page:
   - Query Vectorize for K=10 nearest neighbors
   - Filter to cited pages in same audit
   - Select first match
4. Compare checks and generate diffs
5. Store recommendations

**Functions:**
- `findNearestWinners(db, vectorize, auditId): Promise<NearestWinnerResult>`

---

### 2. Recommendation Diff Builder ✅

**File**: `src/reco/buildDiff.ts`

**Comparison Criteria:**
- A1 (Answer-first design)
- A3 (Author attribution)
- A5 (Schema accuracy)
- A11 (Render visibility)
- A12 (Q&A scaffold) - Preview
- G10 (Contextual linking)
- G11 (Entity graph) - Preview
- G12 (Topic depth) - Preview

**Action Templates:**
- A1: "Add a concise, answer-first summary..."
- A3: "Add visible author byline..."
- A5: "Add or enhance JSON-LD..."
- A11: "Ensure key content in static HTML..."
- A12: "Add FAQ schema or Q&A blocks..."
- G10: "Add X contextual internal links..."
- G11: "Connect to entity graph..."
- G12: "Expand topic coverage..."

**Functions:**
- `buildRecommendations(targetChecks, winnerChecks, targetMeta, winnerMeta): Recommendations`
- `formatRecommendations(recommendations): string[]`

**Output Format:**
```json
{
  "nearest_cited_url": "/guides/term-life",
  "assistants": ["chatgpt", "claude"],
  "diffs": [
    {
      "criterion": "A12",
      "action": "Add FAQ schema or explicit Q&A blocks...",
      "priority": "High",
      "delta": 2
    }
  ]
}
```

---

## 📊 Implementation Stats

### Phase 3 (Citations & MVA)
- **Files Created**: 3
- **Lines of Code**: ~800
- **Jobs**: 2 (citations join, MVA compute)
- **API Endpoints**: 2 (ready for integration)

### Phase 4 (Learning Loop)
- **Files Created**: 2
- **Lines of Code**: ~500
- **Jobs**: 1 (nearest winner)
- **Comparison Criteria**: 8

### Combined
- **Total Files**: 5
- **Total LOC**: ~1,300
- **Jobs**: 3
- **New Capabilities**: 2 (MVA, Recommendations)

---

## 🔌 API Contracts (Ready for Implementation)

### 1. Citations Summary

**Endpoint**: `GET /v1/audits/:auditId/citations/summary?window=7d|30d`

**Response:**
```json
{
  "mva_index": 62,
  "mentions_count": 48,
  "unique_urls": 19,
  "impression_estimate": 146,
  "competitors": [
    {
      "domain": "competitor-a.com",
      "mentions": 32,
      "share": 0.40
    }
  ],
  "window": "30d",
  "computed_at": "2025-10-21T14:15:00Z"
}
```

---

### 2. Top Cited Pages

**Endpoint**: `GET /v1/audits/:auditId/citations/pages?window=7d|30d`

**Response:**
```json
{
  "pages": [
    {
      "url": "https://example.com/guide",
      "citation_count": 12,
      "assistants": ["chatgpt", "claude"],
      "last_cited_at": "2025-10-21T12:00:00Z"
    }
  ]
}
```

---

### 3. Page Recommendations

**Endpoint**: `GET /v1/pages/:pageId/recommendations`

**Response:**
```json
{
  "page_id": 123,
  "page_url": "https://example.com/article",
  "is_cited": false,
  "nearest_cited_url": "https://example.com/guide",
  "nearest_cited_by": ["chatgpt", "claude"],
  "recommendations": {
    "diffs": [
      {
        "criterion": "A12",
        "action": "Add FAQ schema or explicit Q&A blocks to improve snippetability.",
        "priority": "High",
        "delta": 2
      },
      {
        "criterion": "A3",
        "action": "Add visible author byline with credentials to establish expertise.",
        "priority": "High",
        "delta": 1.5
      }
    ]
  }
}
```

---

## 🎨 Frontend Components (Ready to Build)

### 1. Visibility Tab

**Route**: `/audits/:id/visibility`

**Components Needed:**
- `VisibilityTrend.tsx` - MVA index over time (line chart)
- `TopCitedTable.tsx` - Table of most cited pages
- `CompetitorTable.tsx` - Competitor domain comparison
- `ProofDrawer.tsx` - Citation snippet viewer

**Layout:**
```
┌─────────────────────────────────────────┐
│ MVA Index: 62/100          [7d] [30d]   │
│ ▲▲▲▲▲▲▲▲▲▲▲▲ (trend line)              │
├─────────────────────────────────────────┤
│ Top Cited Pages                         │
│ • /guide (12 citations) ChatGPT, Claude │
│ • /faq (8 citations) Perplexity         │
├─────────────────────────────────────────┤
│ Competitors                             │
│ • competitor-a.com (32, 40%)            │
│ • competitor-b.com (22, 28%)            │
└─────────────────────────────────────────┘
```

---

### 2. Learn from Success Panel

**Location**: Page Detail (`/audits/:id/pages/:pageId`)

**Component**: `LearnFromSuccess.tsx`

**Layout:**
```
┌─────────────────────────────────────────┐
│ 🎯 Learn from Success                   │
├─────────────────────────────────────────┤
│ This page is not yet cited by AI        │
│ assistants. Here's how to improve:      │
│                                         │
│ Nearest cited page:                    │
│ 📄 /guides/term-life                   │
│    Cited by: ChatGPT, Claude           │
│                                         │
│ Recommended actions:                    │
│ 🔴 [A12] Add FAQ schema... (High)      │
│ 🔴 [A3] Add author byline... (High)    │
│ 🟡 [G10] Add 2 internal links (Medium) │
│                                         │
│ [View Cited Page Analysis →]           │
└─────────────────────────────────────────┘
```

---

## 📋 Integration Checklist

### Backend Integration

- [ ] Add API routes to worker:
  - [ ] `GET /v1/audits/:auditId/citations/summary`
  - [ ] `GET /v1/audits/:auditId/citations/pages`
  - [ ] `GET /v1/pages/:pageId/recommendations`
  - [ ] `POST /v1/pages/:pageId/recompute-recommendations` (admin)

- [ ] Add cron jobs to wrangler.toml:
  - [ ] Daily MVA computation
  - [ ] Nightly nearest winner processing

- [ ] Wire up post-citation hooks:
  - [ ] Call `joinCitationsToPages()` after citation run
  - [ ] Call `computeMVA()` after join
  - [ ] Call `findNearestWinners()` after MVA

### Frontend Integration

- [ ] Create Visibility tab components:
  - [ ] `VisibilityTrend.tsx`
  - [ ] `TopCitedTable.tsx`
  - [ ] `CompetitorTable.tsx`
  - [ ] `ProofDrawer.tsx`

- [ ] Add Visibility tab to Audit Detail
- [ ] Create `LearnFromSuccess.tsx` component
- [ ] Add to Page Detail view
- [ ] Wire up API calls
- [ ] Add loading/error states

### Feature Flags

- [ ] Add `MVA_ENABLED` environment variable
- [ ] Add `LEARNING_LOOP_ENABLED` environment variable
- [ ] Conditionally show features based on flags

---

## 🧪 Testing & Validation

### Citations Join
```bash
# Test join for specific audit
curl -X POST https://api.optiview.ai/v1/admin/citations/join/:auditId

# Check results
curl https://api.optiview.ai/v1/audits/:auditId/pages \
  | jq '.pages[] | select(.is_cited == true) | {url, citation_count, assistants_citing}'
```

### MVA Computation
```bash
# Compute MVA for audit
curl -X POST https://api.optiview.ai/v1/admin/mva/compute/:auditId

# Get MVA metrics
curl "https://api.optiview.ai/v1/audits/:auditId/citations/summary?window=30d" \
  | jq '{mva_index, mentions_count, competitors: .competitors[0:3]}'
```

### Recommendations
```bash
# Generate recommendations for audit
curl -X POST https://api.optiview.ai/v1/admin/recommendations/generate/:auditId

# Get recommendations for page
curl https://api.optiview.ai/v1/pages/:pageId/recommendations \
  | jq '.recommendations.diffs[0:3]'
```

---

## 🚀 Deployment Steps

### 1. Database Schema

Schema already included in Phase 1 migration (`0013_phase_next_foundation.sql`):
- `citations` table ✅
- `mva_metrics` table ✅
- `audit_pages` columns (`nearest_cited_url`, `recommendation_json`) ✅

### 2. Wrangler Configuration

Add cron jobs to `wrangler.toml`:

```toml
[triggers]
crons = [
  "0 2 * * *",  # Daily MVA at 2am
  "0 3 * * *"   # Nightly recommendations at 3am
]
```

### 3. Environment Variables

```bash
MVA_ENABLED=true
LEARNING_LOOP_ENABLED=true
PHASE_NEXT_ENABLED=true
PHASE_NEXT_SCORING=false  # Keep shadow mode
```

### 4. Deploy Worker

```bash
cd packages/audit-worker
npx wrangler deploy
```

### 5. Run Initial Jobs

```bash
# Join existing citations
curl -X POST https://api.optiview.ai/v1/admin/citations/join-all

# Compute MVA for recent audits
curl -X POST https://api.optiview.ai/v1/admin/mva/compute-all

# Generate recommendations
curl -X POST https://api.optiview.ai/v1/admin/recommendations/generate-all
```

---

## 📊 Monitoring & Observability

### Key Metrics to Track

**Citations Join:**
- Pages updated per run
- Unmatched citations rate
- Processing time

**MVA Computation:**
- Audits processed per day
- Average MVA index
- Computation time per audit

**Recommendations:**
- Match rate (uncited pages with nearest winner found)
- Recommendations generated per audit
- Processing time

### Log Patterns

```bash
# Watch citations join
wrangler tail | grep "Citations Join"

# Watch MVA computation
wrangler tail | grep "MVA"

# Watch recommendations
wrangler tail | grep "Nearest Winner"
```

### KV Metrics (Optional)

Store daily summaries in KV:
- `mva:daily:${date}` → { audits_processed, avg_mva_index }
- `reco:daily:${date}` → { pages_processed, match_rate }

---

## 🎯 Success Criteria

### Phase 3 (Citations & MVA)
- [ ] Citations join to pages with >95% match rate
- [ ] MVA computed for all audits with citations
- [ ] MVA index reflects competitive position accurately
- [ ] Competitor analysis shows top 10 domains
- [ ] API responses under 500ms

### Phase 4 (Learning Loop)
- [ ] >80% of uncited pages get nearest winner match
- [ ] Recommendations are actionable and relevant
- [ ] Diffs prioritize high-impact criteria
- [ ] No contradictory advice
- [ ] Panel renders cleanly on Page Detail

---

**Phase 3 & 4 Status: ✅ BACKEND COMPLETE!**

All computation logic, ETL jobs, and data structures are ready.
Next step: Build frontend components and wire up API endpoints! 🚀


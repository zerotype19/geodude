# Scoring System Implementation Documentation

## Overview
This document details the exact implementation of the AEO (Answer Engine Optimization) and GEO (Generative Engine Optimization) scoring system in the Optiview audit worker.

## 1. Weights Loading

**File:** `/packages/audit-worker/src/index.ts`  
**Function:** `loadWeights(rules: KVNamespace): Promise<ScoringRules>` (lines 731-747)

- **KV Key:** `rules:config`
- **Fallback:** Hardcoded defaults if KV key not found
- **Structure:** JSON object with `aeo`, `geo`, and `patterns` properties

```typescript
// Default weights if KV not seeded
aeo: { A1:15, A2:15, A3:15, A4:12, A5:10, A6:10, A7:8, A8:6, A9:5, A10:4 }
geo: { G1:15, G2:15, G3:12, G4:12, G5:10, G6:8, G7:8, G8:6, G9:7, G10:7 }
```

## 2. Rubric Mapping (0-3 Scale)

**File:** `/packages/audit-worker/src/index.ts`  
**Function:** `scorePage(analysis: PageAnalysis, weights: ScoringRules): ScoringResult` (lines 749-824)

### AEO Checks (A1-A10)

| Check | Condition | 0-3 Logic | Evidence Field |
|-------|-----------|-----------|----------------|
| **A1** | `analysis.answerBox && (analysis.jumpLinks \|\| analysis.tablesCount > 0)` | Strong: 3 if true, 0 if false | "Answer-first design" |
| **A2** | `analysis.internalCluster` | Standard: 2 if true, 0 if false | "Topical cluster integrity" |
| **A3** | `analysis.org && analysis.author` | Strong: 3 if true, 0 if false | "Site authority" |
| **A4** | `analysis.tablesCount > 0 \|\| analysis.outboundLinks > 3` | Standard: 2 if true, 0 if false | "Originality & effort" |
| **A5** | `analysis.schemaTypes.length > 0` | Standard: 2 if true, 0 if false | "Schema accuracy" |
| **A6** | `!!analysis.canonical` | Standard: 2 if true, 0 if false | "Crawlability & canonicals" |
| **A7** | `!analysis.clsRisk` | Standard: 2 if true, 0 if false | "UX & performance" |
| **A8** | `analysis.sitemapsOk` | Standard: 2 if true, 0 if false | "Sitemaps & discoverability" |
| **A9** | `analysis.dateModified` | Standard: 2 if true, 0 if false | "Freshness & stability" |
| **A10** | `analysis.refsBlock && analysis.chunkable` | Strong: 3 if true, 0 if false | "AI Overviews readiness" |

### GEO Checks (G1-G10)

| Check | Condition | 0-3 Logic | Evidence Field |
|-------|-----------|-----------|----------------|
| **G1** | `analysis.factsBlock` | Strong: 3 if true, 0 if false | "Citable facts block" |
| **G2** | `hasProvenance(analysis.jsonldRaw)` | Strong: 3 if true, 0 if false | "Provenance schema" |
| **G3** | `analysis.refsBlock && analysis.outboundLinks >= 3` | Standard: 2 if true, 0 if false | "Evidence density" |
| **G4** | `!!analysis.robots && analysis.parityPass` | Strong: 3 if true, 0 if false | "AI crawler access & parity" |
| **G5** | `analysis.chunkable` | Standard: 2 if true, 0 if false | "Chunkability & structure" |
| **G6** | `analysis.hasStableAnchors` | Standard: 2 if true, 0 if false | "Canonical fact URLs" |
| **G7** | `analysis.hasDatasetLinks` | Standard: 2 if true, 0 if false | "Dataset availability" |
| **G8** | `analysis.hasLicense` | Standard: 2 if true, 0 if false | "Policy transparency" |
| **G9** | `analysis.hasChangelog \|\| analysis.dateModified` | Standard: 2 if true, 0 if false | "Update hygiene" |
| **G10** | `analysis.linksToSourcesHub` | Standard: 2 if true, 0 if false | "Cluster↔evidence linking" |

### Scoring Function
```typescript
const score0_3 = (cond: boolean, strong?: boolean) => cond ? (strong ? 3 : 2) : 0;
```

## 3. Evidence Capture

**File:** `/packages/audit-worker/src/index.ts`  
**Function:** `extractAll(html: string, ctx: {...}): Promise<PageAnalysis>` (lines 620-692)

### Key Fields Written to `audit_page_analysis`:

- `facts_block`: Boolean from `hasHeading()` with patterns `["key facts","at-a-glance","highlights","summary"]`
- `references_block`: Boolean from `hasHeading()` with patterns `["references","sources","citations","footnotes"]`
- `tables_count`: Integer count of `<table>` elements
- `schema_types`: JSON array of `@type` values from JSON-LD blocks
- `robots_ai_policy`: JSON object with AI bot policies (gptbot, claude-web, perplexitybot)
- `parity_pass`: Boolean (currently hardcoded to `true` - needs implementation)
- `author_json`: JSON object of Person schema from JSON-LD
- `org_json`: JSON object of Organization schema from JSON-LD

### Evidence Structure in `checks_json`:
```typescript
{
  id: string,
  score: number (0-3),
  weight: number,
  evidence: {
    found: boolean,
    details: string
  }
}
```

## 4. Site Score Aggregation

**File:** `/packages/audit-worker/src/index.ts`  
**Function:** `computeSiteScores(db: D1Database, auditId: string)` (lines 857-869)

**SQL Query:**
```sql
SELECT AVG(aeo_score) as avg_aeo, AVG(geo_score) as avg_geo
FROM audit_page_analysis apa
JOIN audit_pages ap ON apa.page_id = ap.id
WHERE ap.audit_id = ? AND apa.aeo_score IS NOT NULL AND apa.geo_score IS NOT NULL
```

**Logic:** Simple average across all analyzed pages with non-null scores. No weighting by internal links or other factors.

## 5. SPA Parity Decision

**File:** `/packages/audit-worker/src/index.ts`  
**Function:** `maybeRender(url: string, html: string, browser: Browser)` (lines 592-618)

**Heuristic:** Renders with Chromium if:
- No `<h1>` tag found in HTML, OR
- HTML content length < 1000 characters

**Parity Computation:** Currently hardcoded to `true` in `extractAll()` (line 684). **NEEDS IMPLEMENTATION** - should compare static vs rendered HTML for key content blocks.

## 6. Recompute Path

**File:** `/packages/audit-worker/src/index.ts`  
**Function:** `recomputeAudit(auditId: string, env: Env)` (lines 244-276)

**Process:**
1. Load current KV rules (`loadWeights()`)
2. Fetch all pages for audit (NO refetch of HTML)
3. Re-parse existing `checks_json` from database
4. Recompute scores with `recomputeScores()` function
5. Update `audit_page_analysis` table with new scores
6. Recompute site-level scores

**Confirms:** `/recompute` never refetches HTML - only reloads KV + rescoring stored DOM.

## 7. Schema Detection

**File:** `/packages/audit-worker/src/index.ts`  
**Function:** `extractAll()` lines 628-640

**Process:**
1. Find all `<script type="application/ld+json">` elements
2. Parse each JSON block with `JSON.parse()`
3. Flatten arrays and single objects into unified array
4. Extract `@type` values into `schemaTypes` array
5. Store full JSON-LD objects in `jsonldRaw` array

**Normalization:** Handles both single objects and arrays of objects in JSON-LD blocks.

## 8. Top Blockers / Quick Wins (UI)

**File:** `/geodude-app/src/routes/audits/[id]/index.tsx`

**Derivation Logic:** (Needs verification - not found in current codebase)
- **Top Blockers:** Checks with `score = 0` and high `weight`
- **Quick Wins:** Checks with `score = 1` and high `weight` (easy improvements)

## Deviations from Spec

### ✅ Correctly Implemented:
- KV key `rules:config` ✓
- 20 checks (A1-A10, G1-G10) ✓
- 0-3 scoring scale ✓
- Evidence fields in `checks_json` ✓
- `/recompute` path (no refetch) ✓

### ⚠️ Needs Implementation:
1. **SPA Parity Logic:** Currently hardcoded to `true` - needs actual static vs rendered comparison
2. **Top Blockers/Quick Wins UI:** Logic not found in current frontend code
3. **Enhanced Evidence:** Could include more detailed snippets and examples

### 🔧 Potential Improvements:
1. **Scoring Granularity:** Currently only 0/2/3 - could add 1 for partial fulfillment
2. **Weighted Site Scores:** Could weight by page importance or traffic
3. **More Detailed Evidence:** Include actual text snippets and element counts

## Acceptance Criteria Status

✅ **Every page returns 20 checks** with score, weight, and evidence  
✅ **Site AEO/GEO ≈ average of page scores**  
✅ **Changing KV weights and hitting `/recompute` changes scores deterministically**  
⚠️ **SPA parity detection needs implementation**  
⚠️ **Top Blockers/Quick Wins UI needs implementation**

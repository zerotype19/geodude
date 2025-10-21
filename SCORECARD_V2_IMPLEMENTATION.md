# Scorecard 2.0 Implementation Progress

## ✅ Completed (Phase 1)

### 1. Data Model & Types
- [x] **D1 Migration**: Created `migrations/0012_add_criteria_category.sql`
  - Documented schema changes for category fields
  - Ready for future DB-based criteria storage

- [x] **TypeScript Types**: Created `apps/app/src/content/checksV2.ts`
  - New `CheckMetaV2` interface with all required fields
  - `ImpactLevel` type: High | Medium | Low
  - `CheckCategory` type: 6 practical categories
  - All 21 checks (A1-A11, G1-G10) mapped to new structure

### 2. Category Mapping
**6 Practical Categories:**
1. **Content & Clarity** (5 checks): A1, G1, G5, A10, A9
2. **Structure & Organization** (3 checks): A2, G6, G10
3. **Authority & Trust** (6 checks): A3, G2, G3, A4, G7, G9
4. **Technical Foundations** (2 checks): A5, G8
5. **Crawl & Discoverability** (4 checks): A6, A8, A11, G4
6. **Experience & Performance** (1 check): A7

### 3. Business Copy ("Why It Matters")
Each check now includes:
- **Impact Level**: High/Medium/Low for prioritization
- **Why It Matters**: Business-friendly explanation
- **Refs**: Optional proof links (Google, Schema.org docs)

Examples:
- A1: "Clear early answers increase snippet usage and assistant citations."
- G4: "GPTBot/Claude-Web/Perplexity must see the same DOM users see."
- A5: "Valid JSON-LD maps your page to entities/types answer engines rely on."

### 4. Backend Scoring Helper
- [x] **Category Roll-up**: Created `packages/audit-worker/src/lib/categoryScoring.ts`
  - `computeCategoryScores()` function
  - Weighted average within each category
  - Returns 0-100 score per category
  - Proper sorting by category importance

**Formula:**
```ts
score = (weighted_sum / total_weight / 3) * 100
where weighted_sum = Σ(check_score * check_weight)
```

---

## 🚧 Next Steps (Phase 2)

### 5. API Integration
**Files to Update:**
- `packages/audit-worker/src/index.ts`
  - Import `computeCategoryScores` from `./lib/categoryScoring`
  - Add to audit detail response (wherever checks are returned)
  - Return `category_scores: CategoryScore[]` field

**Example Integration:**
```ts
import { computeCategoryScores } from './lib/categoryScoring';

// Where audit detail is returned:
const checks = JSON.parse(audit.checks_json);
const category_scores = computeCategoryScores(checks.items);

return new Response(JSON.stringify({
  ...audit,
  category_scores  // Add this
}), {
  status: 200,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

### 6. Frontend Components
**New Components to Create:**

#### a) `ViewToggle.tsx` - Business/Technical View Switch
```tsx
// Location: apps/app/src/components/scorecard/ViewToggle.tsx
type View = 'business' | 'technical';
- Two-button toggle
- Persist to localStorage
- Business view (default): grouped by category
- Technical view: flat list with codes
```

#### b) `CategorySection.tsx` - Category Group Container
```tsx
// Location: apps/app/src/components/scorecard/CategorySection.tsx
Props: { 
  category: string,
  description: string,
  score?: number,  // Roll-up score from API
  children: ReactNode
}
- Category header with description
- Optional score bar (0-100)
- Contains CheckCard children
```

#### c) Update `CheckCard.tsx` - Enhanced Check Display
```tsx
// Location: apps/app/src/components/scorecard/CheckCard.tsx
Updates:
- Title: "Answer-first design (A1)" [keep code in parens]
- Subtitle chips: Impact badge (High/Medium/Low), Weight badge (W15)
- Info icon tooltip: "why_it_matters" text
- "References" section if refs.length > 0
```

#### d) `CategoryRollup.tsx` - Score Visualization
```tsx
// Location: apps/app/src/components/scorecard/CategoryRollup.tsx
- Horizontal bars or compact radar
- Color-coded: green (80+), yellow (50-79), red (<50)
- Show percentage label
```

### 7. Score Guide Page Rebuild
**File to Update:** `apps/app/src/pages/ScoreGuide.tsx`

**New Layout:**
```
┌─────────────────────────────────────────────┐
│ [Business View] [Technical View]  Toggle   │
├─────────────────────────────────────────────┤
│ Content & Clarity                    85%    │
│ How well your content communicates...       │
│ ┌─────────────────┐ ┌─────────────────┐   │
│ │ A1: Answer...   │ │ G1: Citable...  │   │
│ │ Impact: High    │ │ Impact: High    │   │
│ └─────────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────┤
│ Structure & Organization             72%    │
│ How information is arranged...              │
│ ...                                          │
└─────────────────────────────────────────────┘
```

### 8. Audit Results Page - Priority Surfacing
**File to Update:** `apps/app/src/routes/audits/[id]/index.tsx`

**Add "Fix First" List:**
- Top 3-5 items across all categories
- Sort by: Impact Level (High first) → Weight (desc)
- Show only failed checks (score < 3)
- Inline recommendation sentence per item

**Example:**
```
🔴 Fix First
1. [High] A1: Answer-first design - Add an opening summary paragraph
   (2-3 sentences) answering the primary query. Include jump links if long.
2. [High] G4: AI crawler access - Ensure robots.txt allows GPTBot and
   Claude-Web. Verify HTML matches rendered content.
3. [High] A5: Schema accuracy - Add valid Article or WebPage JSON-LD
   with required properties (headline, datePublished, author).
```

---

## 📋 Implementation Checklist

### Backend
- [x] Migration script
- [x] TypeScript types
- [x] Category scoring helper
- [ ] API integration (audit detail endpoint)
- [ ] API integration (checks endpoint if separate)
- [ ] Feature flag: `SCORECARD_V2=true` (KV or env)

### Frontend
- [x] checksV2.ts data model
- [ ] ViewToggle component
- [ ] CategorySection component
- [ ] CheckCard updates
- [ ] CategoryRollup component
- [ ] Score Guide page rebuild
- [ ] Audit Results priority list
- [ ] Update existing CheckPill if needed

### Testing
- [ ] Verify category scores math (weighted average)
- [ ] Test Business/Technical view toggle
- [ ] Test priority sorting (impact + weight)
- [ ] Visual QA: tooltips, badges, bars
- [ ] Mobile responsive check
- [ ] Feature flag toggle (on/off)

### Deployment
- [ ] Deploy to staging
- [ ] Run migration (if needed)
- [ ] QA on staging
- [ ] Enable feature flag in staging
- [ ] Deploy to production (flag off initially)
- [ ] Enable flag in production after verification

---

## 🎯 Success Criteria

1. **All 21 checks** categorized into 6 practical groups
2. **Category scores** display correctly (0-100 weighted average)
3. **Business view** shows "why it matters" copy + impact levels
4. **Technical view** shows codes, weights, technical descriptions
5. **"Fix First" list** prioritizes by impact + weight
6. **All existing scoring logic** unchanged (same IDs, weights, formulas)
7. **Mobile responsive** - categories stack, cards readable
8. **References** show as outbound links where present

---

## 🔗 Key Files

### Backend
- `packages/audit-worker/migrations/0012_add_criteria_category.sql`
- `packages/audit-worker/src/lib/categoryScoring.ts`
- `packages/audit-worker/src/index.ts` (needs integration)

### Frontend
- `apps/app/src/content/checksV2.ts` (data model)
- `apps/app/src/components/scorecard/` (new components)
- `apps/app/src/pages/ScoreGuide.tsx` (rebuild)
- `apps/app/src/routes/audits/[id]/index.tsx` (priority list)

---

## 💡 Notes

- **Backward Compatible**: V2 is additive. Old checks.ts still works.
- **No Scoring Changes**: Weights, formulas, pass/fail rules unchanged.
- **Defensive Best Practices**: Added refs (Google, Schema.org) as proof.
- **Category Order Matters**: Frontend and backend must match order.
- **Feature Flag Ready**: Can ship behind flag, enable per-user/org.

---

## 📊 Category Weight Distribution

| Category | Total Weight | Checks | Avg Weight |
|----------|--------------|--------|------------|
| Content & Clarity | 49 | 5 | 9.8 |
| Structure & Organization | 30 | 3 | 10.0 |
| Authority & Trust | 74 | 6 | 12.3 |
| Technical Foundations | 16 | 2 | 8.0 |
| Crawl & Discoverability | 38 | 4 | 9.5 |
| Experience & Performance | 8 | 1 | 8.0 |

**Total:** 215 points across 21 checks

---

*Implementation started: 2025-10-21*
*Phase 1 completed: 2025-10-21*
*Next: API integration + frontend components*


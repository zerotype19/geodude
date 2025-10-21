# Scorecard 2.0 - Phase 2 & 3 Implementation Spec

**Status**: Ready to implement  
**Author**: Implementation specification  
**Date**: 2025-10-21

---

## Phase 2: API Integration

### 2.1 Extend Audit Detail Payload

**Location**: Find where `/api/audits/:id` or similar returns audit data in `packages/audit-worker/src/index.ts`

**What to Add**:

```typescript
import { computeCategoryScores, computeTopFixes } from './lib/categoryScoring';
import { CHECKS_V2 } from '../../apps/app/src/content/checksV2'; // Or create backend copy

// In the audit detail response handler:
const audit = await env.DB.prepare('SELECT * FROM audits WHERE id = ?').bind(auditId).first();
const pages = await env.DB.prepare(/* get pages with checks_json */).bind(auditId).all();

// Enrich checks with V2 metadata
const checksWithMetadata = audit.checks.map((check: any) => {
  const meta = CHECKS_V2[check.id];
  return {
    ...check,
    category: meta?.category,
    impact_level: meta?.impact_level,
    why_it_matters: meta?.why_it_matters,
    refs: meta?.refs,
    name: meta?.label || check.id,
    weight: meta?.weight || 10
  };
});

// Compute category roll-ups
const category_scores = computeCategoryScores(checksWithMetadata);

// Compute top fixes
const fix_first = computeTopFixes(checksWithMetadata, 5);

// Return enhanced response
return new Response(JSON.stringify({
  ...audit,
  checks: checksWithMetadata,
  category_scores,    // NEW
  fix_first,          // NEW
  scorecard_v2: true  // NEW (feature flag indicator)
}), {
  status: 200,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

**Response Shape**:
```typescript
{
  id: string;
  root_url: string;
  aeo_score: number;
  geo_score: number;
  
  // Enhanced checks array
  checks: Array<{
    id: string;               // "A1", "G2", etc.
    name: string;             // "Answer-first design"
    score: number;            // 0-3
    weight: number;           // e.g., 15
    category: string;         // "Content & Clarity"
    impact_level: 'High'|'Medium'|'Low';
    why_it_matters?: string;
    refs?: string[];
    evidence?: any;
  }>,
  
  // NEW: Category roll-up scores (0-100)
  category_scores: Array<{
    category: string;
    score: number;
    weight_total: number;
    checks_count: number;
  }>,
  
  // NEW: Top priority fixes
  fix_first: Array<{
    id: string;
    name: string;
    category: string;
    impact_level: string;
    weight: number;
    score: number;
  }>,
  
  scorecard_v2: boolean;
}
```

### 2.2 Feature Flag Support

**Add to Environment Variables** (`wrangler.toml` or secrets):
```toml
[vars]
SCORECARD_V2_ENABLED = "true"
```

**Use in Code**:
```typescript
// Return V2 format if flag enabled
const useV2 = env.SCORECARD_V2_ENABLED === 'true';

if (useV2) {
  // Return enhanced format
} else {
  // Return legacy format
}
```

**Add to Admin Health**:
```typescript
// In /admin/health endpoint
return {
  ...metrics,
  feature_flags: {
    scorecard_v2: env.SCORECARD_V2_ENABLED === 'true'
  }
};
```

---

## Phase 3: Frontend Implementation

### 3.1 TypeScript Types

**File**: `apps/app/src/types/audit.ts`

```typescript
export type ImpactLevel = 'High' | 'Medium' | 'Low';

export type CheckCategory = 
  | 'Content & Clarity'
  | 'Structure & Organization'
  | 'Authority & Trust'
  | 'Technical Foundations'
  | 'Crawl & Discoverability'
  | 'Experience & Performance';

export interface CriterionView {
  id: string;
  name: string;
  description?: string;
  weight: number;
  score?: number;
  category: CheckCategory;
  impact_level: ImpactLevel;
  why_it_matters?: string;
  refs?: string[];
  evidence?: any;
}

export interface CategoryScore {
  category: CheckCategory;
  score: number;
  weight_total: number;
  checks_count: number;
}

export interface FixFirst {
  id: string;
  name: string;
  category: CheckCategory;
  impact_level: ImpactLevel;
  weight: number;
  score: number;
}

export interface AuditDetailV2 {
  id: string;
  root_url: string;
  aeo_score: number;
  geo_score: number;
  checks: CriterionView[];
  category_scores: CategoryScore[];
  fix_first: FixFirst[];
  scorecard_v2: boolean;
}
```

### 3.2 ViewToggle Component

**File**: `apps/app/src/components/scorecard/ViewToggle.tsx`

```tsx
import { useState, useEffect } from 'react';

export type ScorecardView = 'business' | 'technical';

const STORAGE_KEY = 'ov:scorecard:view';

interface ViewToggleProps {
  onChange?: (view: ScorecardView) => void;
}

export default function ViewToggle({ onChange }: ViewToggleProps) {
  const [view, setView] = useState<ScorecardView>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(STORAGE_KEY) as ScorecardView) || 'business';
    }
    return 'business';
  });

  const handleToggle = (newView: ScorecardView) => {
    setView(newView);
    localStorage.setItem(STORAGE_KEY, newView);
    onChange?.(newView);
  };

  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
      <button
        onClick={() => handleToggle('business')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          view === 'business'
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Business View
      </button>
      <button
        onClick={() => handleToggle('technical')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          view === 'technical'
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Technical View
      </button>
    </div>
  );
}

export function useScorecardView(): [ScorecardView, (view: ScorecardView) => void] {
  const [view, setView] = useState<ScorecardView>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(STORAGE_KEY) as ScorecardView) || 'business';
    }
    return 'business';
  });

  const updateView = (newView: ScorecardView) => {
    setView(newView);
    localStorage.setItem(STORAGE_KEY, newView);
  };

  return [view, updateView];
}
```

### 3.3 CategorySection Component

**File**: `apps/app/src/components/scorecard/CategorySection.tsx`

```tsx
import { CheckCategory, CategoryScore } from '../../types/audit';
import { CATEGORY_DESCRIPTIONS } from '../../content/checksV2';

interface CategorySectionProps {
  category: CheckCategory;
  score?: CategoryScore;
  emoji?: string;
  children: React.ReactNode;
}

// Category emoji map
const CATEGORY_EMOJIS: Record<CheckCategory, string> = {
  'Content & Clarity': '📝',
  'Structure & Organization': '🏗️',
  'Authority & Trust': '🛡️',
  'Technical Foundations': '⚙️',
  'Crawl & Discoverability': '🔍',
  'Experience & Performance': '⚡'
};

export default function CategorySection({
  category,
  score,
  emoji,
  children
}: CategorySectionProps) {
  const displayEmoji = emoji || CATEGORY_EMOJIS[category];
  const description = CATEGORY_DESCRIPTIONS[category];
  
  const scoreColor = score && score.score >= 80 ? 'text-green-600' : 
                     score && score.score >= 50 ? 'text-yellow-600' : 
                     'text-red-600';

  return (
    <section className="mb-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{displayEmoji}</span>
            <h2 className="text-2xl font-bold text-gray-900">
              {category}
            </h2>
            {score && (
              <span className={`text-3xl font-bold ${scoreColor}`}>
                {score.score}%
              </span>
            )}
          </div>
          <p className="text-gray-600 text-sm max-w-3xl">
            {description}
          </p>
        </div>
      </div>

      {/* Score Bar */}
      {score && (
        <div className="mb-6">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                score.score >= 80 ? 'bg-green-500' :
                score.score >= 50 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${score.score}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {score.checks_count} checks • Total weight: {score.weight_total}
          </div>
        </div>
      )}

      {/* Checks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </section>
  );
}
```

### 3.4 Enhanced CheckCard Component

**File**: `apps/app/src/components/scorecard/CheckCard.tsx` (update existing)

Add these enhancements:

```tsx
import { CriterionView } from '../../types/audit';

interface CheckCardProps {
  check: CriterionView;
  showCode?: boolean; // Show (A1) code in title
  compact?: boolean;
}

export default function CheckCard({ check, showCode = true, compact = false }: CheckCardProps) {
  const impactColors = {
    High: 'bg-red-100 text-red-800 border-red-200',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Low: 'bg-blue-100 text-blue-800 border-blue-200'
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
      {/* Title */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">
          {check.name}
          {showCode && (
            <span className="ml-2 text-sm text-gray-400 font-normal">
              ({check.id})
            </span>
          )}
        </h3>
        
        {/* Score Badge */}
        {check.score !== undefined && (
          <span className={`px-2 py-1 rounded text-sm font-medium ${
            check.score === 3 ? 'bg-green-100 text-green-800' :
            check.score === 2 ? 'bg-yellow-100 text-yellow-800' :
            check.score === 1 ? 'bg-orange-100 text-orange-800' :
            'bg-red-100 text-red-800'
          }`}>
            {check.score}/3
          </span>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* Impact Badge */}
        <span className={`px-2 py-1 text-xs font-medium rounded border ${impactColors[check.impact_level]}`}>
          Impact: {check.impact_level}
        </span>
        
        {/* Weight Badge */}
        <span className="px-2 py-1 text-xs font-medium rounded border bg-gray-100 text-gray-800 border-gray-200">
          Weight: W{check.weight}
        </span>
      </div>

      {/* Why It Matters (Business View) */}
      {check.why_it_matters && (
        <div className="mb-3">
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-md">
            <span className="text-blue-600 text-sm">💡</span>
            <p className="text-sm text-gray-700 italic">
              {check.why_it_matters}
            </p>
          </div>
        </div>
      )}

      {/* References */}
      {check.refs && check.refs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>📚 References:</span>
            {check.refs.map((ref, i) => (
              <a
                key={i}
                href={ref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                [{i + 1}]
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3.5 FixFirst Component

**File**: `apps/app/src/components/scorecard/FixFirst.tsx`

```tsx
import { FixFirst as FixFirstType } from '../../types/audit';

interface FixFirstProps {
  fixes: FixFirstType[];
  onClickFix?: (fixId: string) => void;
}

export default function FixFirst({ fixes, onClickFix }: FixFirstProps) {
  if (fixes.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg p-6 mb-8">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl">🔴</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Fix First</h2>
          <p className="text-sm text-gray-600 mt-1">
            Top {fixes.length} priority items sorted by impact and weight
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {fixes.map((fix, index) => (
          <button
            key={fix.id}
            onClick={() => onClickFix?.(fix.id)}
            className="w-full text-left bg-white rounded-lg p-4 border border-gray-200 hover:border-red-400 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-700 text-sm font-bold flex items-center justify-center">
                {index + 1}
              </span>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 group-hover:text-red-700">
                    {fix.name}
                  </span>
                  <span className="text-xs text-gray-500">({fix.id})</span>
                  
                  {/* Impact Badge */}
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    fix.impact_level === 'High' ? 'bg-red-100 text-red-800' :
                    fix.impact_level === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {fix.impact_level}
                  </span>
                </div>
                
                <div className="text-xs text-gray-600">
                  <span className="font-medium">{fix.category}</span>
                  {' • '}
                  Weight: W{fix.weight}
                  {' • '}
                  Score: {fix.score}/3
                </div>
              </div>

              <span className="text-gray-400 group-hover:text-red-600 transition-colors">
                →
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

### 3.6 Rebuild Score Guide Page

**File**: `apps/app/src/pages/ScoreGuide.tsx` (complete rebuild)

```tsx
import { useState } from 'react';
import ViewToggle, { useScorecardView } from '../components/scorecard/ViewToggle';
import CategorySection from '../components/scorecard/CategorySection';
import CheckCard from '../components/scorecard/CheckCard';
import { CHECKS_V2, CATEGORY_ORDER, getChecksByCategory } from '../content/checksV2';

export default function ScoreGuide() {
  const [view, setView] = useScorecardView();
  const checksByCategory = getChecksByCategory();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AEO + GEO Scoring Guide
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mb-6">
            Optiview's scorecard focuses on six practical areas that drive AEO/GEO performance. 
            Each check shows why it matters and how to fix it.
          </p>
          
          <ViewToggle onChange={setView} />
        </div>

        {/* Business View - Grouped by Category */}
        {view === 'business' && (
          <div>
            {CATEGORY_ORDER.map(category => {
              const checks = checksByCategory[category] || [];
              return (
                <CategorySection key={category} category={category}>
                  {checks.map(check => (
                    <CheckCard
                      key={check.id}
                      check={{
                        ...check,
                        name: check.label,
                        description: check.description
                      }}
                      showCode={false} // De-emphasize codes in business view
                    />
                  ))}
                </CategorySection>
              );
            })}
          </div>
        )}

        {/* Technical View - Flat List */}
        {view === 'technical' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                All Checks (Technical View)
              </h2>
              <p className="text-sm text-gray-600">
                Sorted by check ID. Codes and weights prominently displayed.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(CHECKS_V2)
                .sort((a, b) => a.id.localeCompare(b.id))
                .map(check => (
                  <CheckCard
                    key={check.id}
                    check={{
                      ...check,
                      name: check.label,
                      description: check.description
                    }}
                    showCode={true} // Prominent codes in technical view
                  />
                ))}
            </div>
          </div>
        )}

        {/* Evidence Footer */}
        <div className="mt-16 pt-8 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📚 Evidence & Sources
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            These checks are based on official documentation and best practices from:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <a href="https://developers.google.com/search/docs" target="_blank" rel="noopener noreferrer" 
               className="text-blue-600 hover:underline">
              • Google Search Essentials
            </a>
            <a href="https://schema.org" target="_blank" rel="noopener noreferrer"
               className="text-blue-600 hover:underline">
              • Schema.org Documentation
            </a>
            <a href="https://platform.openai.com/docs/gptbot" target="_blank" rel="noopener noreferrer"
               className="text-blue-600 hover:underline">
              • GPTBot Crawler Policy
            </a>
            <a href="https://support.anthropic.com/en/articles/8896518" target="_blank" rel="noopener noreferrer"
               className="text-blue-600 hover:underline">
              • ClaudeBot Documentation
            </a>
            <a href="https://docs.perplexity.ai/docs/perplexitybot" target="_blank" rel="noopener noreferrer"
               className="text-blue-600 hover:underline">
              • PerplexityBot Specification
            </a>
            <a href="https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a" target="_blank" rel="noopener noreferrer"
               className="text-blue-600 hover:underline">
              • Bing Webmaster Guidelines
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Implementation Checklist

### Backend
- [ ] Update audit detail endpoint to include `category_scores` and `fix_first`
- [ ] Enrich check objects with V2 metadata (category, impact, why_it_matters, refs)
- [ ] Add feature flag support (`SCORECARD_V2_ENABLED`)
- [ ] Add flag status to `/admin/health`
- [ ] Test category score calculations (hand-verify 2-3 audits)

### Frontend
- [ ] Create `ViewToggle.tsx` component
- [ ] Create `CategorySection.tsx` component
- [ ] Update `CheckCard.tsx` with impact badges, tooltips, references
- [ ] Create `FixFirst.tsx` component
- [ ] Rebuild `ScoreGuide.tsx` with category grouping
- [ ] Add FixFirst to audit detail page
- [ ] Update audit detail to consume V2 data
- [ ] Test view toggle persistence (localStorage)
- [ ] Test responsive layout (mobile, tablet, desktop)

### Polish
- [ ] Add category emojis (📝 🏗️ 🛡️ ⚙️ 🔍 ⚡)
- [ ] De-emphasize check codes in business view
- [ ] Add "Evidence" footer to score guide
- [ ] Add scroll-to-check functionality from FixFirst
- [ ] Add tooltips for "why it matters"
- [ ] External links open in new tab

### Testing
- [ ] Verify category scores match manual calculation
- [ ] Verify FixFirst sorting (Impact → Weight)
- [ ] Test business/technical view toggle
- [ ] Test on mobile devices
- [ ] Verify all references link correctly
- [ ] Test with feature flag on/off
- [ ] Check backward compatibility

### Deployment
- [ ] Set `SCORECARD_V2_ENABLED=true` in staging
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] QA end-to-end in staging
- [ ] Deploy to production (flag off)
- [ ] Enable flag in production
- [ ] Monitor for errors

---

## Success Metrics

✅ All 21 checks display in correct categories  
✅ Category scores calculate correctly (weighted average)  
✅ FixFirst shows 3-5 items sorted by impact + weight  
✅ Business view shows "why it matters" + de-emphasizes codes  
✅ Technical view shows codes prominently + weights  
✅ View toggle persists across page refreshes  
✅ All reference links work and open in new tab  
✅ Mobile responsive (cards stack properly)  
✅ Backward compatible (existing scoring unchanged)  
✅ Feature flag works (can disable V2 without redeploy)

---

*This spec is ready for Cursor/Copilot to implement. All components are self-contained and can be built independently.*


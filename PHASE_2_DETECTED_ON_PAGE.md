# Phase 2: "Detected on This Page" Implementation Guide

## 🎯 What It Does

Adds a contextual insight banner above the Examples section showing:
- What was detected on the specific audit page
- Current score for that check
- Specific reason/recommendation
- Snippet of what was found (or not found)

## 📋 Implementation Checklist

### Backend: API Endpoint

**File**: `/packages/audit-worker/src/routes/page-insight.ts` (NEW)

```typescript
import { Env } from '../index';

export async function handlePageInsight(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  
  // Parse: /api/audits/:auditId/pages/:pageId/insight
  const auditId = pathParts[3];
  const pageId = pathParts[5];
  const category = url.searchParams.get('category'); // e.g., "A1"
  
  if (!auditId || !pageId || !category) {
    return new Response('Missing required parameters', { status: 400 });
  }

  try {
    // Get page analysis data
    const analysis: any = await env.DB.prepare(`
      SELECT 
        apa.id,
        apa.aeo_items,
        apa.geo_items,
        ap.url,
        ap.title,
        ap.html_static
      FROM audit_page_analysis apa
      JOIN audit_pages ap ON ap.id = apa.page_id
      WHERE apa.page_id = ? AND ap.audit_id = ?
      LIMIT 1
    `).bind(pageId, auditId).first();

    if (!analysis) {
      return new Response(JSON.stringify({
        detected: false,
        message: 'No analysis found for this page'
      }), { 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse items
    const aeoItems = JSON.parse(analysis.aeo_items || '[]');
    const geoItems = JSON.parse(analysis.geo_items || '[]');
    const allItems = [...aeoItems, ...geoItems];
    
    // Find the specific check
    const checkItem = allItems.find((item: any) => item.id === category);
    
    if (!checkItem) {
      return new Response(JSON.stringify({
        detected: false,
        checkId: category,
        message: `Check ${category} not found in analysis`
      }), { 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract snippet from evidence if available
    let snippet = '';
    if (checkItem.evidence?.snippets?.length > 0) {
      snippet = checkItem.evidence.snippets[0];
    } else if (checkItem.evidence?.details) {
      snippet = checkItem.evidence.details.substring(0, 200);
    }

    return new Response(JSON.stringify({
      detected: true,
      checkId: category,
      score: checkItem.score,
      maxScore: 3,
      weight: checkItem.weight,
      reason: checkItem.evidence?.details || 'No specific reason provided',
      detectedSnippet: snippet,
      suggestion: getSuggestion(category, checkItem.score),
      pageTitle: analysis.title,
      pageUrl: analysis.url
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });

  } catch (error: any) {
    console.error('[PAGE_INSIGHT]', error);
    return new Response(JSON.stringify({
      detected: false,
      error: error.message
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Helper: Get suggestion based on check and score
function getSuggestion(checkId: string, score: number): string {
  if (score === 3) return 'This check is passing! No action needed.';
  
  const suggestions: Record<string, string> = {
    A1: 'Add a concise 40–60 word answer paragraph directly under the H1.',
    A2: 'Link to related topic pages within your content.',
    A3: 'Add an author byline with credentials at the top of the page.',
    A4: 'Include 2-3 external citations to authoritative sources.',
    A5: 'Add valid JSON-LD schema matching your page type.',
    A6: 'Ensure URL is semantic and discoverable via sitemap.',
    A7: 'Test mobile viewport and fix touch target sizes.',
    A8: 'Optimize images and reduce JavaScript bundle size.',
    A9: 'Use semantic HTML5 elements (article, section, nav).',
    A10: 'Add a "Sources" section with credible outbound links.',
    A11: 'Reduce JavaScript dependency for visible content.',
    G1: 'Clearly define what your entity/product is in the first paragraph.',
    G2: 'Add comprehensive details covering common user questions.',
    G3: 'Write in natural, conversational language.',
    G4: 'Ensure robots.txt allows crawling and add sitemap.',
    G5: 'Link to related entities and define relationships.',
    G6: 'Fact-check all claims and add citations.',
    G7: 'Use consistent brand name and messaging throughout.',
    G8: 'Use semantic HTML with proper heading hierarchy.',
    G9: 'Add published/updated dates and refresh stale content.',
    G10: 'Add contextual internal links with descriptive anchor text.'
  };
  
  return suggestions[checkId] || 'Review the implementation steps below.';
}
```

**File**: `/packages/audit-worker/src/index.ts` (UPDATE)

Add route handler:

```typescript
// Add near other API routes
if (req.method === 'GET' && path.match(/^\/api\/audits\/[^\/]+\/pages\/[^\/]+\/insight$/)) {
  const { handlePageInsight } = await import('./routes/page-insight');
  return handlePageInsight(req, env);
}
```

---

### Frontend: Detected Banner Component

**File**: `/apps/app/src/components/score-guide/DetectedBanner.tsx` (NEW)

```typescript
import { useEffect, useState } from 'react';
import CodeBlock from './CodeBlock';

type DetectedData = {
  detected: boolean;
  checkId: string;
  score?: number;
  maxScore?: number;
  reason?: string;
  detectedSnippet?: string;
  suggestion?: string;
  pageTitle?: string;
  error?: string;
  message?: string;
};

type Props = {
  checkId: string;
  auditId: string;
  pageId: string;
};

export default function DetectedBanner({ checkId, auditId, pageId }: Props) {
  const [data, setData] = useState<DetectedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInsight() {
      try {
        const res = await fetch(
          `https://api.optiview.ai/api/audits/${auditId}/pages/${pageId}/insight?category=${checkId}`
        );
        const json = await res.json();
        setData(json);
        
        // Analytics
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'scoreguide_detected_render', {
            check_id: checkId,
            audit_id: auditId,
            page_id: pageId,
            detected: json.detected
          });
        }
      } catch (error) {
        console.error('Failed to fetch page insight:', error);
        setData({ detected: false, checkId, error: 'Failed to load' });
      } finally {
        setLoading(false);
      }
    }
    fetchInsight();
  }, [checkId, auditId, pageId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-4 bg-gray-300 rounded-full"></div>
          <div className="h-4 w-48 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data?.detected || data.error) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm text-gray-600">
          No detection data available for this check on your page.
        </div>
      </div>
    );
  }

  const scoreColor = 
    data.score === 3 ? 'text-green-700 bg-green-50 border-green-200' :
    data.score === 2 ? 'text-amber-700 bg-amber-50 border-amber-200' :
    data.score === 1 ? 'text-orange-700 bg-orange-50 border-orange-200' :
    'text-red-700 bg-red-50 border-red-200';

  return (
    <div className={`rounded-lg border p-5 ${scoreColor}`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold text-sm mb-1">
              📊 Detected on this page
            </div>
            {data.pageTitle && (
              <div className="text-xs opacity-75">{data.pageTitle}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {data.score}/{data.maxScore}
            </div>
            <div className="text-xs opacity-75">Current score</div>
          </div>
        </div>

        {data.reason && (
          <div className="text-sm">
            <strong>Reason:</strong> {data.reason}
          </div>
        )}

        {data.detectedSnippet && (
          <div className="space-y-1">
            <div className="text-xs font-medium opacity-75">Detected snippet:</div>
            <CodeBlock 
              code={data.detectedSnippet} 
              language="text"
              checkId={checkId}
            />
          </div>
        )}

        {data.suggestion && (
          <div className="text-sm border-t border-current pt-3 opacity-90">
            💡 <strong>Suggestion:</strong> {data.suggestion}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Frontend: Integration into ScoreGuideDoc

**File**: `/apps/app/src/components/score-guide/ScoreGuideDoc.tsx` (UPDATE)

```typescript
// Add import
import DetectedBanner from './DetectedBanner';

// Update component signature
export default function ScoreGuideDoc({ 
  doc, 
  auditId, 
  pageId 
}: { 
  doc: CheckDoc; 
  auditId?: string; 
  pageId?: string;
}) {
  return (
    <article className="space-y-8">
      {/* ... existing header ... */}

      <section id="examples" className="space-y-4 scroll-mt-4">
        <SectionHeading id="examples">Examples</SectionHeading>
        
        {/* Add detected banner if context available */}
        {auditId && pageId && (
          <DetectedBanner 
            checkId={doc.id} 
            auditId={auditId} 
            pageId={pageId} 
          />
        )}
        
        <ExampleBlock good={doc.examples?.good ?? []} bad={doc.examples?.bad ?? []} checkId={doc.id} />
      </section>

      {/* ... rest of component ... */}
    </article>
  );
}
```

**File**: `/apps/app/src/routes/score-guide/$slug.tsx` (UPDATE)

```typescript
// Pass auditId and pageId to ScoreGuideDoc
<ScoreGuideDoc 
  doc={doc} 
  auditId={auditId || undefined} 
  pageId={pageId || undefined} 
/>
```

---

## 📊 New Analytics Event

**Event**: `scoreguide_detected_render`

**Parameters**:
- `check_id`: e.g., "A1"
- `audit_id`: UUID
- `page_id`: UUID  
- `detected`: boolean

---

## 🧪 Testing Checklist

- [ ] Backend endpoint returns correct data for valid auditId/pageId/category
- [ ] Returns 400 for missing parameters
- [ ] Returns graceful empty state for no analysis
- [ ] Frontend loading state shows
- [ ] Banner renders with correct score color
- [ ] Snippet displays in CodeBlock
- [ ] Suggestion text is helpful
- [ ] Empty state shows when no detection data
- [ ] Analytics event fires on render
- [ ] Banner only shows when from=audits (has auditId/pageId)
- [ ] Direct access (no audit context) doesn't break

---

## 🚀 Deployment Steps

1. Deploy backend (audit-worker):
   ```bash
   cd packages/audit-worker
   npx wrangler deploy
   ```

2. Build and deploy frontend:
   ```bash
   cd apps/app
   npm run build
   npm run deploy
   ```

3. Test full flow:
   - Run audit
   - Click CheckPill with score < 3
   - Verify banner shows with detection data

---

## 📈 Success Metrics (Track after 7 days)

| Metric | Target | Indicates |
|--------|--------|-----------|
| Detected banner render rate | >80% | Good coverage of analyzed checks |
| Avg time on page (with banner) | +30% longer | Contextual data is engaging |
| Copy events after seeing banner | +50% | Banner drives implementation |
| Return-to-audit after banner | 75%+ | Users fixing then verifying |

---

## 🔮 Future Enhancements

- Add "Re-run check" button to refresh detection
- Show historical scores (trend line)
- Link directly to page section (if DOM positions logged)
- Compare to competitor examples side-by-side
- AI-generated fix recommendations based on detected issues


# M10 Entity Graph Specification

**Milestone**: v0.11.0-entity-graph  
**Goal**: Detect missing `Organization.sameAs` and recommend entity links  
**Complexity**: Low (fast win, no external deps)

---

## 🎯 OBJECTIVE

Enhance audit system to detect missing `Organization.sameAs` links and provide actionable recommendations for AI visibility.

---

## 📋 REQUIREMENTS

### Detection
- Scan JSON-LD blocks for `@type: "Organization"`
- Check if `sameAs` property exists
- Check if `sameAs` array is empty or missing
- Flag as issue if missing

### Recommendations
Generate 3-5 entity links based on organization name:
1. LinkedIn company page
2. Crunchbase organization
3. GitHub organization (if applicable)
4. Wikipedia/Wikidata (if relevant)
5. Twitter/X (optional)

### UI/UX
- Show copy-paste JSON-LD snippet
- "Mark as applied" toggle (localStorage only)
- Visual indicator when fixed

---

## 🔧 TECHNICAL IMPLEMENTATION

### 1. Detection in Audit Engine

**File**: `packages/api-worker/src/html.ts`

```typescript
export function extractOrganization(jsonLdBlocks: any[]): {
  found: boolean;
  name?: string;
  url?: string;
  hasSameAs: boolean;
  sameAs?: string[];
} {
  const org = jsonLdBlocks.find(b => b['@type'] === 'Organization');
  
  if (!org) {
    return { found: false, hasSameAs: false };
  }
  
  const hasSameAs = org.sameAs && Array.isArray(org.sameAs) && org.sameAs.length > 0;
  
  return {
    found: true,
    name: org.name,
    url: org.url,
    hasSameAs,
    sameAs: org.sameAs || []
  };
}
```

### 2. Issue Generation

**File**: `packages/api-worker/src/audit.ts`

```typescript
// In runAudit function, after HTML parsing
const orgData = extractOrganization(jsonLdBlocks);

if (orgData.found && !orgData.hasSameAs) {
  issues.push({
    page_url: domain,
    issue_type: 'structured_data',
    severity: 'warning',
    message: 'Organization schema missing sameAs links for entity verification',
    details: JSON.stringify({
      recommendation: 'Add sameAs property to link to authoritative profiles',
      entity: orgData.name,
      category: 'entity_graph'
    })
  });
}
```

### 3. Recommendation Engine

**File**: `packages/api-worker/src/entity.ts` (new)

```typescript
export function generateSameAsRecommendations(orgName: string): {
  linkedin: string;
  crunchbase: string;
  github: string;
  wikidata: string;
  snippet: string;
} {
  const slug = orgName.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9-]/g, '');
  
  const recommendations = {
    linkedin: `https://www.linkedin.com/company/${slug}`,
    crunchbase: `https://www.crunchbase.com/organization/${slug}`,
    github: `https://github.com/${slug}`,
    wikidata: `https://www.wikidata.org/wiki/Special:Search/${encodeURIComponent(orgName)}`
  };
  
  const snippet = `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${orgName}",
  "sameAs": [
    "${recommendations.linkedin}",
    "${recommendations.crunchbase}",
    "${recommendations.github}"
  ]
}`;
  
  return { ...recommendations, snippet };
}
```

### 4. API Extension

**File**: `packages/api-worker/src/index.ts`

Add to audit response:
```typescript
if (orgData.found && !orgData.hasSameAs) {
  const recommendations = generateSameAsRecommendations(orgData.name);
  audit.entity_recommendations = recommendations;
}
```

### 5. Dashboard UI

**File**: `apps/app/src/components/EntityRecommendations.tsx` (new)

```typescript
import { useState } from 'react';

interface Props {
  orgName: string;
  recommendations: {
    linkedin: string;
    crunchbase: string;
    github: string;
    wikidata: string;
    snippet: string;
  };
}

export default function EntityRecommendations({ orgName, recommendations }: Props) {
  const [applied, setApplied] = useState(() => {
    return localStorage.getItem(`entity_applied_${orgName}`) === 'true';
  });
  
  const handleMarkApplied = () => {
    const newState = !applied;
    setApplied(newState);
    localStorage.setItem(`entity_applied_${orgName}`, String(newState));
  };
  
  const handleCopySnippet = async () => {
    await navigator.clipboard.writeText(recommendations.snippet);
    alert('JSON-LD snippet copied to clipboard!');
  };
  
  return (
    <div className="card">
      <h3>Entity Graph Recommendations</h3>
      <p>Add these authoritative links to your Organization schema:</p>
      
      <div className="links">
        <a href={recommendations.linkedin} target="_blank">LinkedIn</a>
        <a href={recommendations.crunchbase} target="_blank">Crunchbase</a>
        <a href={recommendations.github} target="_blank">GitHub</a>
        <a href={recommendations.wikidata} target="_blank">Wikidata</a>
      </div>
      
      <h4>Copy-Paste Snippet</h4>
      <pre>{recommendations.snippet}</pre>
      <button onClick={handleCopySnippet}>Copy JSON-LD</button>
      
      <div className="status">
        <label>
          <input 
            type="checkbox" 
            checked={applied} 
            onChange={handleMarkApplied} 
          />
          Mark as applied
        </label>
      </div>
    </div>
  );
}
```

---

## 🧪 TESTING PLAN

### Unit Tests
```typescript
// packages/api-worker/tests/entity.test.ts
import { generateSameAsRecommendations } from '../src/entity';

test('generates correct sameAs recommendations', () => {
  const result = generateSameAsRecommendations('Optiview');
  
  expect(result.linkedin).toBe('https://www.linkedin.com/company/optiview');
  expect(result.crunchbase).toBe('https://www.crunchbase.com/organization/optiview');
  expect(result.github).toBe('https://github.com/optiview');
  expect(result.snippet).toContain('"@type": "Organization"');
});
```

### Integration Tests
```bash
# Run audit on site without sameAs
curl -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -d '{"property_id":"prop_demo"}' | jq '.entity_recommendations'

# Expected: recommendations object with links and snippet
```

### Validation Tests
1. Verify snippet in Google Rich Results Test
2. Validate JSON-LD syntax
3. Check link accessibility

---

## 📊 SUCCESS CRITERIA

### Must Have
- [ ] Detect missing sameAs in Organization schema
- [ ] Generate 3-5 entity link recommendations
- [ ] Provide copy-paste JSON-LD snippet
- [ ] "Mark as applied" toggle works
- [ ] Snippet validates in Google Rich Results Test

### Nice to Have
- [ ] Auto-verify LinkedIn/Crunchbase links exist
- [ ] Suggest Twitter/X based on domain
- [ ] Detect and warn about broken sameAs links
- [ ] Track sameAs adoption metrics

---

## 🚀 IMPLEMENTATION STEPS

### Phase 1: Detection (2 hours)
1. Add `extractOrganization()` to html.ts
2. Update audit.ts to detect missing sameAs
3. Add issue generation
4. Test detection logic

### Phase 2: Recommendations (2 hours)
1. Create entity.ts with recommendation engine
2. Generate slug-based URLs
3. Create JSON-LD snippet template
4. Test recommendation accuracy

### Phase 3: API Extension (1 hour)
1. Update audit response schema
2. Include entity_recommendations in GET /v1/audits/:id
3. Test API response

### Phase 4: Dashboard UI (3 hours)
1. Create EntityRecommendations component
2. Add to PublicAudit and Dashboard routes
3. Implement copy-to-clipboard
4. Implement "Mark as applied" with localStorage
5. Style component

### Phase 5: Testing & QA (2 hours)
1. Run unit tests
2. Test with real organizations
3. Validate snippets in Google Rich Results Test
4. Verify localStorage persistence
5. Create M10_QA_REPORT.md

---

## 📋 ACCEPTANCE CRITERIA

1. ✅ Audit detects missing sameAs
2. ✅ Recommendations include 3-5 authoritative links
3. ✅ JSON-LD snippet is valid and copy-pasteable
4. ✅ "Mark as applied" persists in localStorage
5. ✅ Re-audit shows improved structured score when applied
6. ✅ Snippet validates in Google Rich Results Test

---

## 🔗 RELATED ISSUES

- .github/ISSUE_M10.md - GitHub issue template
- M8_QA_REPORT.md - Previous QA report (reference)
- packages/api-worker/src/score.ts - Scoring model (structured 0.3 weight)

---

## 📝 NOTES

### Why This Matters
- AI systems use entity graphs to verify organization authenticity
- sameAs links provide authoritative cross-references
- Improved structured data score (0.3 weight in overall)
- Better AI visibility and trust signals

### Implementation Considerations
- Keep recommendations simple (no API calls)
- Use slug-based URL generation (predictable)
- Validate snippet before displaying
- Store applied state locally only (no server state)

---

**Status**: Specification complete  
**Ready**: Implementation can begin  
**Estimated**: 10 hours total (1.5 days)


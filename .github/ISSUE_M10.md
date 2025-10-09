# M10 — Entity Graph (sameAs suggestions)

**Goal**: Stronger machine understanding via structured links.

## Tasks

- [ ] Audit rule: detect missing `Organization.sameAs`
- [ ] Recommender: propose 3–5 links (LinkedIn, Crunchbase, GitHub, Wikipedia/Wikidata if applicable)
- [ ] API: add `recommendations.sameAs[]` to audit result
- [ ] UI: "Recommendations" card with copy-paste JSON-LD snippet
- [ ] UI: "Mark as applied" (local state only)

## Acceptance Criteria

- [ ] Running an audit on optiview.ai yields a suggested `sameAs` array & snippet
- [ ] Snippet validates in Google's Rich Results Test
- [ ] Copy-paste functionality works
- [ ] "Mark as applied" toggle functions (localStorage)

## Out of Scope

- Automatic publishing/PRs to the target site
- Real-time validation of sameAs URLs
- Multi-entity support (Organization only)

## Technical Notes

### Detection Logic
```typescript
// In html.ts or audit.ts
function detectMissingSameAs(html: string): boolean {
  const jsonLdBlocks = extractJSONLD(html);
  const orgSchema = jsonLdBlocks.find(block => 
    block['@type'] === 'Organization'
  );
  
  if (!orgSchema) return false; // No Organization schema
  if (!orgSchema.sameAs || orgSchema.sameAs.length === 0) {
    return true; // Missing sameAs
  }
  return false;
}
```

### Recommendation Generator
```typescript
interface SameAsRecommendation {
  platform: string;
  url: string;
  confidence: 'high' | 'medium' | 'low';
}

function generateSameAsRecommendations(domain: string, companyName: string): SameAsRecommendation[] {
  const cleanName = companyName.toLowerCase().replace(/\s+/g, '');
  
  return [
    {
      platform: 'LinkedIn',
      url: `https://www.linkedin.com/company/${cleanName}`,
      confidence: 'high'
    },
    {
      platform: 'Crunchbase',
      url: `https://www.crunchbase.com/organization/${cleanName}`,
      confidence: 'medium'
    },
    {
      platform: 'GitHub',
      url: `https://github.com/${cleanName}`,
      confidence: 'medium'
    },
    {
      platform: 'Wikidata',
      url: `https://www.wikidata.org/wiki/Special:Search/${companyName}`,
      confidence: 'low'
    }
  ];
}
```

### API Response Format
```json
{
  "id": "aud_xxx",
  "score_overall": 0.99,
  "pages": [...],
  "issues": [...],
  "recommendations": {
    "sameAs": {
      "detected": false,
      "suggestions": [
        {
          "platform": "LinkedIn",
          "url": "https://www.linkedin.com/company/optiview",
          "confidence": "high"
        },
        {
          "platform": "Crunchbase",
          "url": "https://www.crunchbase.com/organization/optiview",
          "confidence": "medium"
        },
        {
          "platform": "GitHub",
          "url": "https://github.com/optiview",
          "confidence": "medium"
        }
      ],
      "snippet": "{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"Organization\",\n  \"name\": \"Optiview\",\n  \"url\": \"https://optiview.ai\",\n  \"sameAs\": [\n    \"https://www.linkedin.com/company/optiview\",\n    \"https://www.crunchbase.com/organization/optiview\",\n    \"https://github.com/optiview\"\n  ]\n}"
    }
  }
}
```

### UI Component
```typescript
// Recommendations section
{recommendations?.sameAs && !recommendations.sameAs.detected && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
    <h3 className="text-lg font-semibold mb-4">🔗 sameAs Recommendations</h3>
    <p className="text-sm text-gray-600 mb-4">
      Your Organization schema is missing sameAs links. These help AI understand your online presence.
    </p>
    
    <div className="mb-4">
      <h4 className="font-medium mb-2">Suggested Links:</h4>
      <ul className="space-y-1">
        {recommendations.sameAs.suggestions.map(s => (
          <li key={s.platform}>
            <span className="font-medium">{s.platform}:</span>{' '}
            <a href={s.url} className="text-blue-600" target="_blank">{s.url}</a>
            <span className="text-xs text-gray-500 ml-2">({s.confidence} confidence)</span>
          </li>
        ))}
      </ul>
    </div>
    
    <div className="bg-gray-100 p-4 rounded">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-medium">JSON-LD Snippet:</h4>
        <button 
          onClick={() => navigator.clipboard.writeText(recommendations.sameAs.snippet)}
          className="text-sm bg-blue-600 text-white px-3 py-1 rounded"
        >
          Copy
        </button>
      </div>
      <pre className="text-xs overflow-x-auto">
        {recommendations.sameAs.snippet}
      </pre>
    </div>
    
    <div className="mt-4">
      <label className="flex items-center">
        <input 
          type="checkbox" 
          checked={appliedRecommendations.sameAs || false}
          onChange={(e) => {
            const updated = {...appliedRecommendations, sameAs: e.target.checked};
            setAppliedRecommendations(updated);
            localStorage.setItem('optiview_applied_recommendations', JSON.stringify(updated));
          }}
          className="mr-2"
        />
        <span className="text-sm">Mark as applied</span>
      </label>
    </div>
  </div>
)}
```

### Example Snippet (Generated)
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Optiview",
  "url": "https://optiview.ai",
  "sameAs": [
    "https://www.linkedin.com/company/optiview",
    "https://www.crunchbase.com/organization/optiview",
    "https://github.com/optiview"
  ]
}
```

## Dependencies

- [ ] HTML parser update for sameAs detection
- [ ] Recommendation generator implementation
- [ ] API response schema update
- [ ] Dashboard UI update

## Testing Checklist

- [ ] Detection works for missing sameAs
- [ ] Detection works when sameAs present (no recommendations)
- [ ] Recommendations generated correctly
- [ ] JSON-LD snippet is valid
- [ ] Google Rich Results Test passes
- [ ] Copy button works
- [ ] "Mark as applied" persists to localStorage
- [ ] Re-audit shows applied status

---

**Target Release**: v0.11.0  
**Priority**: High (no external dependencies)


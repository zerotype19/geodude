# Scoring Criteria Export

## Files

- `scoring_criteria_latest.json` - Most recent export of all enabled criteria
- `scoring_criteria_YYYYMMDD.json` - Dated snapshots

## Export Format

Each criterion includes:

```json
{
  "id": "C1_title_quality",
  "label": "Title tag quality",
  "description": "Your page title should be clear and descriptive",
  "category": "Technical Foundations",
  "scope": "page",
  "weight": 12,
  "impact_level": "High",
  "importance_rank": 1,
  "points_possible": 100,
  "pass_threshold": 85,
  "warn_threshold": 60,
  "check_type": "html_dom",
  "enabled": 1,
  "preview": 0,
  "scoring_approach": "Automated HTML analysis",
  "examples": "...",
  "view_in_ui": "...",
  "common_issues": "...",
  "quick_fixes": "...",
  "why_it_matters": "...",
  "how_to_fix": "...",
  "learn_more_links": "[...]",
  "official_docs": "[...]",
  "references_json": null,
  "display_order": 1,
  "created_at": "...",
  "updated_at": "..."
}
```

## Categories

1. Technical Foundations
2. Content & Clarity
3. Structure & Organization
4. Authority & Trust
5. Crawl & Discoverability
6. Experience & Performance

## Generating New Export

```bash
cd packages/audit-worker
wrangler d1 execute optiview --remote --command "SELECT * FROM scoring_criteria WHERE enabled = 1 ORDER BY category, display_order NULLS LAST, id" --json | jq '.[0].results' > exports/scoring_criteria_latest.json
```

## Importing to Frontend

```typescript
import criteria from './scoring_criteria_latest.json';

// Filter by category
const technicalChecks = criteria.filter(c => c.category === 'Technical Foundations');

// Get only V1 checks (deterministic HTML-based)
const v1Checks = criteria.filter(c => c.check_type === 'html_dom' && c.id.includes('_'));

// Sort by display order
const sorted = criteria.sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
```


# Scoring Criteria Export

## Overview

**V1 Checks (Implemented):** 13 deterministic HTML-based checks  
**Total Categories:** 6

## Files

- `scoring_criteria_latest.json` - Most recent export of all enabled criteria
- `scoring_criteria_YYYYMMDD.json` - Dated snapshots

## Export Format

Each criterion includes:

```json
{
  "id": "C1_title_quality",
  "label": "Title tag quality",
  "description": "Clear, descriptive title with sensible length and brand signal.",
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
  "examples": null,
  "view_in_ui": 1,
  "common_issues": "Missing title; overly long; keyword stuffing; no brand on home.",
  "quick_fixes": "Rewrite to lead with primary topic; trim to <65 chars.",
  "why_it_matters": "Titles drive ranking, snippets, and assistant citations.",
  "how_to_fix": "Keep 15–65 chars; lead with topic; include brand on homepage.",
  "learn_more_links": null,
  "official_docs": null,
  "references_json": null,
  "display_order": 1,
  "created_at": "2025-10-22 23:40:14",
  "updated_at": "2025-10-22 23:40:14"
}
```

## Category Breakdown

1. **Technical Foundations** (5 checks)
   - C1_title_quality, C2_meta_description, A4_schema_faqpage, G10_canonical, T2_lang_region

2. **Structure & Organization** (3 checks)
   - C3_h1_presence, A2_headings_semantic, A9_internal_linking

3. **Content & Clarity** (2 checks)
   - A1_answer_first, A3_faq_presence

4. **Authority & Trust** (1 check)
   - A12_entity_graph

5. **Crawl & Discoverability** (1 check)
   - T3_noindex_robots

6. **Experience & Performance** (1 check)
   - T1_mobile_viewport

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


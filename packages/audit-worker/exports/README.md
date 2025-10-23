# Scoring Criteria Export

## Overview

**Total Checks:** 36 (23 page-level + 13 site-level)  
**Implemented:** 31 checks ready for production  
**Preview:** 5 checks (LLM, advanced features)  
**Categories:** 6

### Check Types
- **html_dom:** 18 (deterministic HTML parsing)
- **aggregate:** 11 (site-level rollups)
- **llm:** 1 (AI-assisted)
- **http:** 2 (robots/sitemap validation)

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

### 1. Technical Foundations (11 total: 6 page + 5 site)
**Page:** C1_title_quality, C2_meta_description, A4_schema_faqpage, G10_canonical, T2_lang_region, G2_og_tags_completeness  
**Site:** S2_faq_schema_adoption_pct, S3_canonical_correct_pct, S5_lang_correct_pct, S7_dup_title_pct, S9_og_tags_coverage_pct

### 2. Structure & Organization (8 total: 6 page + 2 site)
**Page:** C3_h1_presence, A2_headings_semantic, A9_internal_linking, C5_h2_coverage_ratio, G11_entity_graph_completeness 🔄, G6_fact_url_stability 🔄  
**Site:** S8_avg_h2_coverage, S11_internal_link_health_pct

### 3. Content & Clarity (8 total: 6 page + 2 site)
**Page:** A1_answer_first, A3_faq_presence, A6_contact_cta_presence, A5_related_questions_block, G12_topic_depth_semantic 🔄, A14_qna_scaffold 🔄  
**Site:** S1_faq_coverage_pct, S10_cta_above_fold_pct

### 4. Experience & Performance (4 total: 3 page + 1 site)
**Page:** T1_mobile_viewport, T4_core_web_vitals_hints, A13_page_speed_lcp  
**Site:** S4_mobile_ready_pct

### 5. Authority & Trust (2 total: 1 page + 1 site)
**Page:** A12_entity_graph  
**Site:** S6_entity_graph_adoption_pct

### 6. Crawl & Discoverability (3 total: 1 page + 2 site)
**Page:** T3_noindex_robots  
**Site:** A8_sitemap_discoverability, T5_ai_bot_access 🔄

🔄 = Preview (requires additional implementation)

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


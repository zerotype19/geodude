# Scoring Criteria ID Resolution

This document tracks ID conflicts that were resolved during the migration from the Optiview Score Guide to the D1 table.

## ID Conflicts Resolved

### C1 Conflict
- **Score Guide:** `C1` = AI bot access status
- **Implementation:** `C1_title_quality` (already implemented, display_order: 1)
- **Resolution:** Renamed score guide check to `T5_ai_bot_access` (display_order: 113)

### A12 Conflict
- **Score Guide:** `A12` = Q&A scaffold (FAQ blocks)
- **Implementation:** `A12_entity_graph` (already implemented, display_order: 13)
- **Resolution:** Renamed score guide check to `A14_qna_scaffold` (display_order: 23)

### A8 Note
- **Score Guide:** `A8` = Sitemaps & discoverability
- **Implementation:** No conflict (A8 was not previously used)
- **Resolution:** Used as `A8_sitemap_discoverability` (site-level, display_order: 112)

### G6 Note
- **Score Guide:** `G6` = Canonical fact URLs
- **Implementation:** No conflict in current implementation
- **Resolution:** Used as `G6_fact_url_stability` (display_order: 21)
- **Note:** Score guide mentions G6 as both "Factual accuracy" and "Canonical fact URLs" - we kept factual accuracy as a separate LLM check

## Complete ID Mapping

### Page-Level Checks (23 total)

| Order | ID | Label | Type | Status |
|-------|-----|-------|------|--------|
| 1 | C1_title_quality | Title tag quality | html_dom | ✅ Implemented |
| 2 | C2_meta_description | Meta description present | html_dom | ✅ Implemented |
| 3 | C3_h1_presence | Single H1 tag | html_dom | ✅ Implemented |
| 4 | A1_answer_first | Answer-first hero section | html_dom | ✅ Implemented |
| 5 | A2_headings_semantic | Semantic heading structure | html_dom | ✅ Implemented |
| 6 | A3_faq_presence | FAQ section present | html_dom | ✅ Implemented |
| 7 | A4_schema_faqpage | FAQPage schema | html_dom | ✅ Implemented |
| 8 | A9_internal_linking | Internal linking & diversity | html_dom | ✅ Implemented |
| 9 | G10_canonical | Canonical URL correctness | html_dom | ✅ Implemented |
| 10 | T1_mobile_viewport | Mobile viewport tag | html_dom | ✅ Implemented |
| 11 | T2_lang_region | Language/region tags | html_dom | ✅ Implemented |
| 12 | T3_noindex_robots | No blocking robots directives | html_dom | ✅ Implemented |
| 13 | A12_entity_graph | Organization entity graph | html_dom | ✅ Implemented |
| 14 | G2_og_tags_completeness | Open Graph basics | html_dom | ✅ Implemented |
| 15 | A6_contact_cta_presence | Primary CTA above the fold | html_dom | ✅ Implemented |
| 16 | A5_related_questions_block | Related questions block | html_dom | ✅ Implemented |
| 17 | C5_h2_coverage_ratio | H2 coverage | html_dom | ✅ Implemented |
| 18 | T4_core_web_vitals_hints | Core Web Vitals hints | html_dom | ✅ Implemented |
| 19 | G12_topic_depth_semantic | Topic depth & semantic coverage | llm | 🔄 Preview |
| 20 | G11_entity_graph_completeness | Entity graph completeness | html_dom | 🔄 Preview |
| 21 | G6_fact_url_stability | Canonical fact URLs | html_dom | 🔄 Preview |
| 22 | A13_page_speed_lcp | Page speed (LCP) | html_dom | ✅ Implemented |
| 23 | A14_qna_scaffold | Q&A scaffold | html_dom | 🔄 Preview |

### Site-Level Checks (13 total)

| Order | ID | Label | Type | Status |
|-------|-----|-------|------|--------|
| 101 | S1_faq_coverage_pct | FAQ coverage (site) | aggregate | ✅ Implemented |
| 102 | S2_faq_schema_adoption_pct | FAQ schema adoption (site) | aggregate | ✅ Implemented |
| 103 | S3_canonical_correct_pct | Canonical correctness (site) | aggregate | ✅ Implemented |
| 104 | S4_mobile_ready_pct | Mobile-ready pages (site) | aggregate | ✅ Implemented |
| 105 | S5_lang_correct_pct | Correct lang/region (site) | aggregate | ✅ Implemented |
| 106 | S6_entity_graph_adoption_pct | Entity graph adoption (site) | aggregate | ✅ Implemented |
| 107 | S7_dup_title_pct | Duplicate titles (site) | aggregate | ✅ Implemented |
| 108 | S8_avg_h2_coverage | Average H2 coverage (site) | aggregate | ✅ Implemented |
| 109 | S9_og_tags_coverage_pct | OG coverage (site) | aggregate | ✅ Implemented |
| 110 | S10_cta_above_fold_pct | CTA above-the-fold (site) | aggregate | ✅ Implemented |
| 111 | S11_internal_link_health_pct | Internal link health (site) | aggregate | ✅ Implemented |
| 112 | A8_sitemap_discoverability | Sitemaps & discoverability | http | ✅ Implemented |
| 113 | T5_ai_bot_access | AI bot access status | http | 🔄 Preview |

## Check Type Distribution

- **html_dom:** 18 checks (deterministic HTML parsing)
- **aggregate:** 11 checks (site-level rollups)
- **llm:** 1 check (AI-assisted analysis)
- **http:** 2 checks (robots.txt, sitemap validation)

## Preview Flag

Checks marked `preview: 1` are:
- G12_topic_depth_semantic (LLM-based, coming soon)
- G11_entity_graph_completeness (advanced schema analysis)
- G6_fact_url_stability (URL stability tracking)
- A14_qna_scaffold (enhanced Q&A validation)
- T5_ai_bot_access (AI crawler detection)

These are defined in the schema but may require additional implementation work before full rollout.


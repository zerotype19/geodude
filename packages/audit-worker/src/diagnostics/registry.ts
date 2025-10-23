import type { Executor } from "./types";
import { htmlExecutors } from "./executors/htmlDom";
import { httpExecutors } from "./executors/http";
import { aggregateExecutors } from "./executors/aggregate";
import { llmExecutors } from "./executors/llm";

export const EXECUTORS: Executor[] = [
  // ═══════════════════════════════════════════════════════════════
  // Technical Foundations (page)
  // ═══════════════════════════════════════════════════════════════
  htmlExecutors.C1_title_quality,
  htmlExecutors.C2_meta_description,
  htmlExecutors.A4_schema_faqpage,
  htmlExecutors.G10_canonical,
  htmlExecutors.T2_lang_region,
  htmlExecutors.G2_og_tags_completeness,

  // ═══════════════════════════════════════════════════════════════
  // Structure & Organization (page)
  // ═══════════════════════════════════════════════════════════════
  htmlExecutors.C3_h1_presence,
  htmlExecutors.A2_headings_semantic,
  htmlExecutors.A9_internal_linking,
  htmlExecutors.C5_h2_coverage_ratio,
  htmlExecutors.G11_entity_graph_completeness, // preview
  htmlExecutors.G6_fact_url_stability, // preview

  // ═══════════════════════════════════════════════════════════════
  // Content & Clarity (page)
  // ═══════════════════════════════════════════════════════════════
  htmlExecutors.A1_answer_first,
  htmlExecutors.A3_faq_presence,
  htmlExecutors.A6_contact_cta_presence,
  htmlExecutors.A5_related_questions_block,
  htmlExecutors.G12_topic_depth_semantic, // preview
  htmlExecutors.A14_qna_scaffold, // preview

  // ═══════════════════════════════════════════════════════════════
  // Authority & Trust (page)
  // ═══════════════════════════════════════════════════════════════
  htmlExecutors.A12_entity_graph,

  // ═══════════════════════════════════════════════════════════════
  // Crawl & Discoverability (page)
  // ═══════════════════════════════════════════════════════════════
  htmlExecutors.T3_noindex_robots,

  // ═══════════════════════════════════════════════════════════════
  // Experience & Performance (page)
  // ═══════════════════════════════════════════════════════════════
  htmlExecutors.T1_mobile_viewport,
  htmlExecutors.T4_core_web_vitals_hints,
  htmlExecutors.A13_page_speed_lcp, // preview

  // ═══════════════════════════════════════════════════════════════
  // Site-level (aggregate)
  // ═══════════════════════════════════════════════════════════════
  aggregateExecutors.S1_faq_coverage_pct,
  aggregateExecutors.S2_faq_schema_adoption_pct,
  aggregateExecutors.S3_canonical_correct_pct,
  aggregateExecutors.S4_mobile_ready_pct,
  aggregateExecutors.S5_lang_correct_pct,
  aggregateExecutors.S6_entity_graph_adoption_pct,
  aggregateExecutors.S7_dup_title_pct,
  aggregateExecutors.S8_avg_h2_coverage,
  aggregateExecutors.S9_og_tags_coverage_pct,
  aggregateExecutors.S10_cta_above_fold_pct,
  aggregateExecutors.S11_internal_link_health_pct,

  // ═══════════════════════════════════════════════════════════════
  // Site-level (HTTP)
  // ═══════════════════════════════════════════════════════════════
  httpExecutors.A8_sitemap_discoverability,
  httpExecutors.T5_ai_bot_access, // preview

  // ═══════════════════════════════════════════════════════════════
  // Future: LLM-based checks
  // ═══════════════════════════════════════════════════════════════
  ...llmExecutors,
];


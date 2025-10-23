import type { Executor } from "./types";
import { htmlExecutors } from "./executors/htmlDom";
import { httpExecutors } from "./executors/http";
import { aggregateExecutors } from "./executors/aggregate";
import { llmExecutors } from "./executors/llm";

/**
 * Helper: Filter undefined executors and ensure unique IDs.
 * Prevents silent failures from refactors/renames.
 */
function finalize(list: Array<Executor | undefined>): Executor[] {
  const xs = list.filter(Boolean) as Executor[];
  const ids = new Set<string>();
  for (const x of xs) {
    if (ids.has(x.id)) {
      // Surface early in logs/build to catch duplicate IDs
      console.warn(`[REGISTRY] Duplicate check id: ${x.id}`);
    }
    ids.add(x.id);
  }
  return xs;
}

// Handle both array and Record exports for llmExecutors
const LLM = Array.isArray(llmExecutors) 
  ? llmExecutors 
  : Object.values(llmExecutors as Record<string, Executor>);

/**
 * Master registry of all scoring check executors.
 * 
 * ORDER MATTERS for UI display and priority.
 * 
 * Categories:
 * - Technical Foundations (page): Core HTML/meta elements
 * - Structure & Organization (page): Document structure, navigation
 * - Content & Clarity (page): Content quality, answerability
 * - Authority & Trust (page): Brand signals, entity data
 * - Crawl & Discoverability (page): Robots, indexability
 * - Experience & Performance (page): Mobile, speed hints
 * - Site-level (aggregate): Cross-page rollups
 * - Site-level (HTTP): Robots.txt, sitemaps
 * - LLM-based (future): Semantic analysis via AI
 */
export const EXECUTORS: Executor[] = finalize([
  // ═══════════════════════════════════════════════════════════════
  // Technical Foundations (page) – ORDER: 1
  // ═══════════════════════════════════════════════════════════════
  htmlExecutors.C1_title_quality,
  htmlExecutors.C2_meta_description,
  htmlExecutors.A4_schema_faqpage,
  htmlExecutors.G10_canonical,
  htmlExecutors.T2_lang_region,
  htmlExecutors.G2_og_tags_completeness,

  // ═══════════════════════════════════════════════════════════════
  // Structure & Organization (page) – ORDER: 2
  // ═══════════════════════════════════════════════════════════════
  htmlExecutors.C3_h1_presence,
  htmlExecutors.A2_headings_semantic,
  htmlExecutors.A9_internal_linking,
  htmlExecutors.C5_h2_coverage_ratio,
  htmlExecutors.G11_entity_graph_completeness, // preview
  htmlExecutors.G6_fact_url_stability,         // preview

  // ═══════════════════════════════════════════════════════════════
  // Content & Clarity (page) – ORDER: 3
  // ═══════════════════════════════════════════════════════════════
  htmlExecutors.A1_answer_first,
  htmlExecutors.A3_faq_presence,
  htmlExecutors.A6_contact_cta_presence,
  htmlExecutors.A5_related_questions_block,
  htmlExecutors.G12_topic_depth_semantic,      // preview
  htmlExecutors.A14_qna_scaffold,              // preview

  // ═══════════════════════════════════════════════════════════════
  // Authority & Trust (page) – ORDER: 4
  // ═══════════════════════════════════════════════════════════════
  htmlExecutors.A12_entity_graph,

  // ═══════════════════════════════════════════════════════════════
  // Crawl & Discoverability (page) – ORDER: 5
  // ═══════════════════════════════════════════════════════════════
  htmlExecutors.T3_noindex_robots,

  // ═══════════════════════════════════════════════════════════════
  // Experience & Performance (page) – ORDER: 6
  // ═══════════════════════════════════════════════════════════════
  htmlExecutors.T1_mobile_viewport,
  htmlExecutors.T4_core_web_vitals_hints,
  htmlExecutors.T5_page_speed_lcp,             // preview

  // ═══════════════════════════════════════════════════════════════
  // Site-level (aggregate) – ORDER: 7
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
  // Site-level (HTTP) – ORDER: 8
  // ═══════════════════════════════════════════════════════════════
  httpExecutors.A8_sitemap_discoverability,
  httpExecutors.T6_ai_bot_access,              // preview

  // ═══════════════════════════════════════════════════════════════
  // Future: LLM-based checks – ORDER: 9
  // ═══════════════════════════════════════════════════════════════
  ...LLM,
]);


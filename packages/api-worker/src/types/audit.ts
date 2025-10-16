/**
 * Audit v2.1 Types and Constants
 */

export type PillarScores = {
  crawlability: number;   // 0-100
  structured: number;     // 0-100
  answerability: number;  // 0-100
  trust: number;          // 0-100
  visibility: number;     // 0-100
  overall: number;        // 0-100
};

export const PILLAR_WEIGHTS = {
  crawlability: 0.30,
  structured:   0.25,
  answerability:0.20,
  trust:        0.15,
  visibility:   0.10,
} as const;

export type AnalysisExtract = {
  url: string;
  canonical_url?: string | null;
  status: number;
  title?: string;
  h1?: string;
  meta_description?: string;
  word_count: number;
  robots_meta?: string | null;
  has_jsonld: boolean;
  schema_types: string[];         // normalized
  faq_schema_present: boolean;
  author?: string | null;
  date_published?: string | null;
  date_modified?: string | null;
  headings_h2: number;
  headings_h3: number;
  outbound_links: number;
  outbound_domains: number;
  https_ok: boolean;
  load_time_ms?: number | null;
};

export type AuditScoresRow = {
  id?: number;
  audit_id: string;
  crawlability_score: number;
  structured_score: number;
  answerability_score: number;
  trust_score: number;
  visibility_score: number;
  overall_score: number;
  score_model_version: string;
  created_at?: string;
};

export type VisibilityData = {
  totalCitations: number;
  bravePresence: number;
  bySource: Array<{source: string; count: number}>;
};

import { Checks, type CheckInput, type CheckResult } from "./checks.impl";

export type CheckFn = (input: CheckInput) => CheckResult;

export const CHECKS: Array<[id: string, fn: CheckFn]> = [
  ["C1_title_quality", Checks.C1_title_quality],
  ["C2_meta_description", Checks.C2_meta_description],
  ["C3_h1_presence", Checks.C3_h1_presence],
  ["A1_answer_first", Checks.A1_answer_first],
  ["A2_headings_semantic", Checks.A2_headings_semantic],
  ["A3_faq_presence", Checks.A3_faq_presence],
  ["A4_schema_faqpage", Checks.A4_schema_faqpage],
  ["A9_internal_linking", Checks.A9_internal_linking],
  ["G10_canonical", Checks.G10_canonical],
  ["T1_mobile_viewport", Checks.T1_mobile_viewport],
  ["T2_lang_region", Checks.T2_lang_region],
  ["T3_noindex_robots", Checks.T3_noindex_robots],
  ["A12_entity_graph", Checks.A12_entity_graph],
];


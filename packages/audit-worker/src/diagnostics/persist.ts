import type { CheckResult, CriterionRow } from "./types";

export async function loadCriteriaMap(db: D1Database): Promise<Map<string, CriterionRow>> {
  const { results } = await db.prepare("SELECT * FROM scoring_criteria WHERE enabled = 1").all();
  const map = new Map<string, CriterionRow>();
  (results || []).forEach((r: any) => {
    map.set(r.id, {
      id: r.id,
      label: r.label,
      scope: r.scope as "page" | "site",
      check_type: r.check_type as "html_dom" | "http" | "aggregate" | "llm",
      preview: r.preview as 0 | 1,
      enabled: r.enabled as 0 | 1,
      weight: r.weight,
      impact_level: r.impact_level as "High" | "Medium" | "Low",
      pass_threshold: r.pass_threshold,
      warn_threshold: r.warn_threshold,
      display_order: r.display_order,
    });
  });
  return map;
}

export async function persistPageResults(db: D1Database, pageId: string, rows: CheckResult[]) {
  const json = JSON.stringify(rows);
  await db.prepare("UPDATE audit_page_analysis SET checks_json = ?1 WHERE page_id = ?2").bind(json, pageId).run();
}

export async function persistSiteResults(db: D1Database, auditId: string, rows: CheckResult[]) {
  const json = JSON.stringify(rows);
  await db.prepare("UPDATE audits SET site_checks_json = ?1 WHERE id = ?2").bind(json, auditId).run();
}


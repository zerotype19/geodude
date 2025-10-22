import type { CheckResult } from "./checks.impl";

export async function persistPageChecksToAnalysis(db: D1Database, pageId: string, checks: CheckResult[]) {
  const json = JSON.stringify(checks);
  await db.prepare("UPDATE audit_page_analysis SET checks_json = ?1 WHERE page_id = ?2")
    .bind(json, pageId)
    .run();
}


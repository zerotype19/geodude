import { EXECUTORS } from "./registry";
import type { SiteContext, CheckResult, CriterionRow } from "./types";
import { persistSiteResults, loadCriteriaMap } from "./persist";

export async function runDiagnosticsForSite(db: D1Database, ctx: SiteContext): Promise<CheckResult[]> {
  const criteria = await loadCriteriaMap(db);
  const out: CheckResult[] = [];

  for (const ex of EXECUTORS) {
    const meta: CriterionRow | undefined = criteria.get(ex.id);
    if (!meta || meta.scope !== "site" || !meta.enabled) continue;

    try {
      const r = await ex.runSite?.(ctx);
      if (r) {
        // Ensure preview and impact are set from metadata
        r.preview = !!meta.preview;
        r.impact = meta.impact_level;
        out.push(r);
      }
    } catch (error) {
      console.error(`[DIAGNOSTICS] Error running site-level ${ex.id} for ${ctx.domain}:`, error);
      // Store error result
      out.push({
        id: ex.id,
        score: 0,
        status: "error",
        details: { error: String(error) },
        scope: "site",
        preview: !!meta.preview,
        impact: meta.impact_level,
      });
    }
  }

  await persistSiteResults(db, ctx.auditId, out);
  console.log(`[DIAGNOSTICS] Completed ${out.length} site checks for audit ${ctx.auditId}`);
  return out;
}


import { EXECUTORS } from "./registry";
import type { PageContext, CheckResult, CriterionRow } from "./types";
import { persistPageResults, loadCriteriaMap } from "./persist";

export async function runDiagnosticsForPage(db: D1Database, ctx: PageContext): Promise<CheckResult[]> {
  const criteria = await loadCriteriaMap(db);
  const out: CheckResult[] = [];

  for (const ex of EXECUTORS) {
    const meta: CriterionRow | undefined = criteria.get(ex.id);
    if (!meta || meta.scope !== "page" || !meta.enabled) continue;

    try {
      const r = await ex.runPage?.(ctx);
      if (r) {
        // Ensure preview and impact are set from metadata
        r.preview = !!meta.preview;
        r.impact = meta.impact_level;
        out.push(r);
      }
    } catch (error) {
      console.error(`[DIAGNOSTICS] Error running ${ex.id} for ${ctx.url}:`, error);
      // Store error result
      out.push({
        id: ex.id,
        score: 0,
        status: "error",
        details: { error: String(error) },
        scope: "page",
        preview: !!meta.preview,
        impact: meta.impact_level,
      });
    }
  }

  await persistPageResults(db, ctx.pageId, out);
  console.log(`[DIAGNOSTICS] Completed ${out.length} page checks for ${ctx.url}`);
  return out;
}


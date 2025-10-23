import type { CriterionRow, CheckResult } from "./types";

export interface CompositeOut {
  total: number;
  page_score: number;
  site_score: number;
  counts: {
    included: number;
    preview: number;
    disabled: number;
  };
  breakdown: {
    page: {
      total_weight: number;
      weighted_sum: number;
      check_count: number;
    };
    site: {
      total_weight: number;
      weighted_sum: number;
      check_count: number;
    };
  };
}

export function computeComposite(
  pageRows: CheckResult[],
  siteRows: CheckResult[],
  criteria: CriterionRow[]
): CompositeOut {
  const meta = new Map(criteria.map((c) => [c.id, c]));
  const all = [...pageRows, ...siteRows];

  // Filter to enabled, non-preview checks
  const usable = all.filter((r) => {
    const m = meta.get(r.id);
    if (!m) return false;
    return m.enabled && !m.preview;
  });

  const weighted = (rows: CheckResult[]) => {
    let weighted_sum = 0;
    let total_weight = 0;
    let check_count = 0;

    for (const r of rows) {
      const m = meta.get(r.id);
      if (!m || !m.enabled || m.preview) continue;
      weighted_sum += r.score * (m.weight || 1);
      total_weight += m.weight || 1;
      check_count++;
    }

    return {
      score: total_weight ? weighted_sum / total_weight : 0,
      weighted_sum,
      total_weight,
      check_count,
    };
  };

  const pageOnly = usable.filter((r) => r.scope === "page");
  const siteOnly = usable.filter((r) => r.scope === "site");

  const pageCalc = weighted(pageOnly);
  const siteCalc = weighted(siteOnly);
  const totalCalc = weighted(usable);

  return {
    total: round(totalCalc.score),
    page_score: round(pageCalc.score),
    site_score: round(siteCalc.score),
    counts: {
      included: usable.length,
      preview: all.filter((r) => meta.get(r.id)?.preview).length,
      disabled: criteria.filter((c) => !c.enabled).length,
    },
    breakdown: {
      page: {
        total_weight: pageCalc.total_weight,
        weighted_sum: pageCalc.weighted_sum,
        check_count: pageCalc.check_count,
      },
      site: {
        total_weight: siteCalc.total_weight,
        weighted_sum: siteCalc.weighted_sum,
        check_count: siteCalc.check_count,
      },
    },
  };

  function round(n: number) {
    return Math.round(n * 10) / 10;
  }
}


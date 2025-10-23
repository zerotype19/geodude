import type { Executor, SiteContext, CheckResult } from "../types";

function statusFromScore(s: number, passThreshold = 85, warnThreshold = 60): CheckResult["status"] {
  return s >= passThreshold ? "ok" : s >= warnThreshold ? "warn" : "fail";
}

function pctPass(scores: number[], cut = 60) {
  if (!scores.length) return 0;
  return Math.round((100 * scores.filter((s) => s >= cut).length) / scores.length);
}

function avg(scores: number[]) {
  if (!scores.length) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function collect(ctx: SiteContext, id: string): number[] {
  const scores: number[] = [];
  for (const p of ctx.pages) {
    const rows = p.checks || [];
    const r = rows.find((x) => x.id === id);
    if (r) scores.push(r.score);
  }
  return scores;
}

function collectDetails(ctx: SiteContext, id: string, key: string): any[] {
  const values: any[] = [];
  for (const p of ctx.pages) {
    const rows = p.checks || [];
    const r = rows.find((x) => x.id === id);
    if (r && r.details && key in r.details) values.push(r.details[key]);
  }
  return values;
}

function duplicatePct(items: string[]) {
  const m = new Map<string, number>();
  items.forEach((t) => m.set(t, (m.get(t) || 0) + 1));
  const total = items.length;
  const dup = Array.from(m.values())
    .filter((n) => n > 1)
    .reduce((a, b) => a + b, 0);
  return total ? Math.round((100 * dup) / total) : 0;
}

function emit(id: string, v: number, details: Record<string, any> = {}, impact: "High" | "Medium" | "Low" = "Medium"): CheckResult {
  const status = statusFromScore(v, 85, 60);
  return { id, scope: "site", score: v, status, details, impact };
}

export const aggregateExecutors: Record<string, Executor> = {
  S1_faq_coverage_pct: {
    id: "S1_faq_coverage_pct",
    async runSite(ctx) {
      const scores = collect(ctx, "A3_faq_presence");
      const v = pctPass(scores, 60);
      return emit("S1_faq_coverage_pct", v, { pageCount: scores.length });
    },
  },

  S2_faq_schema_adoption_pct: {
    id: "S2_faq_schema_adoption_pct",
    async runSite(ctx) {
      const scores = collect(ctx, "A4_schema_faqpage");
      const v = pctPass(scores, 60);
      return emit("S2_faq_schema_adoption_pct", v, { pageCount: scores.length });
    },
  },

  S3_canonical_correct_pct: {
    id: "S3_canonical_correct_pct",
    async runSite(ctx) {
      const scores = collect(ctx, "G10_canonical");
      const v = pctPass(scores, 85);
      return emit("S3_canonical_correct_pct", v, { pageCount: scores.length }, "High");
    },
  },

  S4_mobile_ready_pct: {
    id: "S4_mobile_ready_pct",
    async runSite(ctx) {
      const scores = collect(ctx, "T1_mobile_viewport");
      const v = pctPass(scores, 85);
      return emit("S4_mobile_ready_pct", v, { pageCount: scores.length }, "High");
    },
  },

  S5_lang_correct_pct: {
    id: "S5_lang_correct_pct",
    async runSite(ctx) {
      const scores = collect(ctx, "T2_lang_region");
      const v = pctPass(scores, 85);
      return emit("S5_lang_correct_pct", v, { pageCount: scores.length });
    },
  },

  S6_entity_graph_adoption_pct: {
    id: "S6_entity_graph_adoption_pct",
    async runSite(ctx) {
      const scores = collect(ctx, "A12_entity_graph");
      const v = pctPass(scores, 85);
      return emit("S6_entity_graph_adoption_pct", v, { pageCount: scores.length }, "High");
    },
  },

  S7_dup_title_pct: {
    id: "S7_dup_title_pct",
    async runSite(ctx) {
      const titles = collectDetails(ctx, "C1_title_quality", "title").filter(Boolean) as string[];
      const dupRate = duplicatePct(titles);
      const score = Math.max(0, 100 - dupRate); // Higher is better
      return emit("S7_dup_title_pct", score, { dupRate, totalTitles: titles.length }, "Medium");
    },
  },

  S8_avg_h2_coverage: {
    id: "S8_avg_h2_coverage",
    async runSite(ctx) {
      const scores = collect(ctx, "C5_h2_coverage_ratio");
      const v = avg(scores);
      return emit("S8_avg_h2_coverage", v, { pageCount: scores.length });
    },
  },

  S9_og_tags_coverage_pct: {
    id: "S9_og_tags_coverage_pct",
    async runSite(ctx) {
      const scores = collect(ctx, "G2_og_tags_completeness");
      const v = pctPass(scores, 60);
      return emit("S9_og_tags_coverage_pct", v, { pageCount: scores.length });
    },
  },

  S10_cta_above_fold_pct: {
    id: "S10_cta_above_fold_pct",
    async runSite(ctx) {
      const scores = collect(ctx, "A6_contact_cta_presence");
      const v = pctPass(scores, 60);
      return emit("S10_cta_above_fold_pct", v, { pageCount: scores.length });
    },
  },

  S11_internal_link_health_pct: {
    id: "S11_internal_link_health_pct",
    async runSite(ctx) {
      const scores = collect(ctx, "A9_internal_linking");
      const v = pctPass(scores, 60);
      return emit("S11_internal_link_health_pct", v, { pageCount: scores.length });
    },
  },
};


import type { Executor, SiteContext, CheckResult } from "../types";

// ═══════════════════════════════════════════════════════════════
// Metric-specific thresholds for pass/fail cutoffs
// ═══════════════════════════════════════════════════════════════
const THRESH = {
  A3_faq_presence: 60,
  A4_schema_faqpage: 60,
  G10_canonical: 85,
  T1_mobile_viewport: 85,
  T2_lang_region: 85,
  A12_entity_graph: 85,
  G2_og_tags_completeness: 60,
  A6_contact_cta_presence: 60,
  A9_internal_linking: 60,
} as const;

// ═══════════════════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════════════════

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

function median(nums: number[]) {
  if (!nums.length) return 0;
  const a = [...nums].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

function collect(ctx: SiteContext, id: string): number[] {
  const scores: number[] = [];
  for (const p of ctx.pages || []) {
    const rows = p.checks || [];
    const r = rows.find((x) => x.id === id);
    if (r) scores.push(r.score);
  }
  return scores;
}

function collectDetails(ctx: SiteContext, id: string, key: string): any[] {
  const seen = new Set<string>();
  const values: any[] = [];
  for (const p of ctx.pages || []) {
    // Dedupe per URL in case multiple runs attach extra check results
    if (seen.has(p.url)) continue;
    seen.add(p.url);
    const r = (p.checks || []).find((x) => x.id === id);
    if (r?.details && key in r.details) values.push(r.details[key]);
  }
  return values;
}

function sumDetails(ctx: SiteContext, id: string, keys: string[]) {
  const sums: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  let pages = 0;
  for (const p of ctx.pages || []) {
    const r = (p.checks || []).find((x) => x.id === id);
    if (!r?.details) continue;
    pages++;
    for (const k of keys) sums[k] += Number(r.details[k] || 0);
  }
  return { sums, pages };
}

function duplicatePct(items: string[]) {
  // Filter out empty strings to avoid inflating the denominator
  const filtered = items.filter(Boolean);
  const m = new Map<string, number>();
  filtered.forEach((t) => m.set(t, (m.get(t) || 0) + 1));
  const total = filtered.length;
  const dup = Array.from(m.values())
    .filter((n) => n > 1)
    .reduce((a, b) => a + b, 0);
  return total ? Math.round((100 * dup) / total) : 0;
}

function normalizeTitle(t: string) {
  return (t || "")
    .toLowerCase()
    .replace(/[®™©℠]/g, "")
    .replace(/[-–—|·•:]\s*[^|-–—·•:]{1,30}$/i, "") // drop trailing site/brand suffix
    .replace(/\s+/g, " ")
    .trim();
}

function sampleFailingPages(ctx: SiteContext, id: string, cut = 60, limit = 5) {
  const pages: Array<{ url: string; score: number }> = [];
  for (const p of ctx.pages || []) {
    const r = (p.checks || []).find((x) => x.id === id);
    if (r && r.score < cut) pages.push({ url: p.url, score: r.score });
    if (pages.length >= limit) break;
  }
  return pages;
}

function pctPassById(ctx: SiteContext, id: string) {
  const scores = collect(ctx, id);
  const threshold = THRESH[id as keyof typeof THRESH] ?? 60;
  return { v: pctPass(scores, threshold), count: scores.length };
}

function emit(id: string, v: number, details: Record<string, any> = {}, impact: "High" | "Medium" | "Low" = "Medium"): CheckResult {
  const status = statusFromScore(v, 85, 60);
  return { id, scope: "site", score: v, status, details, impact };
}

function emitSafe(
  id: string,
  v: number,
  pages: number,
  details: Record<string, any> = {},
  impact: "High" | "Medium" | "Low" = "Medium"
): CheckResult {
  if (!pages) {
    return {
      id,
      scope: "site",
      score: 0,
      status: "not_applicable" as const,
      details: { ...details, pageCount: 0 },
      impact,
    };
  }
  return emit(id, v, { ...details, pageCount: pages }, impact);
}

// ═══════════════════════════════════════════════════════════════
// Site-level aggregate executors
// ═══════════════════════════════════════════════════════════════

export const aggregateExecutors: Record<string, Executor> = {
  S1_faq_coverage_pct: {
    id: "S1_faq_coverage_pct",
    async runSite(ctx) {
      const { v, count } = pctPassById(ctx, "A3_faq_presence");
      return emitSafe("S1_faq_coverage_pct", v, count, {}, "Medium");
    },
  },

  S2_faq_schema_adoption_pct: {
    id: "S2_faq_schema_adoption_pct",
    async runSite(ctx) {
      const { v, count } = pctPassById(ctx, "A4_schema_faqpage");
      return emitSafe("S2_faq_schema_adoption_pct", v, count, {}, "Medium");
    },
  },

  S3_canonical_correct_pct: {
    id: "S3_canonical_correct_pct",
    async runSite(ctx) {
      const { v, count } = pctPassById(ctx, "G10_canonical");
      const sample = sampleFailingPages(ctx, "G10_canonical", THRESH.G10_canonical);
      return emitSafe("S3_canonical_correct_pct", v, count, { sample }, "High");
    },
  },

  S4_mobile_ready_pct: {
    id: "S4_mobile_ready_pct",
    async runSite(ctx) {
      const { v, count } = pctPassById(ctx, "T1_mobile_viewport");
      const sample = sampleFailingPages(ctx, "T1_mobile_viewport", THRESH.T1_mobile_viewport);
      return emitSafe("S4_mobile_ready_pct", v, count, { sample }, "High");
    },
  },

  S5_lang_correct_pct: {
    id: "S5_lang_correct_pct",
    async runSite(ctx) {
      const { v, count } = pctPassById(ctx, "T2_lang_region");
      const sample = sampleFailingPages(ctx, "T2_lang_region", THRESH.T2_lang_region);
      return emitSafe("S5_lang_correct_pct", v, count, { sample }, "Medium");
    },
  },

  S6_entity_graph_adoption_pct: {
    id: "S6_entity_graph_adoption_pct",
    async runSite(ctx) {
      const { v, count } = pctPassById(ctx, "A12_entity_graph");
      const sample = sampleFailingPages(ctx, "A12_entity_graph", THRESH.A12_entity_graph);
      return emitSafe("S6_entity_graph_adoption_pct", v, count, { sample }, "High");
    },
  },

  S7_dup_title_pct: {
    id: "S7_dup_title_pct",
    async runSite(ctx) {
      const raw = collectDetails(ctx, "C1_title_quality", "title").filter(Boolean) as string[];
      const titles = raw.map(normalizeTitle).filter(Boolean);
      const dupRate = duplicatePct(titles);
      const score = Math.max(0, 100 - dupRate); // Higher is better
      return emitSafe("S7_dup_title_pct", score, titles.length, {
        dupRate,
        totalTitles: titles.length,
        sample: titles.slice(0, 5),
      }, "Medium");
    },
  },

  S8_avg_h2_coverage: {
    id: "S8_avg_h2_coverage",
    async runSite(ctx) {
      // Aggregate raw h2/word counts instead of averaging scores
      const { sums, pages } = sumDetails(ctx, "C5_h2_coverage_ratio", ["h2Count", "wordCount"]);
      const { h2Count, wordCount } = { h2Count: sums.h2Count, wordCount: sums.wordCount };
      const ratio = wordCount > 0 ? h2Count / (wordCount / 200) : 0; // h2 per 200 words
      
      // Be lenient on small sites
      const score =
        wordCount < 1000 ? 100 :
        ratio >= 0.8 && ratio <= 1.5 ? 100 :
        ratio >= 0.5 ? 75 : 40;

      return emitSafe("S8_avg_h2_coverage", score, pages, {
        h2Count,
        wordCount,
        ratio: Math.round(ratio * 100) / 100,
      }, "Medium");
    },
  },

  S9_og_tags_coverage_pct: {
    id: "S9_og_tags_coverage_pct",
    async runSite(ctx) {
      const { v, count } = pctPassById(ctx, "G2_og_tags_completeness");
      const sample = sampleFailingPages(ctx, "G2_og_tags_completeness", THRESH.G2_og_tags_completeness);
      return emitSafe("S9_og_tags_coverage_pct", v, count, { sample }, "Medium");
    },
  },

  S10_cta_above_fold_pct: {
    id: "S10_cta_above_fold_pct",
    async runSite(ctx) {
      const { v, count } = pctPassById(ctx, "A6_contact_cta_presence");
      const sample = sampleFailingPages(ctx, "A6_contact_cta_presence", THRESH.A6_contact_cta_presence);
      return emitSafe("S10_cta_above_fold_pct", v, count, { sample }, "Medium");
    },
  },

  S11_internal_link_health_pct: {
    id: "S11_internal_link_health_pct",
    async runSite(ctx) {
      const { v, count } = pctPassById(ctx, "A9_internal_linking");
      const sample = sampleFailingPages(ctx, "A9_internal_linking", THRESH.A9_internal_linking);
      return emitSafe("S11_internal_link_health_pct", v, count, { sample }, "Medium");
    },
  },
};


import type { Executor, PageContext, CheckResult } from "../types";
import { runChecksOnHtml } from "../../scoring/runner";
import { loadDom, q, qa, txt, attr } from "../../scoring/dom";

function statusFromScore(s: number, passThreshold = 85, warnThreshold = 60): CheckResult["status"] {
  return s >= passThreshold ? "ok" : s >= warnThreshold ? "warn" : "fail";
}

function base(input: PageContext) {
  const html = input.html_rendered || input.html_static || "";
  const { document } = loadDom(html);
  return { document, html };
}

// Helper to wrap existing check results
// Caches results per pageContext to avoid redundant parsing
function wrapExistingCheck(
  ctx: PageContext,
  checkId: string,
  scope: "page" = "page",
  preview: boolean = false,
  impact: "High" | "Medium" | "Low" = "Medium"
): CheckResult | undefined {
  const html = ctx.html_rendered || ctx.html_static || "";
  if (!html) return undefined;
  
  // Cache check results to avoid re-parsing DOM for each check
  if (!(ctx as any)._cachedChecks) {
    (ctx as any)._cachedChecks = runChecksOnHtml({ url: ctx.url, html, site: ctx.site });
  }
  
  const r = (ctx as any)._cachedChecks.find((x: any) => x.id === checkId);
  if (!r) return undefined;
  
  return { ...r, scope, preview, impact };
}

export const htmlExecutors: Record<string, Executor> = {
  // ═══════════════════════════════════════════════════════════════
  // Technical Foundations (page-level)
  // ═══════════════════════════════════════════════════════════════
  
  C1_title_quality: {
    id: "C1_title_quality",
    async runPage(ctx) {
      return wrapExistingCheck(ctx, "C1_title_quality", "page", false, "High");
    },
  },

  C2_meta_description: {
    id: "C2_meta_description",
    async runPage(ctx) {
      return wrapExistingCheck(ctx, "C2_meta_description", "page", false, "Medium");
    },
  },

  A4_schema_faqpage: {
    id: "A4_schema_faqpage",
    async runPage(ctx) {
      return wrapExistingCheck(ctx, "A4_schema_faqpage", "page", false, "High");
    },
  },

  G10_canonical: {
    id: "G10_canonical",
    async runPage(ctx) {
      return wrapExistingCheck(ctx, "G10_canonical", "page", false, "Medium");
    },
  },

  T2_lang_region: {
    id: "T2_lang_region",
    async runPage(ctx) {
      return wrapExistingCheck(ctx, "T2_lang_region", "page", false, "Low");
    },
  },

  G2_og_tags_completeness: {
    id: "G2_og_tags_completeness",
    async runPage(ctx) {
      const { document } = base(ctx);
      const ogTags = ["og:title", "og:description", "og:image", "og:url", "og:type"];
      const filled = ogTags.filter(t => {
        const content = attr(q(document, `meta[property="${t}"]`), "content");
        return content && content.trim().length > 0;
      });
      
      const score = Math.round((filled.length / ogTags.length) * 100);
      
      return {
        id: "G2_og_tags_completeness",
        score,
        status: statusFromScore(score, 85, 60),
        details: {
          filled: filled,
          total: ogTags.length,
          present: filled.length,
        },
        scope: "page",
        preview: false,
        impact: "Medium",
      };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Structure & Organization (page-level)
  // ═══════════════════════════════════════════════════════════════

  C3_h1_presence: {
    id: "C3_h1_presence",
    async runPage(ctx) {
      return wrapExistingCheck(ctx, "C3_h1_presence", "page", false, "High");
    },
  },

  A2_headings_semantic: {
    id: "A2_headings_semantic",
    async runPage(ctx) {
      return wrapExistingCheck(ctx, "A2_headings_semantic", "page", false, "High");
    },
  },

  A9_internal_linking: {
    id: "A9_internal_linking",
    async runPage(ctx) {
      return wrapExistingCheck(ctx, "A9_internal_linking", "page", false, "Medium");
    },
  },

  C5_h2_coverage_ratio: {
    id: "C5_h2_coverage_ratio",
    async runPage(ctx) {
      const { document, html } = base(ctx);
      const h2Count = qa(document, "h2").length;
      const wordCount = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
      
      // Guard for low word count pages (give them a pass)
      if (wordCount < 300) {
        return {
          id: "C5_h2_coverage_ratio",
          score: 100,
          status: statusFromScore(100, 85, 60),
          details: { h2Count, wordCount, ratio: 0, note: "short_page_exempt" },
          scope: "page",
          preview: false,
          impact: "Medium",
        };
      }
      
      // Ideal: 1 H2 per ~150-250 words
      const ratio = wordCount > 0 ? h2Count / (wordCount / 200) : 0;
      const score = ratio >= 0.8 && ratio <= 1.5 ? 100 : ratio >= 0.5 ? 70 : 40;
      
      return {
        id: "C5_h2_coverage_ratio",
        score,
        status: statusFromScore(score, 85, 60),
        details: { h2Count, wordCount, ratio: Math.round(ratio * 100) / 100 },
        scope: "page",
        preview: false,
        impact: "Medium",
      };
    },
  },

  G11_entity_graph_completeness: {
    id: "G11_entity_graph_completeness",
    async runPage(ctx) {
      const { document } = base(ctx);
      const scripts = qa(document, 'script[type="application/ld+json"]');
      let hasOrg = false;
      let hasProduct = false;
      let hasPerson = false;
      
      scripts.forEach((s) => {
        try {
          const raw = txt(s as Element);
          if (!raw.trim()) return;
          const json = JSON.parse(raw);
          // Handle @graph arrays
          const items = Array.isArray(json) ? json : (json['@graph'] || [json]);
          items.forEach((j: any) => {
            if (!j || !j["@type"]) return;
            const types = Array.isArray(j["@type"]) ? j["@type"] : [j["@type"]];
            if (types?.includes("Organization") || types?.includes("LocalBusiness")) hasOrg = true;
            if (types?.includes("Product")) hasProduct = true;
            if (types?.includes("Person")) hasPerson = true;
          });
        } catch {}
      });
      
      const entityCount = [hasOrg, hasProduct, hasPerson].filter(Boolean).length;
      const score = entityCount >= 2 ? 100 : entityCount === 1 ? 60 : 20;
      
      return {
        id: "G11_entity_graph_completeness",
        score,
        status: statusFromScore(score, 85, 60),
        details: { hasOrg, hasProduct, hasPerson, entityCount },
        scope: "page",
        preview: true,
        impact: "Medium",
      };
    },
  },

  G6_fact_url_stability: {
    id: "G6_fact_url_stability",
    async runPage(ctx) {
      const { document } = base(ctx);
      // Filter out framework IDs (root, app, main, page, __, etc.)
      const semanticAnchors = Array.from(document.querySelectorAll("[id]"))
        .map((e: any) => e.id)
        .filter(id => !/^(root|app|main|page|__)/i.test(id)).length;
      const dlDt = document.querySelectorAll("dl dt").length;
      const score = semanticAnchors >= 10 || dlDt >= 5 ? 100 : semanticAnchors >= 3 || dlDt >= 2 ? 60 : 20;
      
      return {
        id: "G6_fact_url_stability",
        score,
        status: statusFromScore(score, 85, 60),
        details: { semanticAnchors, dlDt },
        scope: "page",
        preview: true,
        impact: "Medium",
      };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Content & Clarity (page-level)
  // ═══════════════════════════════════════════════════════════════

  A1_answer_first: {
    id: "A1_answer_first",
    async runPage(ctx) {
      return wrapExistingCheck(ctx, "A1_answer_first", "page", false, "High");
    },
  },

  A3_faq_presence: {
    id: "A3_faq_presence",
    async runPage(ctx) {
      return wrapExistingCheck(ctx, "A3_faq_presence", "page", false, "Medium");
    },
  },

  A6_contact_cta_presence: {
    id: "A6_contact_cta_presence",
    async runPage(ctx) {
      const { document } = base(ctx);
      // Check href patterns
      const hrefCtaCount = 
        qa(document, 'a[href*="contact"]').length +
        qa(document, 'a[href*="get-started"]').length +
        qa(document, 'a[href*="pricing"]').length +
        qa(document, 'a[href^="mailto:"]').length +
        qa(document, 'a[href^="tel:"]').length;
      
      // Check text patterns
      const buttons = qa(document, "a, button");
      const pattern = /\b(contact|get\s*started|book|schedule|sign\s*up|try\s*free|demo|pricing)\b/i;
      const matches = buttons.filter(b => pattern.test(txt(b as Element)));
      
      // Track unique text to avoid over-counting repeated nav links
      const uniqueTexts = new Set(matches.map(b => txt(b as Element).toLowerCase().trim()));
      const uniqueMatches = Math.min(matches.length, uniqueTexts.size);
      
      const total = hrefCtaCount + uniqueMatches;
      const score = total >= 3 ? 100 : total >= 1 ? 70 : 20;
      
      return {
        id: "A6_contact_cta_presence",
        score,
        status: statusFromScore(score, 85, 60),
        details: { ctaCount: total, uniqueCount: uniqueTexts.size, above_fold: total > 0 },
        scope: "page",
        preview: false,
        impact: "Medium",
      };
    },
  },

  A5_related_questions_block: {
    id: "A5_related_questions_block",
    async runPage(ctx) {
      const { document } = base(ctx);
      const headings = qa(document, "h2, h3, h4, summary");
      const relatedPatterns = /related questions?|people also ask|common questions?|more questions?|faq/i;
      
      const hasRelatedSection = headings.some((h) => relatedPatterns.test(txt(h as Element)));
      const questionHeadings = headings.filter((h) =>
        /^(what|how|why|when|where|who|can|should|is|are|do|does)\b/i.test(txt(h as Element))
      );
      
      const score = hasRelatedSection && questionHeadings.length >= 3 ? 100 : questionHeadings.length >= 5 ? 70 : 30;
      
      return {
        id: "A5_related_questions_block",
        score,
        status: statusFromScore(score, 85, 60),
        details: { hasRelatedSection, questionCount: questionHeadings.length },
        scope: "page",
        preview: false,
        impact: "Medium",
      };
    },
  },

  G12_topic_depth_semantic: {
    id: "G12_topic_depth_semantic",
    async runPage(ctx) {
      const { document, html } = base(ctx);
      const h2s = Array.from(document.querySelectorAll("h2")).length;
      const h3s = Array.from(document.querySelectorAll("h3")).length;
      const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
      const lists = qa(document, "ul, ol").length;
      
      // Cap word contribution at 40 points to prevent inflated scores for long content
      const wordScore = Math.min(40, words > 1500 ? 40 : words > 800 ? 25 : words > 400 ? 15 : 5);
      
      // Depth heuristic: headings + capped word score + structured content
      const depthScore = Math.min(100, h2s * 12 + h3s * 8 + wordScore + lists * 3);
      const score = Math.round(Math.max(20, Math.min(depthScore, 95)));
      
      return {
        id: "G12_topic_depth_semantic",
        score,
        status: statusFromScore(score, 85, 60),
        details: { h2s, h3s, words, lists, wordScore },
        scope: "page",
        preview: true,
        impact: "Medium",
      };
    },
  },

  A14_qna_scaffold: {
    id: "A14_qna_scaffold",
    async runPage(ctx) {
      const html = ctx.html_rendered || ctx.html_static || "";
      if (!html) return undefined;
      
      // Use cached checks if available
      if (!(ctx as any)._cachedChecks) {
        (ctx as any)._cachedChecks = runChecksOnHtml({ url: ctx.url, html, site: ctx.site });
      }
      
      const faq = (ctx as any)._cachedChecks.find((x: any) => x.id === "A3_faq_presence");
      const faqSchema = (ctx as any)._cachedChecks.find((x: any) => x.id === "A4_schema_faqpage");
      
      // Guard: ensure at least one check exists
      if (!faq && !faqSchema) {
        return {
          id: "A14_qna_scaffold",
          score: 0,
          status: "fail" as const,
          details: { a3_score: null, a4_score: null, note: "no_checks_found" },
          scope: "page",
          preview: false,
          impact: "High",
        };
      }
      
      const score = Math.max(faq?.score ?? 0, faqSchema?.score ?? 0);
      
      return {
        id: "A14_qna_scaffold",
        score,
        status: statusFromScore(score, 85, 60),
        details: { a3_score: faq?.score ?? null, a4_score: faqSchema?.score ?? null },
        scope: "page",
        preview: false,
        impact: "High",
      };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Authority & Trust (page-level)
  // ═══════════════════════════════════════════════════════════════

  A12_entity_graph: {
    id: "A12_entity_graph",
    async runPage(ctx) {
      return wrapExistingCheck(ctx, "A12_entity_graph", "page", false, "High");
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Crawl & Discoverability (page-level)
  // ═══════════════════════════════════════════════════════════════

  T3_noindex_robots: {
    id: "T3_noindex_robots",
    async runPage(ctx) {
      return wrapExistingCheck(ctx, "T3_noindex_robots", "page", false, "High");
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Experience & Performance (page-level)
  // ═══════════════════════════════════════════════════════════════

  T1_mobile_viewport: {
    id: "T1_mobile_viewport",
    async runPage(ctx) {
      return wrapExistingCheck(ctx, "T1_mobile_viewport", "page", false, "Medium");
    },
  },

  T4_core_web_vitals_hints: {
    id: "T4_core_web_vitals_hints",
    async runPage(ctx) {
      const { document } = base(ctx);
      
      // Check for performance hints
      const hasPreconnect = !!q(document, 'link[rel="preconnect"]');
      const hasPrefetch = !!q(document, 'link[rel="prefetch"]');
      const hasPreload = !!q(document, 'link[rel="preload"]');
      const hasFetchPriority = qa(document, '[fetchpriority="high"]').length > 0;
      const hasAsyncDecoding = qa(document, 'img[decoding="async"]').length > 0;
      const lazyImages = qa(document, 'img[loading="lazy"]').length;
      const totalImages = qa(document, "img").length;
      
      const hints = [hasPreconnect, hasPrefetch, hasPreload, hasFetchPriority, hasAsyncDecoding, lazyImages > 0].filter(Boolean).length;
      const lazyRatio = totalImages > 0 ? lazyImages / totalImages : 0;
      
      // Adjusted: 0.3 lazy ratio is more realistic for marketing pages
      const score = hints >= 4 && lazyRatio > 0.3 ? 100 : hints >= 3 ? 75 : hints >= 2 ? 60 : hints >= 1 ? 40 : 20;
      
      return {
        id: "T4_core_web_vitals_hints",
        score,
        status: statusFromScore(score, 85, 60),
        details: { hasPreconnect, hasPrefetch, hasPreload, hasFetchPriority, hasAsyncDecoding, lazyImages, totalImages, lazyRatio },
        scope: "page",
        preview: false,
        impact: "Medium",
      };
    },
  },

  T5_page_speed_lcp: {
    id: "T5_page_speed_lcp",
    async runPage(ctx) {
      const { document, html } = base(ctx);
      
      // Heuristic proxy for LCP: check for large images, hero sections, inline styles
      const images = qa(document, "img");
      const largeImages = images.filter((img) => {
        const width = (img as any).getAttribute("width");
        const height = (img as any).getAttribute("height");
        return (width && parseInt(width) > 500) || (height && parseInt(height) > 400);
      }).length;
      
      const heroSections = qa(document, 'section[class*="hero"], div[class*="hero"], header[class*="hero"]').length;
      const htmlSize = html.length;
      
      // Check for large inline style blocks (critical CSS over 100KB is a red flag)
      const inlineStyleSize = (html.match(/<style[^>]*>([\s\S]{0,100000})<\/style>/g)?.join('').length || 0);
      const stylePenalty = inlineStyleSize > 100000 ? 10 : 0;
      
      // Refined formula: penalize large HTML, large images, and excessive inline styles
      const baseScore = 100 - stylePenalty - Math.floor(htmlSize / 50000) - (largeImages * 10);
      const score = Math.max(30, Math.min(100, baseScore));
      
      return {
        id: "T5_page_speed_lcp",
        score,
        status: statusFromScore(score, 85, 60),
        details: { htmlSize, largeImages, heroSections, inlineStyleSize, stylePenalty },
        scope: "page",
        preview: true,
        impact: "Medium",
      };
    },
  },
};


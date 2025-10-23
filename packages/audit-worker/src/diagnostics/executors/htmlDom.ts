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
function wrapExistingCheck(
  ctx: PageContext,
  checkId: string,
  scope: "page" = "page",
  preview: boolean = false,
  impact: "High" | "Medium" | "Low" = "Medium"
): CheckResult | undefined {
  const html = ctx.html_rendered || ctx.html_static || "";
  if (!html) return undefined;
  
  const out = runChecksOnHtml({ url: ctx.url, html, site: ctx.site });
  const r = out.find((x) => x.id === checkId);
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
      const ogTitle = q(document, 'meta[property="og:title"]');
      const ogDesc = q(document, 'meta[property="og:description"]');
      const ogImage = q(document, 'meta[property="og:image"]');
      const ogUrl = q(document, 'meta[property="og:url"]');
      
      const present = [ogTitle, ogDesc, ogImage, ogUrl].filter(Boolean).length;
      const score = Math.round((present / 4) * 100);
      
      return {
        id: "G2_og_tags_completeness",
        score,
        status: statusFromScore(score, 85, 60),
        details: {
          ogTitle: !!ogTitle,
          ogDesc: !!ogDesc,
          ogImage: !!ogImage,
          ogUrl: !!ogUrl,
          present,
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
          const json = JSON.parse(txt(s as Element));
          const items = Array.isArray(json) ? json : [json];
          items.forEach((j) => {
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
      const anchors = Array.from(document.querySelectorAll("[id]")).length;
      const dlDt = document.querySelectorAll("dl dt").length;
      const score = anchors >= 10 || dlDt >= 5 ? 100 : anchors >= 3 || dlDt >= 2 ? 60 : 20;
      
      return {
        id: "G6_fact_url_stability",
        score,
        status: statusFromScore(score, 85, 60),
        details: { anchors, dlDt },
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
      const ctaSelectors = [
        'a[href*="contact"]',
        'a[href*="get-started"]',
        'a[href*="pricing"]',
        'button:has-text("Contact")',
        'button:has-text("Get Started")',
        'a[href^="mailto:"]',
        'a[href^="tel:"]',
      ];
      
      let ctaCount = 0;
      ctaSelectors.forEach((sel) => {
        try {
          ctaCount += qa(document, sel).length;
        } catch {}
      });
      
      // Also check for common CTA text patterns
      const buttons = qa(document, "button, a");
      const ctaPatterns = /contact|get started|book|schedule|sign up|try free|request demo|call us/i;
      const textMatches = buttons.filter((el) => ctaPatterns.test(txt(el as Element))).length;
      
      const total = ctaCount + textMatches;
      const score = total >= 3 ? 100 : total >= 1 ? 70 : 20;
      
      return {
        id: "A6_contact_cta_presence",
        score,
        status: statusFromScore(score, 85, 60),
        details: { ctaCount: total, above_fold: total > 0 },
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
      const headings = qa(document, "h2, h3, h4");
      const relatedPatterns = /related questions?|people also ask|common questions?|more questions?/i;
      
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
      
      // Depth heuristic: headings + word count + structured content
      const depthScore = Math.min(
        100,
        h2s * 12 + h3s * 8 + (words > 1500 ? 40 : words > 800 ? 25 : words > 400 ? 15 : 5) + lists * 3
      );
      const score = Math.round(Math.max(20, Math.min(depthScore, 95)));
      
      return {
        id: "G12_topic_depth_semantic",
        score,
        status: statusFromScore(score, 85, 60),
        details: { h2s, h3s, words, lists },
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
      
      const out = runChecksOnHtml({ url: ctx.url, html, site: ctx.site });
      const faq = out.find((x) => x.id === "A3_faq_presence");
      const faqSchema = out.find((x) => x.id === "A4_schema_faqpage");
      
      const score = Math.max(faq?.score ?? 0, faqSchema?.score ?? 0);
      
      return {
        id: "A14_qna_scaffold",
        score,
        status: statusFromScore(score, 85, 60),
        details: { a3_score: faq?.score ?? null, a4_score: faqSchema?.score ?? null },
        scope: "page",
        preview: true,
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
      const lazyImages = qa(document, 'img[loading="lazy"]').length;
      const totalImages = qa(document, "img").length;
      
      const hints = [hasPreconnect, hasPrefetch, hasPreload, lazyImages > 0].filter(Boolean).length;
      const lazyRatio = totalImages > 0 ? lazyImages / totalImages : 0;
      
      const score = hints >= 3 && lazyRatio > 0.5 ? 100 : hints >= 2 ? 70 : hints >= 1 ? 50 : 20;
      
      return {
        id: "T4_core_web_vitals_hints",
        score,
        status: statusFromScore(score, 85, 60),
        details: { hasPreconnect, hasPrefetch, hasPreload, lazyImages, totalImages, lazyRatio },
        scope: "page",
        preview: false,
        impact: "Medium",
      };
    },
  },

  A13_page_speed_lcp: {
    id: "A13_page_speed_lcp",
    async runPage(ctx) {
      const { document, html } = base(ctx);
      
      // Heuristic proxy for LCP: check for large images, hero sections
      const images = qa(document, "img");
      const largeImages = images.filter((img) => {
        const width = (img as HTMLImageElement).getAttribute("width");
        const height = (img as HTMLImageElement).getAttribute("height");
        return (width && parseInt(width) > 500) || (height && parseInt(height) > 400);
      }).length;
      
      const heroSections = qa(document, 'section[class*="hero"], div[class*="hero"], header[class*="hero"]').length;
      const htmlSize = html.length;
      
      // Smaller HTML + optimized images = better LCP proxy
      const score =
        htmlSize < 100000 && largeImages <= 2
          ? 100
          : htmlSize < 200000 && largeImages <= 4
          ? 75
          : htmlSize < 500000
          ? 50
          : 30;
      
      return {
        id: "A13_page_speed_lcp",
        score,
        status: statusFromScore(score, 85, 60),
        details: { htmlSize, largeImages, heroSections },
        scope: "page",
        preview: true,
        impact: "Medium",
      };
    },
  },
};


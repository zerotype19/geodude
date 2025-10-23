export type CheckId =
  | "C1_title_quality" | "C2_meta_description" | "C3_h1_presence"
  | "A1_answer_first"  | "A2_headings_semantic" | "A3_faq_presence" | "A4_schema_faqpage"
  | "A9_internal_linking" | "G10_canonical"
  | "T1_mobile_viewport" | "T2_lang_region" | "T3_noindex_robots"
  | "A12_entity_graph";

export type CheckStatus = "ok" | "warn" | "fail" | "not_applicable" | "error";
export type CheckScope = "page" | "site";

export interface CheckInput {
  url: string;
  html: string;
  site?: { domain: string; homepageUrl: string; targetLocale?: "en" | "en-US" };
  __doc?: Document; // injected by runner
}

export interface CheckResult {
  id: CheckId;
  scope: CheckScope;
  score: number;          // 0–100
  status: CheckStatus;
  details: Record<string, any>;
  evidence?: string[];
}

import { q, qa, txt, attr, isInternal } from "./dom";
import { getETLD1, normalizeBrandText, brandFromHost, tokenBoundaryIncludes, hostsEquivalent } from "./brand";

const clamp = (n: number, lo=0, hi=100) => Math.max(lo, Math.min(hi, n));
const lenScore = (n: number, min: number, max: number) => {
  if (n <= 0) return 0;
  if (n < min) return clamp((n/min)*60);
  if (n > max) return clamp(60 - ((n-max)/(max))*40);
  return 100;
};
const statusFromScore = (s: number): CheckStatus => (s>=85?"ok": s>=60?"warn":"fail");

function firstMeaningfulText(doc: Document): string {
  const main = q(doc, "main") || doc.body;
  if (!main) return "";
  const selector = "p, .lead, article p, section p";
  const blocks = qa(main, selector).map(e => txt(e as Element).trim()).filter(Boolean);
  return (blocks[0] || txt(main).trim()).slice(0, 800);
}

export const Checks = {
  C1_title_quality(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const titleEl = q(doc, "title");
    const rawTitle = txt(titleEl);
    if (!rawTitle) {
      return { id:"C1_title_quality", scope:"page", score:0, status:"fail", details:{reason:"missing"} };
    }
    const normalizedTitle = normalizeBrandText(rawTitle);

    // Gather multiple brand candidates: host, ld+json Organization/WebSite.name, og:site_name, twitter:site, nav/logo alt
    const host = input.site?.domain || "";
    const hostBrand = brandFromHost(host);

    const ogSite = normalizeBrandText(attr(q(doc, 'meta[property="og:site_name"]'), "content") || "");
    const twitterSite = normalizeBrandText((attr(q(doc, 'meta[name="twitter:site"]'), "content") || "").replace(/^@/, ""));
    const logoAlt = normalizeBrandText(attr(q(doc, 'img[alt*="logo" i]'), "alt") || "");
    const homeLink = normalizeBrandText(txt(q(doc, 'a[rel="home"], a[href="/"]')) || "");

    let schemaBrand = "";
    qa(doc, 'script[type="application/ld+json"]').forEach(s=>{
      try {
        const json = JSON.parse(txt(s as Element));
        const items = Array.isArray(json) ? json : (json['@graph'] || [json]);
        for (const j of items) {
          const types = Array.isArray(j['@type']) ? j['@type'] : [j['@type']];
          if (types?.some((t:string)=>/Organization|LocalBusiness|WebSite/i.test(t))) {
            schemaBrand ||= normalizeBrandText(j.name || j.alternateName || "");
          }
        }
      } catch {}
    });

    const candidates = [schemaBrand, ogSite, twitterSite, logoAlt, homeLink, hostBrand]
      .map(normalizeBrandText)
      .filter(Boolean);

    // Choose best candidate: prefer schema/og over host if length>2
    const bestBrand = candidates.find(c => c.length >= 3) || hostBrand;

    const hasBrand = bestBrand ? tokenBoundaryIncludes(normalizedTitle, bestBrand) : false;

    const length = rawTitle.length;
    const base = clamp(lenScore(length, 15, 65));
    const score = clamp(base*0.6 + (hasBrand ? 40 : 0));

    return {
      id:"C1_title_quality",
      scope:"page",
      score,
      status:statusFromScore(score),
      details:{ title: rawTitle, length, hasBrand, brandCandidate: bestBrand, allCandidates: candidates },
      evidence:[rawTitle]
    };
  },

  C2_meta_description(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const el = q(doc, 'meta[name="description"]');
    const content = attr(el, "content") ?? "";
    if (!content) return { id:"C2_meta_description", scope:"page", score:0, status:"fail", details:{reason:"missing"} };
    const length = content.length;
    const score = clamp(lenScore(length, 50, 160));
    return { id:"C2_meta_description", scope:"page", score, status:statusFromScore(score), details:{length}, evidence:[content] };
  },

  C3_h1_presence(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const h1s = qa(doc, "h1");
    const count = h1s.length;
    const firstText = count ? txt(h1s[0] as Element) : "";
    const score = count===1?100: count===0?0:30;
    return { id:"C3_h1_presence", scope:"page", score, status:statusFromScore(score),
      details:{count, text:firstText}, evidence: firstText ? [firstText] : [] };
  },

  A1_answer_first(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const snippet = firstMeaningfulText(doc);
    const ctaLike = qa(doc, "a,button").some(a => /get started|book|contact|pricing|try|schedule|demo/i.test(txt(a as Element)));
    const conciseClaim = /\b(what is|how to|we (help|provide|offer)|in summary|overview|definition)\b/i.test(snippet) && snippet.length > 80;
    const score = (ctaLike && conciseClaim)?100 : (ctaLike||conciseClaim)?70:35;
    return { id:"A1_answer_first", scope:"page", score, status:statusFromScore(score), details:{ctaLike, conciseClaim}, evidence:[snippet] };
  },

  A2_headings_semantic(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const hs = qa(doc, "h1,h2,h3") as Element[];
    if (!hs.length) return { id:"A2_headings_semantic", scope:"page", score:20, status:"fail", details:{reason:"no headings"} };
    const h1Count = hs.filter(h=>h.tagName.toLowerCase()==="h1").length;
    let penalties = 0, last = 0;
    hs.forEach(h => { const lvl = Number(h.tagName.slice(1)); if (last && lvl-last>1) penalties += 20; last = lvl; });
    if (h1Count!==1) penalties += 30;
    const score = clamp(100-penalties);
    return { id:"A2_headings_semantic", scope:"page", score, status:statusFromScore(score), details:{h1Count, penalties}, evidence: hs.slice(0,5).map(h=>`${h.tagName}:${txt(h)}`) };
  },

  A3_faq_presence(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const faqWord = qa(doc, "h2,h3,summary,details").some(e => /faq|frequently asked/i.test(txt(e as Element)));
    const qaPattern = qa(doc, "h2,h3,dt,summary").some(e => /^(what|how|why|when|where|who)\b/i.test(txt(e as Element)));
    const detailsEls = qa(doc, "details");
    const score = detailsEls.length>0 && faqWord ? 100 : qaPattern ? 60 : 0;
    return { id:"A3_faq_presence", scope:"page", score, status:statusFromScore(score), details:{faqWord, qaPattern, detailsCount: detailsEls.length} };
  },

  A4_schema_faqpage(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const scripts = qa(doc, 'script[type="application/ld+json"]');
    let valid=false, qas=0, errors: string[]=[];
    scripts.forEach(s=>{
      try{
        const raw = txt(s as Element);
        if (!raw.trim()) return;
        const json = JSON.parse(raw);
        const items: any[] = Array.isArray(json) ? json : (json['@graph'] || [json]);
        for (const j of items) {
          const types = Array.isArray(j['@type']) ? j['@type'] : [j['@type']];
          if (types?.includes("FAQPage")) {
            let me = j.mainEntity;
            if (!Array.isArray(me)) me = me ? [me] : [];
            const count = me.filter((q:any)=> (q['@type']==='Question' && q.acceptedAnswer)).length;
            qas = Math.max(qas, count);
            valid = valid || count>0;
          }
        }
      } catch(e:any){ errors.push(String(e)); }
    });
    const score = !valid?0 : qas>=3?100 : qas>=1?70:40;
    return { id:"A4_schema_faqpage", scope:"page", score, status:statusFromScore(score), details:{valid,qas,errors} };
  },

  A9_internal_linking(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const host = input.site?.domain ?? "";
    const anchors = qa(doc, "a[href]") as Element[];

    const internals: { href: string; text: string }[] = [];
    for (const a of anchors) {
      const href = (a as HTMLAnchorElement).getAttribute("href") || "";
      if (isInternal(href, host)) {
        const text = (txt(a) || attr(a,"aria-label") || attr(a,"title") || "").trim();
        internals.push({ href, text });
      }
    }

    const count = internals.length;
    const uniqueTargets = new Set(internals.map(l => l.href));
    const uniqueTexts = new Set(internals.map(l => l.text.toLowerCase()).filter(Boolean));

    const diversity = count ? uniqueTexts.size / count : 0;
    const targetVariety = count ? uniqueTargets.size / count : 0;

    // Require both enough links and reasonable variety of targets/text
    const score =
      count >= 10 && diversity >= 0.4 && targetVariety >= 0.5 ? 100 :
      count >= 5  && (diversity >= 0.3 || targetVariety >= 0.4) ? 70 :
      count >= 3  ? 50 : 20;

    return {
      id:"A9_internal_linking", scope:"page", score, status:statusFromScore(score),
      details:{ count, uniqueText: uniqueTexts.size, uniqueTargets: uniqueTargets.size, diversity, targetVariety },
      evidence: internals.slice(0,10).map(l => `${l.text} -> ${l.href}`)
    };
  },

  G10_canonical(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const el = q(doc, 'link[rel="canonical"]');
    if (!el) return { id:"G10_canonical", scope:"page", score:0, status:"fail", details:{reason:"missing"} };

    const rawHref = attr(el,"href") || "";
    let href = rawHref;
    try { href = new URL(rawHref, input.url).toString(); } catch {}

    let ok=false, sameSite=false, host="", canonicalHost="";
    try {
      const pageUrl = new URL(input.url);
      const canUrl  = new URL(href);
      host = pageUrl.hostname;
      canonicalHost = canUrl.hostname;
      ok = !!(canUrl.protocol && canonicalHost);
      sameSite = hostsEquivalent(host, canonicalHost);
    } catch {}

    const score = ok && sameSite ? 100 : ok ? 70 : 0;
    return { id:"G10_canonical", scope:"page", score, status:statusFromScore(score), details:{href, ok, sameSite, host, canonicalHost} };
  },

  T1_mobile_viewport(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const vp = q(doc, 'meta[name="viewport"]');
    const content = (vp && (vp.getAttribute("content")||"")) || "";
    const ok = /width\s*=\s*device-width/i.test(content);
    const score = ok?100:0;
    return { id:"T1_mobile_viewport", scope:"page", score, status:statusFromScore(score), details:{content} };
  },

  T2_lang_region(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const lang = (q(doc,"html")?.getAttribute("lang")||"").toLowerCase();
    const target = (input.site?.targetLocale ?? "en").toLowerCase();
    const ok = lang && (lang===target || (target==="en" && lang.startsWith("en")));
    const score = ok?100 : lang?30:0;
    return { id:"T2_lang_region", scope:"page", score, status:statusFromScore(score), details:{lang,target} };
  },

  T3_noindex_robots(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const robots = q(doc, 'meta[name="robots"]');
    const content = (robots && robots.getAttribute("content") || "").toLowerCase();
    const tokens = content.split(/[,;\s]+/).filter(Boolean);
    const hasNoindex = tokens.includes("noindex");
    const hasIndex = tokens.includes("index");
    // If both present, treat noindex as authoritative (conservative)
    const score = hasNoindex ? 0 : 100;
    return { id:"T3_noindex_robots", scope:"page", score, status:statusFromScore(score), details:{robots:content, resolved: hasNoindex ? "noindex" : (hasIndex ? "index" : "unspecified")} };
  },

  A12_entity_graph(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const scripts = qa(doc, 'script[type="application/ld+json"]');
    let org=false, logo=false, sameAs=0, nameMatch=false, name="";
    const titleNorm = normalizeBrandText(txt(q(doc,"title")) || "");

    let candidates: string[] = [];
    scripts.forEach(s=>{
      try{
        const json = JSON.parse(txt(s as Element));
        const items = Array.isArray(json) ? json : (json['@graph'] || [json]);
        for (const j of items) {
          const types = Array.isArray(j['@type']) ? j['@type'] : [j['@type']];
          if (types?.some((t:string)=>/Organization|LocalBusiness|WebSite|Brand/i.test(t))) {
            const n = normalizeBrandText(j.name || j.alternateName || "");
            if (n) candidates.push(n);
            if (/Organization|LocalBusiness/i.test(types.join(','))) {
              org = true;
              logo = logo || !!j.logo;
              sameAs = Math.max(sameAs, Array.isArray(j.sameAs) ? j.sameAs.length : 0);
            }
          }
        }
      } catch {}
    });

    name = candidates.find(c => c.length >= 3) || "";
    nameMatch = !!(name && tokenBoundaryIncludes(titleNorm, name));

    const score = org ? ((logo?30:0) + (sameAs>=2?40: sameAs?25:10) + (nameMatch?30:10)) : 0;
    return { id:"A12_entity_graph", scope:"page", score, status:statusFromScore(score),
      details:{org,logo,sameAs,name,nameMatch, candidates}
    };
  },
};

export type CheckFn = (input: CheckInput) => CheckResult;


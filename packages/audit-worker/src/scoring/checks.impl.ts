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

const clamp = (n: number, lo=0, hi=100) => Math.max(lo, Math.min(hi, n));
const lenScore = (n: number, min: number, max: number) => {
  if (n <= 0) return 0;
  if (n < min) return clamp((n/min)*60);
  if (n > max) return clamp(60 - ((n-max)/(max))*40);
  return 100;
};
const statusFromScore = (s: number): CheckStatus => (s>=85?"ok": s>=60?"warn":"fail");

export const Checks = {
  C1_title_quality(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const title = txt(q(doc, "title"));
    if (!title) return { id:"C1_title_quality", scope:"page", score:0, status:"fail", details:{reason:"missing"} };
    const length = title.length;
    const base = clamp(lenScore(length, 15, 65));
    const brand = input.site?.domain?.split(".")[0]?.toLowerCase() ?? "";
    const hasBrand = brand && title.toLowerCase().includes(brand);
    const score = clamp(base*0.6 + (hasBrand?40:0));
    return { id:"C1_title_quality", scope:"page", score, status:statusFromScore(score), details:{title,length,hasBrand}, evidence:[title] };
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
    const score = count===1?100: count===0?0:30;
    return { id:"C3_h1_presence", scope:"page", score, status:statusFromScore(score), details:{count, text: txt(h1s[0] as Element)}, evidence:[txt(h1s[0] as Element) || ""] };
  },

  A1_answer_first(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const main = q(doc, "main") || q(doc, "body")!;
    const snippet = txt(main).slice(0, 1200);
    const ctaLike = qa(doc, "a,button").some(a => /get started|book|contact|pricing|try|schedule/i.test(txt(a as Element)));
    const conciseClaim = /what|how|why|we\s(help|provide|offer)|\b(best|top|simple|fast)\b/i.test(snippet) && snippet.length > 80;
    const score = (ctaLike && conciseClaim)?100 : (ctaLike||conciseClaim)?60:20;
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
        const json = JSON.parse(txt(s as Element));
        const items = Array.isArray(json)?json:[json];
        items.forEach(j=>{
          const t = Array.isArray(j["@type"])? j["@type"] : [j["@type"]];
          if (t?.includes("FAQPage")) { const me=j.mainEntity; if (Array.isArray(me)) { valid=true; qas=Math.max(qas, me.length);} }
        });
      } catch(e:any){ errors.push(String(e)); }
    });
    const score = !valid?0 : qas>=3?100 : 70;
    return { id:"A4_schema_faqpage", scope:"page", score, status:statusFromScore(score), details:{valid,qas,errors} };
  },

  A9_internal_linking(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const host = input.site?.domain ?? "";
    const links = qa(doc, "a[href]") as Element[];
    const internals = links.map(a => (a as HTMLAnchorElement).getAttribute("href") || "").filter(h => isInternal(h, host));
    const count = internals.length;
    const anchors = internals.map((_, i) => txt(links[i] as Element)).filter(Boolean);
    const unique = new Set(anchors.map(a => a.toLowerCase())).size;
    const diversity = count ? unique / count : 0;
    const score = count>=10 && diversity>=0.4 ? 100 : count>=3 ? 60 : 20;
    return { id:"A9_internal_linking", scope:"page", score, status:statusFromScore(score), details:{count,unique,diversity}, evidence: anchors.slice(0,10) };
  },

  G10_canonical(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const el = q(doc, 'link[rel="canonical"]');
    if (!el) return { id:"G10_canonical", scope:"page", score:0, status:"fail", details:{reason:"missing"} };
    const href = attr(el,"href") || "";
    const host = input.site?.domain ?? "";
    let ok=false, sameHost=false;
    try{ const u=new URL(href); ok=!!(u.protocol&&u.hostname); sameHost = host? (u.hostname===host) : true; } catch {}
    const score = ok && sameHost ? 100 : ok ? 50 : 0;
    return { id:"G10_canonical", scope:"page", score, status:statusFromScore(score), details:{href,ok,sameHost} };
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
    const content = (robots && robots.getAttribute("content")) || "";
    const noindex = /noindex/i.test(content);
    const score = noindex?0:100;
    return { id:"T3_noindex_robots", scope:"page", score, status:statusFromScore(score), details:{robots:content} };
  },

  A12_entity_graph(input: CheckInput): CheckResult {
    const doc = input.__doc!;
    const scripts = qa(doc, 'script[type="application/ld+json"]');
    let org=false, logo=false, sameAs=0, nameMatch=false, name="";
    const title = txt(q(doc,"title")).toLowerCase();
    scripts.forEach(s=>{
      try{
        const json = JSON.parse(txt(s as Element));
        const items = Array.isArray(json)?json:[json];
        items.forEach(j=>{
          const t = Array.isArray(j["@type"])? j["@type"] : [j["@type"]];
          if (t?.includes("Organization") || t?.includes("LocalBusiness")) {
            org = true; name = j.name || name; logo = !!j.logo; sameAs = Math.max(sameAs, Array.isArray(j.sameAs)? j.sameAs.length : 0);
          }
        });
      } catch {}
    });
    nameMatch = !!(name && title.includes(String(name).toLowerCase()));
    const score = org ? ((logo?30:0) + (sameAs>=2?40: sameAs?20:0) + (nameMatch?30:10)) : 0;
    return { id:"A12_entity_graph", scope:"page", score, status:statusFromScore(score), details:{org,logo,sameAs,name,nameMatch} };
  },
};

export type CheckFn = (input: CheckInput) => CheckResult;


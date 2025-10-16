/**
 * v2.1 Scoring Engine with 5 pillars
 */

import { PILLAR_WEIGHTS, PillarScores, AnalysisExtract, VisibilityData } from "../types/audit";

type ScoringInputs = {
  pages: Array<AnalysisExtract & { status: number }>;
  robots: { gptbot: boolean; claude: boolean; perplexity: boolean; ccbot: boolean };
  sitemapPresent: boolean;
  visibility: VisibilityData;
};

export function computeScoresV21(input: ScoringInputs): PillarScores {
  const pageCount = input.pages.length || 1;

  // Crawlability (30% weight, 30 max points)
  let crawlPts = 0;
  crawlPts += (input.robots.gptbot && input.robots.claude && input.robots.perplexity && input.robots.ccbot) ? 6 : 0;
  crawlPts += input.sitemapPresent ? 6 : 0;
  crawlPts += ratio(input.pages.filter(p => depthLE1(p.url)).length, pageCount) * 4;
  crawlPts += ratio(input.pages.filter(p => p.status === 200).length, pageCount) * 4;
  crawlPts += ratio(input.pages.filter(p => !/noindex|nofollow/i.test(p.robots_meta || "")).length, pageCount) * 5;
  crawlPts += ratio(input.pages.filter(p => (p.canonical_url ?? p.url) === p.url).length, pageCount) * 5;
  const crawlability = (crawlPts / 30) * 100;

  // Structured (25% weight, 25 max points)
  let structPts = 0;
  structPts += ratio(input.pages.filter(p => p.has_jsonld).length, pageCount) * 5;
  structPts += ratio(input.pages.filter(p => p.schema_types.length > 0).length, pageCount) * 5;
  structPts += input.pages.some(p => p.faq_schema_present) ? 5 : 0;
  structPts += ratio(input.pages.filter(p => p.schema_types.some(t => ["Organization","Product","Article","WebSite"].includes(t))).length, pageCount) * 5;
  structPts += input.pages.some(p => p.faq_schema_present && p.schema_types.includes("Organization")) ? 5 : 0;
  const structured = (structPts / 25) * 100;

  // Answerability (20% weight, 20 max points)
  let ansPts = 0;
  ansPts += ratio(uniqueCount(input.pages.map(p => p.title)), pageCount) * 4;
  ansPts += ratio(uniqueCount(input.pages.map(p => p.h1)), pageCount) * 4;
  ansPts += ratio(input.pages.filter(p => readable(p.title, p.h1)).length, pageCount) * 3;
  ansPts += ratio(input.pages.filter(p => p.word_count >= 100).length, pageCount) * 4;
  ansPts += ratio(input.pages.filter(p => hasQAListOrDefinition(p)).length, pageCount) * 3;
  const answerability = (ansPts / 20) * 100;

  // Trust / EEAT (15% weight, 15 max points)
  let trustPts = 0;
  trustPts += ratio(input.pages.filter(p => !!p.author).length, pageCount) * 3;
  trustPts += ratio(input.pages.filter(p => !!p.date_published || !!p.date_modified).length, pageCount) * 3;
  trustPts += ratio(input.pages.filter(p => p.outbound_domains >= 1).length, pageCount) * 3;
  trustPts += ratio(input.pages.filter(p => p.https_ok && p.status === 200).length, pageCount) * 3;
  trustPts += ratio(input.pages.filter(p => (p.load_time_ms ?? 0) > 0 && (p.load_time_ms as number) < 3000).length, pageCount) * 3;
  const trust = (trustPts / 15) * 100;

  // Visibility (10% weight, 10 max points)
  let visPts = 0;
  visPts += Math.min(3, Math.round(input.visibility.bravePresence * 3));
  visPts += input.visibility.totalCitations > 0 ? Math.min(3, 1 + Math.floor(input.visibility.totalCitations / 3)) : 0;
  visPts += input.visibility.totalCitations > 0 ? 2 : 0;
  visPts += input.visibility.totalCitations >= 5 ? 2 : 0;
  const visibility = (visPts / 10) * 100;

  // Overall weighted score
  const overall =
    crawlability * PILLAR_WEIGHTS.crawlability +
    structured *   PILLAR_WEIGHTS.structured +
    answerability *PILLAR_WEIGHTS.answerability +
    trust *        PILLAR_WEIGHTS.trust +
    visibility *   PILLAR_WEIGHTS.visibility;

  return { crawlability, structured, answerability, trust, visibility, overall };
}

// Helper functions
function ratio(a: number, b: number): number { 
  return b ? a / b : 0; 
}

function depthLE1(u: string): boolean { 
  const n = new URL(u).pathname.split("/").filter(Boolean).length; 
  return n <= 1; 
}

function uniqueCount(arr: (string|undefined)[]): number {
  return new Set(arr.map(x => (x || "").trim()).filter(Boolean)).size;
}

function readable(t?: string, h?: string): boolean { 
  return !!(t && h && t.length > 5 && h.length > 2); 
}

function hasQAListOrDefinition(p: AnalysisExtract): boolean {
  return /\?/.test(p.title || p.h1 || "") || p.word_count > 200;
}

/**
 * Structured logging utilities for v2.1 scoring
 */

export interface AuditScoredEvent {
  evt: 'audit_scored';
  audit_id: string;
  domain: string;
  model: string;
  scores: {
    crawl: number;
    struct: number;
    ans: number;
    trust: number;
    vis?: number;
    overall: number;
  };
  pages: number;
  faq_pages: number;
  jsonld_pages: number;
  citations_total: number;
}

export function logAuditScored(event: AuditScoredEvent) {
  console.log(JSON.stringify(event));
}

export function logAuditMetrics(env: Env, auditId: string, domain: string, model: string, scores: any, analysisData: any[], citations: any[]) {
  const faqPages = analysisData.filter(p => p.faq_schema_present).length;
  const jsonldPages = analysisData.filter(p => p.has_jsonld).length;
  const citationsTotal = citations?.length || 0;

  logAuditScored({
    evt: 'audit_scored',
    audit_id: auditId,
    domain,
    model,
    scores: {
      crawl: scores.crawlability || 0,
      struct: scores.structured || 0,
      ans: scores.answerability || 0,
      trust: scores.trust || 0,
      vis: scores.visibility,
      overall: scores.overall || 0,
    },
    pages: analysisData.length,
    faq_pages: faqPages,
    jsonld_pages: jsonldPages,
    citations_total: citationsTotal,
  });
}

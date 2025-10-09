/**
 * Citations Engine
 * Track where domain appears in AI answer sources
 */

interface Env {
  DB: D1Database;
}

export interface Citation {
  engine: string;
  query: string;
  url: string;
  title: string | null;
  cited_at: number;
}

export async function fetchCitations(
  env: Env,
  auditId: string,
  domain: string
): Promise<Citation[]> {
  // MVP: Return empty array (stub)
  // Later: Integrate with TOS-compliant search APIs
  
  // Check if we have any citations stored for this audit
  const result = await env.DB.prepare(
    `SELECT engine, query, url, title, cited_at
     FROM citations
     WHERE audit_id = ?
     ORDER BY cited_at DESC`
  ).bind(auditId).all<Citation>();

  return result.results || [];
}

export async function storeCitation(
  env: Env,
  auditId: string,
  citation: Omit<Citation, 'cited_at'>
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO citations (audit_id, engine, query, url, title, cited_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    auditId,
    citation.engine,
    citation.query,
    citation.url,
    citation.title,
    Date.now()
  ).run();
}


/**
 * Citations Engine
 * Track where domain appears in AI answer sources
 */

import { fetchCitationsBrave } from './citations-brave';

interface Env {
  DB: D1Database;
  BRAVE_SEARCH?: string;
  BRAVE_SEARCH_ENDPOINT?: string;
  CITATIONS_MAX_PER_QUERY?: string;
  CITATIONS_DAILY_BUDGET?: string;
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
  domain: string,
  brand?: string,
  budgetCheck?: () => Promise<boolean>
): Promise<Citation[]> {
  // Check if we have any citations stored for this audit
  const existing = await env.DB.prepare(
    `SELECT engine, query, url, title, cited_at
     FROM citations
     WHERE audit_id = ?
     ORDER BY cited_at DESC`
  ).bind(auditId).all<Citation>();

  // If we have citations, return them
  if (existing.results && existing.results.length > 0) {
    return existing.results;
  }

  // Check budget before fetching (optional)
  if (budgetCheck) {
    const budgetOk = await budgetCheck();
    if (!budgetOk) {
      console.warn(`Citations budget exceeded for audit ${auditId}, skipping fetch`);
      return [];
    }
  }

  // Otherwise, try to fetch from Brave (best-effort, ignore errors)
  try {
    const braveCitations = await fetchCitationsBrave(env, domain, brand);
    
    // Store citations in database
    for (const citation of braveCitations) {
      await storeCitation(env, auditId, citation);
    }
    
    // Log result
    console.log(`citations {audit:${auditId}, found:${braveCitations.length}}`);
    
    return braveCitations;
  } catch (error) {
    console.warn('Failed to fetch Brave citations:', error);
    return [];
  }
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


/**
 * Citations Engine
 * Track where domain appears in AI answer sources
 */

import { fetchCitationsBing, type Citation as BingCitation } from './citations-bing';

interface Env {
  DB: D1Database;
  BING_SEARCH_KEY?: string;
  BING_SEARCH_ENDPOINT?: string;
  CITATIONS_MAX_PER_QUERY?: string;
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
  brand?: string
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

  // Otherwise, try to fetch from Bing (best-effort, ignore errors)
  try {
    const bingCitations = await fetchCitationsBing(env, domain, brand);
    
    // Store citations in database
    for (const citation of bingCitations) {
      await storeCitation(env, auditId, citation);
    }
    
    // Log result
    console.log(`citations {audit:${auditId}, found:${bingCitations.length}}`);
    
    return bingCitations;
  } catch (error) {
    console.warn('Failed to fetch Bing citations:', error);
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


import type { Env } from '../types';

export async function saveAnalysisRow(env: Env, a: {
  auditId: string, url: string,
  title?: string, meta_description?: string, canonical?: string, robots_meta?: string,
  h1?: string, h1_count: number, headings_h2: number, headings_h3: number,
  images: number, outbound_links: number, schema_types?: string, eeat_flags?: string,
  author?: string, date_published?: string, date_modified?: string, word_count?: number
}): Promise<{ ok: boolean; changes?: number; error?: string }> {
  try {
    const sql = `
      INSERT INTO audit_page_analysis (
        audit_id, url,
        h1, h1_count, title, meta_description, canonical, robots_meta,
        schema_types, author, date_published, date_modified,
        images, headings_h2, headings_h3, outbound_links, word_count,
        eeat_flags, analyzed_at
      ) VALUES (
        ?1,?2,
        ?3,?4,?5,?6,?7,?8,
        ?9,?10,?11,?12,
        ?13,?14,?15,?16,?17,
        ?18, datetime('now')
      )
      ON CONFLICT(audit_id, url) DO UPDATE SET
        h1=excluded.h1,
        h1_count=excluded.h1_count,
        title=excluded.title,
        meta_description=excluded.meta_description,
        canonical=excluded.canonical,
        robots_meta=excluded.robots_meta,
        schema_types=excluded.schema_types,
        author=excluded.author,
        date_published=excluded.date_published,
        date_modified=excluded.date_modified,
        images=excluded.images,
        headings_h2=excluded.headings_h2,
        headings_h3=excluded.headings_h3,
        outbound_links=excluded.outbound_links,
        word_count=excluded.word_count,
        eeat_flags=excluded.eeat_flags,
        analyzed_at=excluded.analyzed_at
    `;
    const res = await env.DB.prepare(sql).bind(
      a.auditId, a.url,
      a.h1 ?? null, a.h1_count ?? 0, a.title ?? null, a.meta_description ?? null, a.canonical ?? null, a.robots_meta ?? null,
      a.schema_types ?? null, a.author ?? null, a.date_published ?? null, a.date_modified ?? null,
      a.images ?? 0, a.headings_h2 ?? 0, a.headings_h3 ?? 0, a.outbound_links ?? 0, a.word_count ?? null,
      a.eeat_flags ?? null
    ).run();

    // Log & return explicit status
    console.log('ANALYSIS_UPSERT_OK', { url: a.url, changes: res?.changes ?? 0 });
    return { ok: true, changes: res?.changes ?? 0 };
  } catch (err: any) {
    const msg = (err?.message || String(err)).slice(0, 400);
    console.error('ANALYSIS_UPSERT_ERR', { url: a.url, error: msg });
    return { ok: false, error: msg };
  }
}

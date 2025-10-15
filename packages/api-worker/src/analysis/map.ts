import type { PageAnalysis } from './html-analyzer';

export function mapToDb(auditId: string, url: string, p: PageAnalysis) {
  return {
    auditId, url,
    title: p.title,
    meta_description: p.meta_description,
    canonical: p.canonical,
    robots_meta: p.robots,              // map name difference here
    h1: p.h1,
    h1_count: p.h1_count ?? 0,
    headings_h2: p.h2_count ?? 0,       // map h2_count → headings_h2
    headings_h3: p.h3_count ?? 0,       // map h3_count → headings_h3
    images: p.images ?? 0,
    outbound_links: p.outbound_links ?? 0,
    schema_types: p.schema_types,
    eeat_flags: p.eeat_flags,
    author: p.author,
    date_published: p.date_published,
    date_modified: p.date_modified,
    word_count: p.word_count
  };
}

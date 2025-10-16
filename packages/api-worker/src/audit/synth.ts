/**
 * Synthesis Phase - Run HTML analysis pipeline
 */

export async function runSynthTick(env: any, auditId: string): Promise<boolean> {
  console.log(`[Synth] Starting synthesis for audit ${auditId}`);
  
  try {
    // Get all crawled pages that haven't been analyzed yet
    // Use the data already extracted during crawling instead of re-parsing HTML
    const pages = await env.DB.prepare(`
      SELECT ap.audit_id, ap.url, ap.status_code, ap.title, ap.h1, ap.jsonld_count, 
             ap.faq_present, ap.word_count, ap.rendered_words, ap.snippet
      FROM audit_pages ap
      LEFT JOIN audit_page_analysis apa ON ap.audit_id = apa.audit_id AND ap.url = apa.url
      WHERE ap.audit_id = ? AND apa.url IS NULL
      LIMIT 10
    `).bind(auditId).all();

    if (!pages || !pages.results || pages.results.length === 0) {
      // Check if there are any pages at all in audit_pages
      const totalPages = await env.DB.prepare(`SELECT COUNT(*) as count FROM audit_pages WHERE audit_id = ?`).bind(auditId).first();
      const analyzedPages = await env.DB.prepare(`SELECT COUNT(*) as count FROM audit_page_analysis WHERE audit_id = ?`).bind(auditId).first();
      
      console.log(`[Synth] No pages to analyze for audit ${auditId} - total pages: ${totalPages?.count}, analyzed: ${analyzedPages?.count}`);
      
      if ((totalPages?.count || 0) > 0 && (analyzedPages?.count || 0) === 0) {
        console.log(`[Synth] WARNING: Found ${totalPages?.count} pages but none analyzed - forcing analysis`);
        // Force analysis of all pages using already-extracted data
        const allPages = await env.DB.prepare(`
          SELECT audit_id, url, status_code, title, h1, jsonld_count, faq_present, word_count, rendered_words, snippet
          FROM audit_pages WHERE audit_id = ? LIMIT 10
        `).bind(auditId).all();
        if (allPages && allPages.results && allPages.results.length > 0) {
          for (const page of allPages.results) {
            await analyzePageFromData(env, page.audit_id, page.url, page);
          }
          return false; // More work to do
        }
      }
      
      return true; // Indicate synthesis is complete
    }

    console.log(`[Synth] Analyzing ${pages.results.length} pages for audit ${auditId}`);

    for (const page of pages.results) {
      await analyzePageFromData(env, page.audit_id, page.url, page);
    }

    console.log(`[Synth] Completed analysis for ${pages.results.length} pages`);
    return false; // More work to do

  } catch (error) {
    console.error(`[Synth] Error in synthesis for audit ${auditId}:`, error);
    return false; // Error occurred, don't complete
  }
}

async function analyzePageFromData(env: any, auditId: string, url: string, pageData: any): Promise<void> {
  try {
    console.log(`[Synth] Analyzing page from data: ${url}`);
    
    // Use data already extracted during crawling
    const analysis = {
      h1: pageData.h1 || '',
      h1_count: pageData.h1 ? 1 : 0, // We only store one H1 per page
      title: pageData.title || '',
      meta_description: '', // Not extracted during crawling
      canonical: '', // Not extracted during crawling
      robots_meta: '', // Not extracted during crawling
      schema_types: pageData.jsonld_count > 0 ? 'Organization' : '', // Basic schema detection
      author: '', // Not extracted during crawling
      date_published: '', // Not extracted during crawling
      date_modified: '', // Not extracted during crawling
      images: 0, // Not extracted during crawling
      headings_h2: 0, // Not extracted during crawling
      headings_h3: 0, // Not extracted during crawling
      outbound_links: 0, // Not extracted during crawling
      word_count: pageData.word_count || pageData.rendered_words || 0,
      eeat_flags: '' // Will be set after analysis object is created
    };

    // Calculate EEAT flags based on available data
    analysis.eeat_flags = extractEEATFlagsFromData(analysis, pageData);

    console.log(`[Synth] Extracted data for ${url}:`, {
      title: analysis.title,
      h1: analysis.h1,
      h1_count: analysis.h1_count,
      word_count: analysis.word_count,
      schema_types: analysis.schema_types
    });

    // Insert analysis data
    await env.DB.prepare(`
      INSERT INTO audit_page_analysis (
        audit_id, url, h1, h1_count, title, meta_description, canonical, robots_meta,
        schema_types, author, date_published, date_modified, images, headings_h2, 
        headings_h3, outbound_links, word_count, eeat_flags, analyzed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(audit_id, url) DO UPDATE SET
        h1 = excluded.h1, h1_count = excluded.h1_count, title = excluded.title,
        meta_description = excluded.meta_description, canonical = excluded.canonical,
        robots_meta = excluded.robots_meta, schema_types = excluded.schema_types,
        author = excluded.author, date_published = excluded.date_published,
        date_modified = excluded.date_modified, images = excluded.images,
        headings_h2 = excluded.headings_h2, headings_h3 = excluded.headings_h3,
        outbound_links = excluded.outbound_links, word_count = excluded.word_count,
        eeat_flags = excluded.eeat_flags, analyzed_at = CURRENT_TIMESTAMP
    `).bind(
      auditId, url, analysis.h1, analysis.h1_count, analysis.title, 
      analysis.meta_description, analysis.canonical, analysis.robots_meta,
      analysis.schema_types, analysis.author, analysis.date_published,
      analysis.date_modified, analysis.images, analysis.headings_h2,
      analysis.headings_h3, analysis.outbound_links, analysis.word_count,
      analysis.eeat_flags
    ).run();

    console.log(`[Synth] Analyzed page: ${url}`);

  } catch (error) {
    console.error(`[Synth] Error analyzing page ${url}:`, error);
  }
}

// Helper function for EEAT flag extraction from already-extracted data
function extractEEATFlagsFromData(analysis: any, pageData: any): string {
  const flags = [];
  
  // Basic EEAT flags based on available data
  if (analysis.h1_count > 1) flags.push('MULTI_H1');
  if (analysis.h1_count === 0) flags.push('NO_H1');
  if (analysis.schema_types && analysis.schema_types.includes('Organization')) flags.push('HAS_ORGANIZATION');
  if (pageData.faq_present) flags.push('HAS_FAQ');
  if (pageData.jsonld_count > 0) flags.push('HAS_JSONLD');
  
  return flags.join(',');
}

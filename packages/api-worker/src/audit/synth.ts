/**
 * Synthesis Phase - Run HTML analysis pipeline
 */

export async function runSynthTick(env: any, auditId: string): Promise<boolean> {
  console.log(`[Synth] Starting synthesis for audit ${auditId}`);
  
  try {
    // Get all crawled pages that haven't been analyzed yet
    const pages = await env.DB.prepare(`
      SELECT ap.audit_id, ap.url, ap.body_text, ap.status_code
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
        // Force analysis of all pages
        const allPages = await env.DB.prepare(`SELECT audit_id, url, body_text, status_code FROM audit_pages WHERE audit_id = ? LIMIT 10`).bind(auditId).all();
        if (allPages && allPages.results && allPages.results.length > 0) {
          for (const page of allPages.results) {
            await analyzePage(env, page.audit_id, page.url, page.body_text);
          }
          return false; // More work to do
        }
      }
      
      return true; // Indicate synthesis is complete
    }

    console.log(`[Synth] Analyzing ${pages.results.length} pages for audit ${auditId}`);

    for (const page of pages.results) {
      await analyzePage(env, page.audit_id, page.url, page.body_text);
    }

    console.log(`[Synth] Completed analysis for ${pages.results.length} pages`);
    return false; // More work to do

  } catch (error) {
    console.error(`[Synth] Error in synthesis for audit ${auditId}:`, error);
    return false; // Error occurred, don't complete
  }
}

async function analyzePage(env: any, auditId: string, url: string, html: string): Promise<void> {
  try {
    console.log(`[Synth] Analyzing page: ${url}, HTML length: ${html?.length || 0}`);
    
    if (!html || html.length === 0) {
      console.log(`[Synth] WARNING: No HTML content for ${url}`);
      return;
    }
    
    // Basic HTML analysis
    const analysis = {
      h1: extractH1(html),
      h1_count: countH1s(html),
      title: extractTitle(html),
      meta_description: extractMetaDescription(html),
      canonical: extractCanonical(html),
      robots_meta: extractRobotsMeta(html),
      schema_types: extractSchemaTypes(html),
      author: extractAuthor(html),
      date_published: extractDatePublished(html),
      date_modified: extractDateModified(html),
      images: countImages(html),
      headings_h2: countHeadings(html, 'h2'),
      headings_h3: countHeadings(html, 'h3'),
      outbound_links: countOutboundLinks(html),
      word_count: countWords(html),
      eeat_flags: '' // Will be set after analysis object is created
    };

    // Calculate EEAT flags after analysis object is fully created
    analysis.eeat_flags = extractEEATFlags(html, analysis);

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

// Helper functions for HTML analysis
function extractH1(html: string): string {
  const match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  return match ? match[1].trim() : '';
}

function countH1s(html: string): number {
  const matches = html.match(/<h1[^>]*>/gi);
  return matches ? matches.length : 0;
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

function extractMetaDescription(html: string): string {
  const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i);
  return match ? match[1].trim() : '';
}

function extractCanonical(html: string): string {
  const match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)/i);
  return match ? match[1].trim() : '';
}

function extractRobotsMeta(html: string): string {
  const match = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)/i);
  return match ? match[1].trim() : '';
}

function extractSchemaTypes(html: string): string {
  const types = new Set<string>();
  const matches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
  
  if (matches) {
    for (const match of matches) {
      try {
        const jsonMatch = match.match(/<script[^>]*>(.*?)<\/script>/is);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[1]);
          if (data['@type']) {
            types.add(data['@type']);
          }
          if (data['@graph']) {
            for (const item of data['@graph']) {
              if (item['@type']) {
                types.add(item['@type']);
              }
            }
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }
  
  return Array.from(types).join(',');
}

function extractAuthor(html: string): string {
  // Look for author in schema.org or meta tags
  const schemaMatch = html.match(/"author":\s*{\s*"@type":\s*"Person",\s*"name":\s*"([^"]*)/i);
  if (schemaMatch) return schemaMatch[1];
  
  const metaMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']*)/i);
  return metaMatch ? metaMatch[1].trim() : '';
}

function extractDatePublished(html: string): string {
  const match = html.match(/"datePublished":\s*"([^"]*)/i);
  return match ? match[1] : '';
}

function extractDateModified(html: string): string {
  const match = html.match(/"dateModified":\s*"([^"]*)/i);
  return match ? match[1] : '';
}

function countImages(html: string): number {
  const matches = html.match(/<img[^>]*>/gi);
  return matches ? matches.length : 0;
}

function countHeadings(html: string, tag: string): number {
  const regex = new RegExp(`<${tag}[^>]*>`, 'gi');
  const matches = html.match(regex);
  return matches ? matches.length : 0;
}

function countOutboundLinks(html: string): number {
  const matches = html.match(/<a[^>]*href=["']https?:\/\/(?!.*apple\.com)[^"']*["'][^>]*>/gi);
  return matches ? matches.length : 0;
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.split(' ').filter(word => word.length > 0).length;
}

function extractEEATFlags(html: string, analysis: any): string {
  const flags = [];
  
  if (analysis.author) flags.push('HAS_AUTHOR');
  if (analysis.h1_count > 1) flags.push('MULTI_H1');
  if (analysis.h1_count === 0) flags.push('NO_H1');
  if (analysis.date_published) flags.push('HAS_DATE');
  if (analysis.schema_types && analysis.schema_types.includes('Organization')) flags.push('HAS_ORGANIZATION');
  
  return flags.join(',');
}

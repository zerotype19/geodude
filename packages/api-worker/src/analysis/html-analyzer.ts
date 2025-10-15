export type PageAnalysis = {
  title?: string;
  meta_description?: string;
  canonical?: string;
  robots?: string;
  h1?: string;
  h1_count: number;
  h2_count: number;
  h3_count: number;
  images: number;
  outbound_links: number;
  schema_types?: string;       // comma-separated
  author?: string;
  date_published?: string;
  date_modified?: string;
  word_count: number;
  eeat_flags?: string;         // CSV of HAS_AUTHOR,HAS_DATES, etc.
};

export function analyzeHtml(html: string, url?: string): PageAnalysis {
  const start = Date.now();
  const out: PageAnalysis = { h1_count:0, h2_count:0, h3_count:0, images:0, outbound_links:0, word_count:0 };

  // Fast-prep: limit size and strip scripts/styles (but preserve JSON-LD)
  const limited = html.length > 1_500_000 ? html.slice(0, 1_500_000) : html;
  
  // Extract JSON-LD BEFORE stripping scripts
  const ldMatches = [...limited.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  
  // Now strip scripts/styles for other analysis
  const noscript = limited.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
                          .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');

  // Title
  const mTitle = noscript.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  out.title = mTitle?.[1]?.trim() || undefined;

  // Meta description
  const mDesc = noscript.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)
         || noscript.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  out.meta_description = mDesc?.[1]?.trim() || undefined;

  // Canonical
  const mCanon = noscript.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  out.canonical = mCanon?.[1]?.trim();

  // Robots
  const mRobots = noscript.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  out.robots = mRobots?.[1]?.trim();

  // Headings (counts + first H1 text)
  const h1Matches = noscript.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  out.h1_count = h1Matches.length;
  if (h1Matches.length) {
    const first = h1Matches[0].replace(/<[^>]+>/g,'').trim();
    out.h1 = first || undefined;
  }
  out.h2_count = (noscript.match(/<h2\b[^>]*>/gi) || []).length;
  out.h3_count = (noscript.match(/<h3\b[^>]*>/gi) || []).length;

  // Images
  out.images = (noscript.match(/<img\b[^>]*>/gi) || []).length;

  // Outbound links
  out.outbound_links = (noscript.match(/<a\b[^>]*href=["']https?:\/\//gi) || []).length;

  // Word count (rough estimate)
  const textContent = noscript.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  out.word_count = textContent.split(' ').filter(w => w.length > 0).length;

  // JSON-LD schema types and metadata (already extracted above)
  const types: string[] = [];
  let jsonldBlocks = 0;
  let jsonldItems = 0;

  // Extract author and dates from JSON-LD
  let author = '';
  let datePublished = '';
  let dateModified = '';
  
  for (let i=0; i<ldMatches.length && i<8; i++) {
    jsonldBlocks++;
    const blockContent = ldMatches[i][1];
    
    // Skip oversized blocks (>200KB)
    if (blockContent.length > 200000) {
      console.warn(`ANALYZE_JSONLD_OVERSIZED { url: '${url || 'unknown'}', size: ${blockContent.length} }`);
      continue;
    }
    
    try {
      const json = JSON.parse(blockContent);
      jsonldItems++;
      
      const collect = (node:any) => {
        if (!node) return;
        
        // Extract schema types
        const t = node['@type'];
        if (typeof t === 'string') types.push(t);
        else if (Array.isArray(t)) types.push(...t.filter(Boolean));
        
        // Extract metadata
        if (node.author && !author) {
          author = typeof node.author === 'string' ? node.author : node.author.name || '';
        }
        if (node.datePublished && !datePublished) datePublished = node.datePublished;
        if (node.dateModified && !dateModified) dateModified = node.dateModified;
        
        // Recursively process nested objects
        if (Array.isArray(node)) node.forEach(collect);
        if (node.itemListElement) collect(node.itemListElement);
        if (node.mainEntity) collect(node.mainEntity);
        if (node.graph) collect(node.graph);
        if (node["@graph"]) collect(node["@graph"]);
      };
      collect(json);
    } catch (err: any) {
      console.warn(`ANALYZE_JSONLD_ERR { url: '${url || 'unknown'}', error: '${err.message}' }`);
    }
  }
  
  // Log JSON-LD findings
  if (jsonldBlocks > 0) {
    console.log(`ANALYZE_JSONLD_FOUND { blocks: ${jsonldBlocks}, items: ${jsonldItems}, types: [${types.join(',')}] }`);
  }
  
  if (types.length) out.schema_types = [...new Set(types)].join(',');
  out.author = author || undefined;
  out.date_published = datePublished || undefined;
  out.date_modified = dateModified || undefined;

  // E-E-A-T heuristics
  const hasAuthor = /itemprop=["']author["']|rel=["']author["']|class=["'][^"']*author[^"']*["']/i.test(noscript)
    || /"author"\s*:\s*{/i.test(noscript);
  const hasDates = /datePublished|dateModified|datetime=/i.test(noscript)
    || /"datePublished"\s*:\s*"/i.test(noscript);
  const hasMedia = /<img\b|<video\b|<figure\b/i.test(noscript);
  const hasCitations = /<sup\b[^>]*>\[[0-9]+\]<\/sup>|<ol\b[^>]*class=["']references/i.test(noscript)
    || /https?:\/\/(doi\.org|arxiv\.org|pubmed|scholar\.google|wikipedia\.org)\//i.test(noscript);
  const flags:string[] = [];
  if (hasAuthor) flags.push('HAS_AUTHOR');
  if (hasDates) flags.push('HAS_DATES');
  if (hasMedia) flags.push('HAS_MEDIA');
  if (hasCitations) flags.push('HAS_CITATIONS');
  if (flags.length) out.eeat_flags = flags.join(',');

  // Log performance (optional)
  const duration = Date.now() - start;
  if (duration > 75) {
    console.warn(`HTML analysis took ${duration}ms for ${html.length} chars`);
  }

  return out;
}

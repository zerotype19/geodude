/**
 * Phase F+: Smart Query Builder
 * Generates 30-50 queries across multiple buckets for comprehensive Brave AI coverage
 */

/**
 * Detect site type based on domain, brand, and page content
 */
function detectSiteType(domain: string, brand: string, pages?: PageData[]): 'entertainment' | 'healthcare' | 'ecommerce' | 'generic' {
  const domainLower = domain.toLowerCase();
  const brandLower = brand.toLowerCase();
  
  // Entertainment keywords
  const entertainmentKeywords = [
    'awards', 'radar', 'film', 'movie', 'tv', 'television', 'cinema', 'review', 'entertainment',
    'oscar', 'emmy', 'golden', 'globes', 'sundance', 'cannes', 'festival', 'premiere',
    'actor', 'actress', 'director', 'producer', 'screenplay', 'cinematography'
  ];
  
  // Healthcare keywords  
  const healthcareKeywords = [
    'health', 'medical', 'doctor', 'patient', 'clinic', 'hospital', 'pharmacy', 'drug',
    'medicine', 'treatment', 'therapy', 'diagnosis', 'prescription', 'insurance',
    'cologuard', 'stripe', 'payment', 'billing'
  ];
  
  // E-commerce keywords
  const ecommerceKeywords = [
    'shop', 'store', 'buy', 'sell', 'product', 'cart', 'checkout', 'shipping',
    'pricing', 'price', 'cost', 'purchase', 'order', 'delivery'
  ];
  
  // Check domain and brand
  const textToCheck = `${domainLower} ${brandLower}`;
  
  if (entertainmentKeywords.some(keyword => textToCheck.includes(keyword))) {
    return 'entertainment';
  }
  
  if (healthcareKeywords.some(keyword => textToCheck.includes(keyword))) {
    return 'healthcare';
  }
  
  if (ecommerceKeywords.some(keyword => textToCheck.includes(keyword))) {
    return 'ecommerce';
  }
  
  // Check page content if available
  if (pages && pages.length > 0) {
    const pageText = pages.slice(0, 5).map(p => `${p.title || ''} ${p.h1 || ''}`).join(' ').toLowerCase();
    
    if (entertainmentKeywords.some(keyword => pageText.includes(keyword))) {
      return 'entertainment';
    }
    
    if (healthcareKeywords.some(keyword => pageText.includes(keyword))) {
      return 'healthcare';
    }
    
    if (ecommerceKeywords.some(keyword => pageText.includes(keyword))) {
      return 'ecommerce';
    }
  }
  
  return 'generic';
}

export type QueryBucket =
  | 'brand_core'        // "{brand}", "site:{domain}", "{brand} faq"
  | 'product_how_to'    // "how to use {brand}", "how {brand} works"
  | 'jobs_to_be_done'   // "{brand} for {audience}", "{problem} and {brand}"
  | 'schema_probes'     // "faq about {brand}", "is {brand} covered"
  | 'content_seeds'     // Top page titles/H1s
  | 'competitive';      // "{brand} vs {competitor}"

export type SmartQuery = {
  q: string;
  bucket: QueryBucket;
  weight: number; // 1-5, higher = more important
  source: 'template' | 'title' | 'h1' | 'path';
};

export interface QueryBuilderOptions {
  domain: string;
  brand: string;
  pages: Array<{ url: string; title?: string; h1?: string }>;
  strategy?: 'basic' | 'smart' | 'aggressive';
  maxQueries?: number;
  enableCompare?: boolean;
}

/**
 * Infer brand name from domain if not provided
 */
function inferBrand(domain: string): string {
  return domain
    .replace(/^www\./, '')
    .replace(/\.(com|net|org|io|ai|co)$/i, '')
    .split('.')[0]
    .replace(/-/g, ' ')
    .trim();
}

/**
 * Build smart queries across all buckets
 */
export function buildSmartQueries(opts: QueryBuilderOptions): SmartQuery[] {
  const {
    domain,
    brand: rawBrand,
    pages,
    strategy = 'smart',
    maxQueries = 50,
    enableCompare = false,
  } = opts;

  const brand = rawBrand || inferBrand(domain);
  const queries: SmartQuery[] = [];

  // 1. Brand Core (always include, highest weight)
  queries.push(
    { q: `site:${domain}`, bucket: 'brand_core', weight: 5, source: 'template' },
    { q: brand, bucket: 'brand_core', weight: 5, source: 'template' },
    { q: `${brand} faq`, bucket: 'brand_core', weight: 4, source: 'template' },
    { q: `${brand} pricing`, bucket: 'brand_core', weight: 4, source: 'template' },
    { q: `${brand} alternatives`, bucket: 'competitive', weight: 3, source: 'template' },
    { q: `${brand} vs`, bucket: 'competitive', weight: 3, source: 'template' }
  );

  // 2. Product How-To (smart/aggressive only)
  if (strategy !== 'basic') {
    queries.push(
      { q: `how to use ${brand}`, bucket: 'product_how_to', weight: 4, source: 'template' },
      { q: `how ${brand} works`, bucket: 'product_how_to', weight: 4, source: 'template' },
      { q: `${brand} setup`, bucket: 'product_how_to', weight: 3, source: 'template' },
      { q: `${brand} eligibility`, bucket: 'schema_probes', weight: 3, source: 'template' },
      { q: `${brand} coverage`, bucket: 'schema_probes', weight: 3, source: 'template' }
    );
  }

  // 3. Jobs to Be Done (domain-aware)
  if (strategy !== 'basic') {
    const siteType = detectSiteType(domain, brand, pages);
    
    if (siteType === 'entertainment') {
      queries.push(
        { q: `${brand} benefits`, bucket: 'jobs_to_be_done', weight: 3, source: 'template' },
        { q: `why use ${brand}`, bucket: 'jobs_to_be_done', weight: 3, source: 'template' },
        { q: `${brand} for film fans`, bucket: 'jobs_to_be_done', weight: 2, source: 'template' },
        { q: `${brand} coverage`, bucket: 'jobs_to_be_done', weight: 2, source: 'template' }
      );
    } else if (siteType === 'healthcare') {
      queries.push(
        { q: `${brand} benefits`, bucket: 'jobs_to_be_done', weight: 3, source: 'template' },
        { q: `why use ${brand}`, bucket: 'jobs_to_be_done', weight: 3, source: 'template' },
        { q: `${brand} for patients`, bucket: 'jobs_to_be_done', weight: 2, source: 'template' },
        { q: `${brand} results`, bucket: 'jobs_to_be_done', weight: 2, source: 'template' }
      );
    } else if (siteType === 'ecommerce') {
      queries.push(
        { q: `${brand} benefits`, bucket: 'jobs_to_be_done', weight: 3, source: 'template' },
        { q: `why use ${brand}`, bucket: 'jobs_to_be_done', weight: 3, source: 'template' },
        { q: `${brand} for customers`, bucket: 'jobs_to_be_done', weight: 2, source: 'template' },
        { q: `${brand} features`, bucket: 'jobs_to_be_done', weight: 2, source: 'template' }
      );
    } else {
      queries.push(
        { q: `${brand} benefits`, bucket: 'jobs_to_be_done', weight: 3, source: 'template' },
        { q: `why use ${brand}`, bucket: 'jobs_to_be_done', weight: 3, source: 'template' },
        { q: `${brand} features`, bucket: 'jobs_to_be_done', weight: 2, source: 'template' },
        { q: `${brand} results`, bucket: 'jobs_to_be_done', weight: 2, source: 'template' }
      );
    }
  }

  // 4. Schema Probes (domain-aware)
  if (strategy !== 'basic') {
    // Detect site type from domain/pages to generate appropriate queries
    const siteType = detectSiteType(domain, brand, pages);
    
    if (siteType === 'entertainment') {
      queries.push(
        { q: `faq about ${brand}`, bucket: 'schema_probes', weight: 3, source: 'template' },
        { q: `${brand} reviews`, bucket: 'schema_probes', weight: 3, source: 'template' },
        { q: `${brand} awards`, bucket: 'schema_probes', weight: 3, source: 'template' },
        { q: `${brand} predictions`, bucket: 'schema_probes', weight: 2, source: 'template' }
      );
    } else if (siteType === 'healthcare') {
      queries.push(
        { q: `faq about ${brand}`, bucket: 'schema_probes', weight: 3, source: 'template' },
        { q: `is ${brand} covered by insurance`, bucket: 'schema_probes', weight: 3, source: 'template' },
        { q: `does ${brand} require prescription`, bucket: 'schema_probes', weight: 2, source: 'template' },
        { q: `${brand} cost`, bucket: 'schema_probes', weight: 3, source: 'template' }
      );
    } else if (siteType === 'ecommerce') {
      queries.push(
        { q: `faq about ${brand}`, bucket: 'schema_probes', weight: 3, source: 'template' },
        { q: `${brand} shipping`, bucket: 'schema_probes', weight: 3, source: 'template' },
        { q: `${brand} return policy`, bucket: 'schema_probes', weight: 2, source: 'template' },
        { q: `${brand} reviews`, bucket: 'schema_probes', weight: 3, source: 'template' }
      );
    } else {
      // Generic fallback
      queries.push(
        { q: `faq about ${brand}`, bucket: 'schema_probes', weight: 3, source: 'template' },
        { q: `${brand} reviews`, bucket: 'schema_probes', weight: 3, source: 'template' },
        { q: `${brand} pricing`, bucket: 'schema_probes', weight: 2, source: 'template' },
        { q: `${brand} support`, bucket: 'schema_probes', weight: 3, source: 'template' }
      );
    }
  }

  // 5. Content Seeds (from page titles/H1s)
  if (pages && pages.length > 0) {
    // Extract meaningful titles (not too short, not too long)
    const meaningfulTitles = pages
      .map((p) => {
        const title = p.title || p.h1 || '';
        return title.trim();
      })
      .filter((t) => t.length > 10 && t.length < 100 && !t.toLowerCase().includes('home'))
      .slice(0, 10); // Top 10 titles

    meaningfulTitles.forEach((title) => {
      queries.push({
        q: title,
        bucket: 'content_seeds',
        weight: 2,
        source: 'title',
      });
    });

    // Extract path-based queries
    pages.forEach((p) => {
      try {
        const pathname = new URL(p.url).pathname;
        if (pathname.includes('/faq')) {
          queries.push({
            q: `${brand} frequently asked questions`,
            bucket: 'schema_probes',
            weight: 4,
            source: 'path',
          });
        } else if (pathname.includes('/pricing')) {
          queries.push({
            q: `${brand} pricing plans`,
            bucket: 'brand_core',
            weight: 4,
            source: 'path',
          });
        } else if (pathname.includes('/how')) {
          queries.push({
            q: `how ${brand} works`,
            bucket: 'product_how_to',
            weight: 4,
            source: 'path',
          });
        }
      } catch (e) {
        // Skip invalid URLs
      }
    });
  }

  // 6. Aggressive: More permutations
  if (strategy === 'aggressive') {
    queries.push(
      { q: `${brand} reviews`, bucket: 'jobs_to_be_done', weight: 2, source: 'template' },
      { q: `${brand} complaints`, bucket: 'jobs_to_be_done', weight: 1, source: 'template' },
      { q: `${brand} accuracy`, bucket: 'jobs_to_be_done', weight: 2, source: 'template' },
      { q: `${brand} instructions`, bucket: 'product_how_to', weight: 2, source: 'template' },
      { q: `${brand} shipping`, bucket: 'schema_probes', weight: 1, source: 'template' },
      { q: `${brand} customer service`, bucket: 'schema_probes', weight: 1, source: 'template' }
    );
  }

  // 7. Competitive (if enabled)
  if (enableCompare) {
    // Extract potential competitor names from titles/H1s (heuristic)
    const competitors = extractCompetitors(pages, brand);
    competitors.slice(0, 3).forEach((comp) => {
      queries.push({
        q: `${brand} vs ${comp}`,
        bucket: 'competitive',
        weight: 2,
        source: 'template',
      });
    });
  }

  // Deduplicate & sort
  const seen = new Set<string>();
  const deduped = queries.filter((q) => {
    const key = normalizeQuery(q.q);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by weight (descending), then cap
  return deduped.sort((a, b) => b.weight - a.weight).slice(0, maxQueries);
}

/**
 * Normalize query for deduplication
 */
function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Extract potential competitor names from content (heuristic)
 */
function extractCompetitors(
  pages: Array<{ title?: string; h1?: string }>,
  brand: string
): string[] {
  const brandLower = brand.toLowerCase();
  const competitors = new Set<string>();

  pages.forEach((p) => {
    const text = `${p.title || ''} ${p.h1 || ''}`.toLowerCase();

    // Look for " vs " patterns
    const vsMatch = text.match(/(\w+)\s+vs\s+(\w+)/i);
    if (vsMatch) {
      const [, a, b] = vsMatch;
      if (a.toLowerCase() !== brandLower) competitors.add(capitalize(a));
      if (b.toLowerCase() !== brandLower) competitors.add(capitalize(b));
    }

    // Look for "alternatives to X" patterns
    const altMatch = text.match(/alternatives?\s+to\s+(\w+)/i);
    if (altMatch && altMatch[1].toLowerCase() !== brandLower) {
      competitors.add(capitalize(altMatch[1]));
    }
  });

  return Array.from(competitors).slice(0, 5);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}


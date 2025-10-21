/**
 * G11: Entity Graph Completeness (Shadow Mode)
 * 
 * Detects whether important entities (Org/Product/Person/HowTo/FAQ/Article)
 * are interlinked and represented in schema.
 * 
 * Checks:
 * - Orphan rate (pages with no inbound links)
 * - Entity hub presence (About/Org page linking to key entities)
 * - Schema presence ratio (% pages with schema)
 * 
 * Scoring:
 * 3 = Strong graph: low orphan rate, hub present, high schema coverage
 * 2 = Good graph: some connectivity, partial schema
 * 1 = Weak graph: many orphans or missing hub
 * 0 = Poor graph: disconnected pages, no schema structure
 */

export interface PageNode {
  url: string;
  types: string[];        // Schema @type values
  links: string[];        // Internal links (normalized URLs)
  links_in: number;       // Count of inbound links
  is_hub: boolean;        // True if this is an entity hub (About/Org page)
}

export interface EntityGraphResult {
  score: number;          // 0-3
  found: boolean;
  metrics: {
    total_pages: number;
    orphan_count: number;
    orphan_rate: number;
    hub_pages: number;
    schema_coverage: number;  // 0-1
    avg_links_per_page: number;
  };
  evidence: {
    orphan_urls: string[];
    hub_urls: string[];
    schema_types: Record<string, number>;  // Type → count
  };
}

/**
 * Build entity graph from audit pages
 */
export function buildEntityGraph(pages: Array<{
  url: string;
  jsonld?: any[];
  internal_links?: string[];
}>): Map<string, PageNode> {
  const graph = new Map<string, PageNode>();

  // First pass: build nodes
  for (const page of pages) {
    const types = extractSchemaTypes(page.jsonld || []);
    const links = (page.internal_links || []).map(normalizeGraphUrl);
    
    graph.set(normalizeGraphUrl(page.url), {
      url: page.url,
      types,
      links,
      links_in: 0,
      is_hub: false
    });
  }

  // Second pass: count inbound links
  for (const node of graph.values()) {
    for (const targetUrl of node.links) {
      const target = graph.get(targetUrl);
      if (target) {
        target.links_in++;
      }
    }
  }

  // Third pass: identify hubs
  for (const node of graph.values()) {
    node.is_hub = isEntityHub(node);
  }

  return graph;
}

/**
 * Analyze entity graph and compute score
 */
export function analyzeEntityGraph(graph: Map<string, PageNode>): EntityGraphResult {
  const metrics = {
    total_pages: graph.size,
    orphan_count: 0,
    orphan_rate: 0,
    hub_pages: 0,
    schema_coverage: 0,
    avg_links_per_page: 0
  };

  const evidence = {
    orphan_urls: [] as string[],
    hub_urls: [] as string[],
    schema_types: {} as Record<string, number>
  };

  let total_links = 0;
  let pages_with_schema = 0;

  // Analyze nodes
  for (const node of graph.values()) {
    // Orphans
    if (node.links_in === 0 && node.url !== '/') {  // Exclude homepage
      metrics.orphan_count++;
      if (evidence.orphan_urls.length < 10) {  // Limit to 10 examples
        evidence.orphan_urls.push(node.url);
      }
    }

    // Hubs
    if (node.is_hub) {
      metrics.hub_pages++;
      evidence.hub_urls.push(node.url);
    }

    // Schema
    if (node.types.length > 0) {
      pages_with_schema++;
      for (const type of node.types) {
        evidence.schema_types[type] = (evidence.schema_types[type] || 0) + 1;
      }
    }

    // Links
    total_links += node.links.length;
  }

  // Compute metrics
  metrics.orphan_rate = metrics.total_pages > 0 
    ? metrics.orphan_count / metrics.total_pages 
    : 0;
  metrics.schema_coverage = metrics.total_pages > 0 
    ? pages_with_schema / metrics.total_pages 
    : 0;
  metrics.avg_links_per_page = metrics.total_pages > 0 
    ? total_links / metrics.total_pages 
    : 0;

  // Compute score (0-3)
  // Component 1: Connectivity (1 - orphan rate)
  const connectivityScore = Math.min(1, 1 - metrics.orphan_rate);
  
  // Component 2: Hub presence
  const hubScore = metrics.hub_pages > 0 ? 1 : 0.5;
  
  // Component 3: Schema coverage
  const schemaScore = metrics.schema_coverage;

  // Weighted average
  const rawScore = (connectivityScore * 0.4) + (hubScore * 0.3) + (schemaScore * 0.3);
  
  // Convert to 0-3 scale
  let score = 0;
  if (rawScore >= 0.85) score = 3;
  else if (rawScore >= 0.65) score = 2;
  else if (rawScore >= 0.40) score = 1;
  else score = 0;

  return {
    score,
    found: score > 0,
    metrics,
    evidence
  };
}

/**
 * Extract schema types from JSON-LD
 */
function extractSchemaTypes(jsonld: any[]): string[] {
  const types = new Set<string>();

  for (const item of jsonld) {
    if (!item || typeof item !== 'object') continue;

    const type = item['@type'];
    if (type) {
      if (Array.isArray(type)) {
        type.forEach(t => types.add(t));
      } else if (typeof type === 'string') {
        types.add(type);
      }
    }
  }

  return Array.from(types);
}

/**
 * Check if a node is an entity hub (About/Org/Company page)
 */
function isEntityHub(node: PageNode): boolean {
  // Check URL patterns
  const url = node.url.toLowerCase();
  const isHubUrl = /\/(about|company|organization|org|who-we-are|team|contact)($|\/)/.test(url);

  // Check schema types
  const hasOrgSchema = node.types.includes('Organization') || 
                       node.types.includes('Corporation') ||
                       node.types.includes('LocalBusiness');

  // Check outbound links to key entities
  const hasKeyLinks = node.links.length >= 5;  // Hubs typically link to many pages

  // Hub if: (hub URL OR org schema) AND links to multiple pages
  return (isHubUrl || hasOrgSchema) && hasKeyLinks;
}

/**
 * Normalize URL for graph matching
 */
function normalizeGraphUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash, lowercase path
    let path = parsed.pathname.toLowerCase();
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }
    return `${parsed.origin}${path}`;
  } catch (e) {
    return url;
  }
}

/**
 * Check if a specific page is an orphan
 */
export function isOrphanPage(graph: Map<string, PageNode>, url: string): boolean {
  const normalizedUrl = normalizeGraphUrl(url);
  const node = graph.get(normalizedUrl);
  return node ? node.links_in === 0 : false;
}

/**
 * Check if a specific page is a hub
 */
export function isHubPage(graph: Map<string, PageNode>, url: string): boolean {
  const normalizedUrl = normalizeGraphUrl(url);
  const node = graph.get(normalizedUrl);
  return node ? node.is_hub : false;
}


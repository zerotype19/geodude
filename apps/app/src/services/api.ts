const API_BASE = (import.meta.env.VITE_API_BASE as string) || "https://api.optiview.ai";

export type AuditIssue = { 
  category: string; 
  severity: string; 
  code: string; 
  message: string; 
  url?: string;
};

export type EEATSignals = {
  hasAuthor?: boolean;
  hasDates?: boolean;
  httpsOk?: boolean;
  hasMetaDescription?: boolean;
};

export type PageSignals = {
  faqSchema?: boolean;
  schemaTypes?: string[];
  eeat?: EEATSignals;
  aiCitations?: number;               // per URL
  aiSources?: Record<string, number>; // e.g. { chatgpt: 2, brave: 5 }
};

export type AuditPage = { 
  url: string; 
  statusCode: number | null;  // null for older audits or network errors
  title: string | null;
  h1?: string | null;
  hasH1: boolean;
  jsonLdCount: number;
  faqOnPage?: boolean | null; // Keep for Page Report but not required in Pages table
  schemaTypes?: string[]; // Schema types found on page
  words: number | null;  // null for older audits or render failures
  snippet?: string | null;
  loadTimeMs?: number | null;
  error?: string | null;
  citationCount: number; // Number of citations referencing this page
  aiAnswers?: number; // Number of Brave AI answer citations referencing this page
  aiAnswerQueries?: string[]; // Phase F+: Top 3 queries that cited this page
  aiAnswerMappings?: Array<{ reason: 'path' | 'canonical' | 'title_fuzzy'; confidence: number }>; // Phase F++: Mapping metadata
  aiHits?: number; // Phase G: Real AI crawler hits (30d)
  eeat?: EEATSignals; // E-E-A-T signals
  pageSignals?: PageSignals; // enhanced page signals
  cites?: number; // citation count alias
  ai_brave?: number; // Brave AI citations
  ai_hits?: number; // AI hits alias
};

export type ScoresBreakdown = {
  crawlability: {
    robotsTxtFound: boolean;
    sitemapReferenced: boolean;
    sitemapOk: boolean;
    aiBots: {
      gptbot: boolean;
      claude: boolean;
      perplexity: boolean;
      ccbot: boolean;
      googleExtended: boolean;
      bytespider: boolean;
    };
  };
  structured: {
    jsonLdCoveragePct: number;
    faqSite: boolean;
    schemaTypes: string[];
  };
  answerability: {
    titleCoveragePct: number;
    h1CoveragePct: number;
    content120PlusPct: number;
  };
  trust: {
    ok2xxPct: number;
    avgRenderMs: number;
  };
};

export type AiAccessResult = { 
  status: number; 
  ok: boolean;
  blocked: boolean; 
  server?: string | null;
  cfRay?: string | null;
  akamai?: string | null;
};

export type AiAccess = {
  summary: { 
    allowed: number; 
    blocked: number; 
    tested: number; 
    waf?: string | null;
  };
  results: Record<string, AiAccessResult>;
  baselineStatus: number;
};

// Phase F+ enhanced types
export type QueryStatus = 'ok' | 'empty' | 'rate_limited' | 'error' | 'timeout';
export type QueryBucket = 'brand_core' | 'product_how_to' | 'jobs_to_be_done' | 'schema_probes' | 'content_seeds' | 'competitive';

export type BraveQueryLog = {
  provider: 'brave';
  api: 'search' | 'summarizer';
  q: string;
  bucket?: QueryBucket;
  weight?: number;
  ts: number;
  ok: boolean;
  status?: number;
  durationMs?: number;
  sourcesTotal?: number;
  domainSources?: number;
  domainPaths?: string[];
  error?: string | null;
  queryStatus?: QueryStatus;
  queryReason?: string;
};

export type BraveAIDiagnostics = {
  ok: number;
  empty: number;
  rate_limited: number;
  error: number;
  timeout: number;
};

export type BraveAIMeta = {
  queries?: BraveQueryLog[]; // Full query logs for modal
  queriesTotal?: number; // Phase F+: Total queries run
  queriesCount?: number; // Backward compat
  resultsTotal?: number; // Phase F+: Queries with results
  pagesCited: number;
  diagnostics?: BraveAIDiagnostics; // Phase F+
  querySamples?: string[]; // Phase F+: Sample queries for tooltip
  byApi: {
    search: number;
    summarizer: number;
  };
};

// Legacy types for backward compat
export type BraveAIQuery = {
  query: string;
  mode: 'grounding' | 'summarizer';
  answerText?: string;
  sources: { url: string; title?: string }[];
};

// Phase G: Real AI crawler signals
export type CrawlSummary = {
  total: number;
  byBot: Record<string, number>;
  lastSeen: Record<string, number>;
};

export type SiteMeta = {
  faqPresent?: boolean;
  faqSchemaPresent?: boolean;
  faqPagePresent?: boolean;
  robotsTxtUrl: string | null;
  sitemapUrl: string | null;
  aiBots: ScoresBreakdown['crawlability']['aiBots'];
  aiAccess?: AiAccess | null;
  flags?: {
    aiBlocked: boolean;
    blockedBy: 'robots' | 'waf' | 'unknown' | null;
    blockedBots: string[];
    wafName?: string | null;
  } | null;
  braveAI?: BraveAIMeta | null;
  crawlers?: CrawlSummary; // Phase G
};

export type Scores = { 
  total: number;                  // 0-100% (weighted overall)
  crawlability: number;           // raw points (0-30)
  structured: number;             // raw points (0-25)
  answerability: number;          // raw points (0-20)
  trust: number;                  // raw points (0-15)
  visibility?: number;            // raw points (0-10)
  crawlabilityPct?: number;       // percentage (0-100%)
  structuredPct?: number;         // percentage (0-100%)
  answerabilityPct?: number;      // percentage (0-100%)
  trustPct?: number;              // percentage (0-100%)
  visibilityPct?: number;         // percentage (0-100%)
  breakdown?: ScoresBreakdown;
};

export type EntityRecommendations = {
  sameAs_missing: boolean;
  suggestions: string[];
  jsonld_snippet: string;
};

export type CitationType = 'AEO' | 'GEO' | 'Organic';

export type Citation = {
  engine: string;
  query: string;
  url: string;
  title: string | null;
  cited_at: number;
  type: CitationType;
  pagePathname?: string | null;
  provider?: string | null; // 'Brave' for AI answer sources
  mode?: 'grounding' | 'summarizer' | null;
  isAIOffered?: boolean; // true for Brave AI answer citations
};

export type CitationCounts = {
  AEO: number;
  GEO: number;
  Organic: number;
};

export type CitationsSummary = {
  total: number;
  AEO: number;
  GEO: number;
  Organic: number;
};

export type VisibilitySummary = {
  totalCitations: number;
  bySource: Record<string, number>; // e.g. { brave: 5, chatgpt: 2, claude: 1, perplexity: 0 }
  topUrls: Array<{
    url: string;
    total: number;
    bySource: Record<string, number>;
  }>;
};

export type Audit = { 
  id: string; 
  property_id: string; 
  domain: string;
  property?: {
    id: string;
    domain: string;
    name: string;
  };
  scores: Scores; 
  site?: SiteMeta;
  issues: AuditIssue[]; 
  pages: AuditPage[]; 
  started_at: number; 
  finished_at?: number;
  entity_recommendations?: EntityRecommendations;
  citations?: Citation[];
  citationsSummary?: CitationsSummary;
  eeat_summary?: EEATSignals; // E-E-A-T summary
  visibility_summary?: VisibilitySummary; // visibility summary
};

export async function startAudit(opts: {
  property_id?: string;
  url?: string; // Demo mode: pass URL directly
  apiKey?: string;
  maxPages?: number;
  site_description?: string; // Site description for better VI prompts
  filters?: {
    include?: string[];
    exclude?: string[];
  };
}): Promise<{ id: string }> {
  const { property_id, url, apiKey, maxPages, site_description, filters } = opts;
  
  // Demo mode: use URL directly
  const body: any = { maxPages, filters };
  if (url) {
    body.url = url;
  } else if (property_id) {
    body.property_id = property_id;
  }
  if (site_description) {
    body.site_description = site_description;
  }
  
  const headers: any = { "content-type": "application/json" };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }
  
  const res = await fetch(`${API_BASE}/v1/audits/start`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Audit failed' }));
    throw new Error(err.error || err.message || `startAudit failed ${res.status}`);
  }
  return res.json();
}

export async function getAudit(id: string): Promise<Audit> {
  const res = await fetch(`${API_BASE}/v1/audits/${id}`);
  if (!res.ok) throw new Error(`getAudit failed ${res.status}`);
  return res.json();
}

export async function rerunAudit(auditId: string): Promise<{ id: string; url: string }> {
  // Rerun is public - don't send API key to avoid project ownership conflicts
  const res = await fetch(`${API_BASE}/v1/audits/${auditId}/rerun`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Re-run failed' }));
    throw new Error(err.error || err.message || `Re-run failed: ${res.status}`);
  }
  return res.json();
}

// v0.13 Onboarding API
export type ProjectCreate = { name: string; owner_email: string };
export type Project = { 
  id: string; 
  api_key: string; 
  name: string; 
  owner_email?: string;
  created_at: number;
};

export type PropertyCreate = { project_id: string; domain: string };
export type Property = {
  id: string;
  domain: string;
  verified: boolean;
  verification: {
    token: string;
    dns: { record: "TXT"; name: string; value: string };
    html: { path: string; content: string };
  };
};

export async function createProject(input: ProjectCreate): Promise<Project> {
  const res = await fetch(`${API_BASE}/v1/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error(`createProject ${res.status}`);
  return res.json();
}

export async function createProperty(input: PropertyCreate, apiKey: string): Promise<Property> {
  const res = await fetch(`${API_BASE}/v1/properties`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error(`createProperty ${res.status}`);
  return res.json();
}

export async function verifyProperty(propertyId: string, method: "dns" | "html", apiKey: string) {
  const res = await fetch(`${API_BASE}/v1/properties/${propertyId}/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ method })
  });
  if (!res.ok) throw new Error(`verifyProperty ${res.status}`);
  return res.json(); // { verified: boolean, error?: string }
}

// v0.14 Citations API with pagination
export async function getCitations(
  auditId: string, 
  limit: number = 10, 
  offset: number = 0
): Promise<{ items: Citation[]; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams({ 
    limit: limit.toString(), 
    offset: offset.toString() 
  });
  const res = await fetch(`${API_BASE}/v1/audits/${auditId}/citations?${params}`);
  if (!res.ok) return { items: [], total: 0, limit, offset };
  return res.json();
}

// Page-level report API
export async function getAuditPage(auditId: string, decodedUrlOrPath: string) {
  const u = encodeURIComponent(decodedUrlOrPath);
  const res = await fetch(`${API_BASE}/v1/audits/${auditId}/page?u=${u}`);
  if (!res.ok) throw new Error(`getAuditPage failed: ${res.status}`);
  return res.json() as Promise<{
    audit_id: string;
    page: {
      url: string;
      title?: string;
      status?: number;
      word_count?: number;
      has_h1?: boolean;
      json_ld_count?: number;
      faq_present?: boolean;
      score_hints: {
        has_h1: boolean;
        has_json_ld: boolean;
        word_ok: boolean;
        faq_ok: boolean;
      };
    };
    issues: AuditIssue[];
  }>;
}

export type PageRecommendations = {
  ok: boolean;
  inferredType: string;
  missingSchemas: string[];
  suggestedJsonLd: Array<{
    type: string;
    json: any;
    copyButton: string;
  }>;
  copyBlocks: Array<{
    label: string;
    content: string;
  }>;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
};

export async function getPageRecommendations(
  auditId: string, 
  pageUrl: string, 
  signal?: AbortSignal
): Promise<PageRecommendations> {
  const encodedUrl = encodeURIComponent(pageUrl);
  const res = await fetch(
    `${API_BASE}/v1/audits/${auditId}/pages/${encodedUrl}/recommendations`,
    { signal }
  );
  if (!res.ok) throw new Error(`getPageRecommendations failed: ${res.status}`);
  return res.json() as Promise<PageRecommendations>;
}

export type CitationsResponse = {
  ok: boolean;
  total: number;
  counts: CitationCounts;
  page: number;
  pageSize: number;
  items: Citation[];
};

export async function getAuditCitations(
  auditId: string,
  opts?: {
    type?: CitationType;
    path?: string;
    page?: number;
    pageSize?: number;
    provider?: string; // 'Brave' or null
    mode?: 'grounding' | 'summarizer'; // Brave AI mode filter
    isAIOffered?: boolean; // Filter for AI answer citations
    query?: string; // Phase F++: Filter by specific query text
  },
  signal?: AbortSignal
): Promise<CitationsResponse> {
  const params = new URLSearchParams();
  if (opts?.type) params.set('type', opts.type);
  if (opts?.path) params.set('path', opts.path);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.pageSize) params.set('pageSize', String(opts.pageSize));
  if (opts?.provider) params.set('provider', opts.provider);
  if (opts?.mode) params.set('mode', opts.mode);
  if (opts?.isAIOffered !== undefined) params.set('isAIOffered', String(opts.isAIOffered));
  if (opts?.query) params.set('query', opts.query); // Phase F++
  
  const queryString = params.toString();
  const url = `${API_BASE}/v1/audits/${auditId}/citations${queryString ? '?' + queryString : ''}`;
  
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`getAuditCitations failed: ${res.status}`);
  return res.json() as Promise<CitationsResponse>;
}

// Phase F+ Brave AI query logs with pagination & filtering
export type BraveQueriesResponse = {
  ok: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters?: { bucket?: string | null; status?: string | null };
  diagnostics: BraveAIDiagnostics;
  items: BraveQueryLog[];
};

export async function getBraveQueries(
  auditId: string,
  opts?: {
    page?: number;
    pageSize?: number;
    bucket?: QueryBucket | null;
    status?: QueryStatus | null;
  }
): Promise<BraveQueriesResponse> {
  const params = new URLSearchParams();
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.pageSize) params.set('pageSize', String(opts.pageSize));
  if (opts?.bucket) params.set('bucket', opts.bucket);
  if (opts?.status) params.set('status', opts.status);
  
  const queryString = params.toString();
  const url = `${API_BASE}/v1/audits/${auditId}/brave/queries${queryString ? '?' + queryString : ''}`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getBraveQueries failed: ${res.status}`);
  return res.json();
}

export async function runMoreBrave(
  auditId: string, 
  add: number = 10, 
  extraTerms: string[] = []
): Promise<{ ok: boolean; added: number; totalQueries: number; message?: string }> {
  const res = await fetch(`${API_BASE}/v1/audits/${auditId}/brave/run-more`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ add, extraTerms })
  });
  if (!res.ok) throw new Error(`runMoreBrave failed: ${res.status}`);
  return res.json();
}

// Base64 URL-safe encoding/decoding helpers
export const b64u = {
  enc: (s: string) =>
    btoa(unescape(encodeURIComponent(s)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''),
  dec: (s: string) =>
    decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))),
};


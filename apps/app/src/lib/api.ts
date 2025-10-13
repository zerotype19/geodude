// Phase 5: Visibility Intelligence API Client
export type VisibilityScore = { 
  day: string; 
  assistant: string; 
  domain: string; 
  score_0_100: number; 
  drift_pct?: number;
  citations_count?: number;
  unique_domains_count?: number;
  recency_score?: number;
};

export type RankingRow = { 
  week: string; 
  assistant: string; 
  domain_rank: number; 
  domain: string; 
  mentions: number; 
  share_pct: number;
  mentions_count?: number;
};

export type CitationRow = { 
  assistant: string; 
  source_domain: string; 
  url: string; 
  occurred_at: string; 
  source_type?: "native"|"heuristic";
  title?: string;
  snippet?: string;
};

const API = import.meta.env.VITE_API_BASE;

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

export const VisibilityAPI = {
  score: (domain: string, assistant?: string) =>
    fetch(`${API}/api/visibility/score?domain=${encodeURIComponent(domain)}${assistant ? `&assistant=${assistant}` : ''}`)
      .then(j<{domain: string; day: string; scores: VisibilityScore[]} | {error: string}>),

  rankings: (assistant: string, period = "7d") =>
    fetch(`${API}/api/visibility/rankings?assistant=${assistant}&period=${period}`)
      .then(j<{assistant: string; period: string; rankings: RankingRow[]}>),

  drift: (domain: string, assistant?: string) =>
    fetch(`${API}/api/visibility/drift?domain=${encodeURIComponent(domain)}${assistant ? `&assistant=${assistant}` : ''}`)
      .then(j<{domain: string; assistant: string; driftData: any[]}>),

  // Recent citations endpoint (we'll need to add this to the API)
  recentCitations: (projectId: string, limit = 25) =>
    fetch(`${API}/api/visibility/citations/recent?projectId=${projectId}&limit=${limit}`)
      .then(j<CitationRow[]>),

  // Manual rollup endpoint (admin only)
  rollupToday: () =>
    fetch(`${API}/api/visibility/rollup?day=today`, { method: "POST" })
      .then(j<{success: boolean; day: string; rollup: any; status: any}>),
};

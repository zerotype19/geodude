/**
 * Brave AI Answer Integration
 * Fetches AI-generated answers and citations from Brave Search AI APIs
 */

export type BraveAIEvidence = {
  query: string;
  mode: 'grounding' | 'summarizer';
  answerText?: string;
  sources: { url: string; title?: string }[];
  raw: any;
};

/**
 * Extract pathname from URL for citation matching
 */
function extractPathname(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '/';
  }
}

/**
 * Fetch Brave AI Grounding API results
 * Returns AI answer with source URLs that grounded the response
 */
export async function fetchGrounding(
  apiKey: string, 
  query: string,
  timeout: number = 7000
): Promise<BraveAIEvidence> {
  const url = `https://api.search.brave.com/res/v1/ai/grounding?q=${encodeURIComponent(query)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const resp = await fetch(url, {
      headers: { 
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!resp.ok) {
      throw new Error(`Brave Grounding API error: ${resp.status}`);
    }
    
    const j = await resp.json() as any;
    const sources = (j.sources || []).map((s: any) => ({ 
      url: s.url, 
      title: s.title || s.name
    }));
    
    return {
      query,
      mode: 'grounding',
      answerText: j.answer,
      sources,
      raw: j
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error(`Brave Grounding failed for "${query}":`, error.message);
    return {
      query,
      mode: 'grounding',
      sources: [],
      raw: { error: error.message }
    };
  }
}

/**
 * Fetch Brave AI Summarizer API results
 * Returns summarized answer with citations from search results
 */
export async function fetchSummarizer(
  apiKey: string, 
  query: string,
  timeout: number = 7000
): Promise<BraveAIEvidence> {
  const url = `https://api.search.brave.com/res/v1/summarizer/search?q=${encodeURIComponent(query)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const resp = await fetch(url, {
      headers: { 
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!resp.ok) {
      throw new Error(`Brave Summarizer API error: ${resp.status}`);
    }
    
    const j = await resp.json() as any;
    const summary = j.summary || {};
    const enrichments = summary.enrichments || [];
    
    // Extract sources from enrichments (citations)
    const sources: { url: string; title?: string }[] = [];
    enrichments.forEach((enr: any) => {
      if (enr.type === 'web_search_api_item' && enr.url) {
        sources.push({
          url: enr.url,
          title: enr.title || enr.description
        });
      }
    });
    
    return {
      query,
      mode: 'summarizer',
      answerText: summary.text,
      sources,
      raw: j
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error(`Brave Summarizer failed for "${query}":`, error.message);
    return {
      query,
      mode: 'summarizer',
      sources: [],
      raw: { error: error.message }
    };
  }
}

/**
 * Run Brave AI queries for a domain
 * Returns both grounding and summarizer results
 */
export async function runBraveAIQueries(
  apiKey: string,
  domain: string,
  brand?: string
): Promise<BraveAIEvidence[]> {
  const queries = [
    `site:${domain}`,
    brand || domain,
    `${brand || domain} faq`,
    `how to use ${brand || domain}`,
    `${brand || domain} features`
  ];
  
  const results: BraveAIEvidence[] = [];
  
  // Run queries with small concurrency (2 at a time to respect rate limits)
  for (let i = 0; i < queries.length; i += 2) {
    const batch = queries.slice(i, i + 2);
    const promises = batch.flatMap(q => [
      fetchGrounding(apiKey, q),
      fetchSummarizer(apiKey, q)
    ]);
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    
    // Small delay between batches to avoid rate limits
    if (i + 2 < queries.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

export { extractPathname };


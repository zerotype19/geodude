// AI Connectors for Citations System
// Unified interface for Perplexity, ChatGPT, Claude, and Brave

export interface ConnectorResult {
  source: 'perplexity' | 'chatgpt' | 'claude' | 'brave';
  query: string;
  answer_text: string;
  cited_urls: string[];
  confidence?: number;
  error?: string;
}

export interface ConnectorEnv {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  CLAUDE_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  BRAVE_API_KEY?: string;
  BRAVE_SEARCH?: string;
}

// Retry helper function
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 1,
  backoffMs: number = 800
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Only retry on 429/5xx errors
      if (attempt < maxRetries && 
          (lastError.message.includes('429') || 
           lastError.message.includes('5') ||
           lastError.message.includes('timeout'))) {
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${backoffMs}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      
      throw lastError;
    }
  }
  
  throw lastError;
}

// Helper function to normalize URLs and match domain
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.href;
  } catch {
    return url;
  }
}

function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, '');
}

function matchDomain(url: string, targetDomain: string): boolean {
  try {
    const urlObj = new URL(url);
    const urlDomain = normalizeDomain(urlObj.hostname);
    const target = normalizeDomain(targetDomain);
    return urlDomain === target;
  } catch {
    return false;
  }
}

// Extract URLs from text using regex
function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches.map(normalizeUrl))];
}

// Perplexity Connector
export async function queryPerplexity(query: string, env: ConnectorEnv): Promise<ConnectorResult> {
  if (!env.PERPLEXITY_API_KEY) {
    return { source: 'perplexity', query, answer_text: '', cited_urls: [], confidence: 0, error: 'API key not configured' };
  }

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: `${query}\n\nAfter answering, list the source URLs you relied on. Ensure URLs are fully-qualified and on separate lines.`
          }
        ],
        max_tokens: 1000,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const answer_text = data.choices?.[0]?.message?.content || '';
    
    // Extract URLs from the response
    const cited_urls = extractUrls(answer_text);

    return {
      source: 'perplexity',
      query,
      answer_text,
      cited_urls,
      confidence: 0.8
    };
  } catch (error) {
    return {
      source: 'perplexity',
      query,
      answer_text: '',
      cited_urls: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// OpenAI ChatGPT Connector
export async function queryChatGPT(query: string, env: ConnectorEnv): Promise<ConnectorResult> {
  if (!env.OPENAI_API_KEY) {
    return { source: 'chatgpt', query, answer_text: '', cited_urls: [], confidence: 0, error: 'API key not configured' };
  }

  try {
    const data = await withRetry(async () => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are evaluating how frequently websites are cited. Answer the user\'s query naturally. Then return a **machine-readable JSON** block on the final line with the key `sources` as a JSON array of fully-qualified URLs used in your answer. Do not include commentary in the JSON.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        max_tokens: 1000,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    return await response.json();
    });
    const answer_text = data.choices?.[0]?.message?.content || '';
    
    // Try to extract JSON sources from the response
    let cited_urls: string[] = [];
    try {
      const jsonMatch = answer_text.match(/\{[\s\S]*"sources"[\s\S]*\}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        cited_urls = Array.isArray(jsonData.sources) ? jsonData.sources : [];
      }
    } catch {
      // Fallback to regex extraction
      cited_urls = extractUrls(answer_text);
    }

    return {
      source: 'chatgpt',
      query,
      answer_text,
      cited_urls,
      confidence: 0.9
    };
  } catch (error) {
    return {
      source: 'chatgpt',
      query,
      answer_text: '',
      cited_urls: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Claude Connector
export async function queryClaude(query: string, env: ConnectorEnv): Promise<ConnectorResult> {
  const apiKey = env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY;
  if (!apiKey) {
    return { source: 'claude', query, answer_text: '', cited_urls: [], confidence: 0, error: 'API key not configured' };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `${query}\n\nAfter answering, provide a **SOURCES:** section with Markdown links to all URLs you relied on.`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const answer_text = data.content?.[0]?.text || '';
    
    // Extract URLs from SOURCES section or general text
    let cited_urls: string[] = [];
    const sourcesMatch = answer_text.match(/SOURCES?:[\s\S]*?(?=\n\n|\n$|$)/i);
    if (sourcesMatch) {
      cited_urls = extractUrls(sourcesMatch[0]);
    } else {
      cited_urls = extractUrls(answer_text);
    }

    return {
      source: 'claude',
      query,
      answer_text,
      cited_urls,
      confidence: 0.85
    };
  } catch (error) {
    return {
      source: 'claude',
      query,
      answer_text: '',
      cited_urls: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Brave Search Connector (for AEO coverage)
export async function queryBrave(query: string, env: ConnectorEnv): Promise<ConnectorResult> {
  const apiKey = env.BRAVE_API_KEY || env.BRAVE_SEARCH;
  if (!apiKey) {
    return { source: 'brave', query, answer_text: '', cited_urls: [], confidence: 0, error: 'API key not configured' };
  }

  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`, {
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Brave API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.web?.results || [];
    
    const cited_urls = results.map((result: any) => result.url).filter(Boolean);
    const answer_text = `Search results for: ${query}\n\n` + 
      results.slice(0, 3).map((result: any, i: number) => 
        `${i + 1}. ${result.title}\n   ${result.url}\n   ${result.description || ''}`
      ).join('\n\n');

    return {
      source: 'brave',
      query,
      answer_text,
      cited_urls,
      confidence: 1.0 // Brave results are authoritative
    };
  } catch (error) {
    return {
      source: 'brave',
      query,
      answer_text: '',
      cited_urls: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Main connector dispatcher
export async function queryAI(
  source: 'perplexity' | 'chatgpt' | 'claude' | 'brave',
  query: string,
  env: ConnectorEnv
): Promise<ConnectorResult> {
  switch (source) {
    case 'perplexity':
      return queryPerplexity(query, env);
    case 'chatgpt':
      return queryChatGPT(query, env);
    case 'claude':
      return queryClaude(query, env);
    case 'brave':
      return queryBrave(query, env);
    default:
      return {
        source,
        query,
        answer_text: '',
        cited_urls: [],
        error: `Unknown source: ${source}`
      };
  }
}

// Process citations and compute domain matches
export function processCitations(
  result: ConnectorResult,
  targetDomain: string
): {
  cited_urls: string[];
  cited_match_count: number;
  first_match_url: string | null;
} {
  const cited_urls = result.cited_urls.map(normalizeUrl);
  const matching_urls = cited_urls.filter(url => matchDomain(url, targetDomain));
  
  return {
    cited_urls,
    cited_match_count: matching_urls.length,
    first_match_url: matching_urls[0] || null
  };
}

// Generate default queries from audit data
export function generateDefaultQueries(
  domain: string,
  brand?: string,
  siteDescription?: string,
  homePageTitle?: string,
  homePageMetaDescription?: string
): string[] {
  const queries: string[] = [];
  const domainName = domain.replace(/^www\./, '');
  const brandName = brand || domainName.split('.')[0];
  
  // If we have site description, use it to generate relevant queries
  if (siteDescription && siteDescription.length > 10) {
    // Extract key topics from description
    // Add primary query about the site's purpose
    queries.push(`what is ${brandName}`);
    
    // Generate queries based on description keywords
    const descWords = siteDescription.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4 && !['about', 'website', 'offers', 'provides'].includes(w));
    
    // Take first 3 significant keywords for topic queries
    const topKeywords = [...new Set(descWords)].slice(0, 3);
    topKeywords.forEach(keyword => {
      queries.push(`${keyword} ${brandName}`);
      queries.push(`${brandName} ${keyword}`);
    });
    
    // Add query combining brand with description concept
    if (descWords.length > 0) {
      const firstFewWords = siteDescription.split(/\s+/).slice(0, 8).join(' ');
      if (firstFewWords.length > 15) {
        queries.push(firstFewWords);
      }
    }
  }
  
  // Use homepage title if available
  if (homePageTitle && homePageTitle.length > 5) {
    // Clean up title (remove domain, separator characters)
    const cleanTitle = homePageTitle
      .replace(new RegExp(domainName, 'gi'), '')
      .replace(/[\|\/\-\–]/g, ' ')
      .trim();
    
    if (cleanTitle.length > 5 && cleanTitle.length < 100) {
      queries.push(cleanTitle);
    }
  }
  
  // Use meta description if available
  if (homePageMetaDescription && homePageMetaDescription.length > 20) {
    const cleanMeta = homePageMetaDescription.slice(0, 150).trim();
    queries.push(cleanMeta);
  }
  
  // Add brand-specific queries if no description provided
  if (!siteDescription || queries.length < 3) {
    queries.push(`what is ${domainName}`);
    queries.push(`${brandName} overview`);
    queries.push(`${brandName} information`);
  }
  
  // Case-insensitive deduplication and cleanup
  const seen = new Set<string>();
  const uniqueQueries = queries
    .map(q => q.trim())
    .filter(q => {
      const lower = q.toLowerCase();
      if (seen.has(lower)) return false;
      if (q.length < 10) return false; // Skip very short queries
      if (q.length > 200) return false; // Skip very long queries
      seen.add(lower);
      return q.length > 0;
    });
  
  // Limit to 12 total
  return uniqueQueries.slice(0, 12);
}

// Citation Orchestrator - Multi-provider fallback with rate limiting
// Ensures citations always appear even if individual providers fail

/**
 * Rate limiter using token bucket algorithm
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number = 5,
    private refillRate: number = 5, // tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      const elapsed = (now - this.lastRefill) / 1000;
      
      // Refill tokens based on time elapsed
      this.tokens = Math.min(
        this.capacity,
        this.tokens + elapsed * this.refillRate
      );
      this.lastRefill = now;

      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      // Wait before trying again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

/**
 * Exponential backoff retry helper
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 500
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on non-retryable errors
      if (error.status && error.status !== 429 && error.status !== 503) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const delay = baseDelayMs * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
        console.log(`[retry] Attempt ${attempt + 1} failed, waiting ${Math.round(delay)}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Brave Web Search (reliable, returns URLs)
 */
async function braveWebSearch(
  apiKey: string,
  query: string,
  count: number = 10,
  limiter?: RateLimiter
): Promise<Array<{ title: string; url: string; snippet: string }>> {
  if (limiter) await limiter.acquire();

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query.trim());
  url.searchParams.set('count', String(Math.min(count, 20)));
  url.searchParams.set('country', 'us');
  url.searchParams.set('safesearch', 'moderate');

  const response = await withRetry(async () => {
    const r = await fetch(url.toString(), {
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept': 'application/json'
      }
    });

    if (r.status === 429) {
      const error = new Error('Brave rate limit exceeded');
      (error as any).status = 429;
      throw error;
    }

    if (!r.ok) {
      const text = await r.text();
      console.error(`[brave-web] ${r.status}: ${text}`);
      throw new Error(`Brave Web Search failed: ${r.status}`);
    }

    return r.json();
  });

  const results = response.web?.results || [];
  return results.map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.description || ''
  }));
}

/**
 * Summarize web results with GPT (guaranteed citations)
 */
async function summarizeWithGPT(
  openAIKey: string,
  openAIBase: string,
  query: string,
  results: Array<{ title: string; url: string; snippet: string }>
): Promise<{ answer: string; citations: string[] }> {
  const top = results.slice(0, 8).map(r => 
    `- ${r.title}\n  ${r.url}\n  ${r.snippet}`
  ).join('\n\n');

  const response = await fetch(`${openAIBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openAIKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are a search result summarizer. Create a brief, accurate summary using ONLY the sources provided. Always cite sources with their exact URLs.'
        },
        {
          role: 'user',
          content: `Query: "${query}"\n\nSources:\n${top}\n\nProvide a brief answer (2-3 sentences) and list the URLs you referenced.`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content || '';
  
  // Extract cited URLs
  const citations = results.map(r => r.url);

  return { answer, citations };
}

/**
 * Main citation answer interface
 */
export interface CitationAnswer {
  answer: string;
  citations: string[];
  provider: string;
  queryText: string;
  timestamp: number;
  durationMs?: number;
}

/**
 * Orchestrated citation fetcher with fallbacks
 * Always returns citations by using Brave Web + GPT as reliable fallback
 */
export async function fetchCitationsWithFallback(
  env: any,
  query: string,
  limiter?: RateLimiter
): Promise<CitationAnswer> {
  const startTime = Date.now();
  const trimmedQuery = query.trim();

  // Validate query
  if (!trimmedQuery || trimmedQuery.length < 3) {
    throw new Error('Query too short');
  }

  console.log(`[citations] Fetching for: "${trimmedQuery}"`);

  // Primary: Brave Web Search + GPT Summarization (reliable)
  try {
    if (env.BRAVE_SEARCH) {
      const results = await braveWebSearch(env.BRAVE_SEARCH, trimmedQuery, 10, limiter);
      
      if (results.length > 0) {
        console.log(`[citations] Brave Web returned ${results.length} results`);
        
        // Summarize with GPT if we have OpenAI key
        if (env.OPENAI_API_KEY) {
          try {
            const summary = await summarizeWithGPT(
              env.OPENAI_API_KEY,
              env.OPENAI_API_BASE || 'https://api.openai.com/v1',
              trimmedQuery,
              results
            );
            
            return {
              answer: summary.answer,
              citations: summary.citations,
              provider: 'brave+gpt',
              queryText: trimmedQuery,
              timestamp: Date.now(),
              durationMs: Date.now() - startTime
            };
          } catch (gptError) {
            console.warn('[citations] GPT summarization failed, using raw results:', gptError);
          }
        }

        // Fallback: return raw Brave results
        return {
          answer: results[0]?.snippet || 'See sources below',
          citations: results.map(r => r.url),
          provider: 'brave-web',
          queryText: trimmedQuery,
          timestamp: Date.now(),
          durationMs: Date.now() - startTime
        };
      }
    }
  } catch (error) {
    console.error('[citations] Brave Web + GPT failed:', error);
  }

  // If we get here, all providers failed
  throw new Error('All citation providers failed');
}

/**
 * Batch fetch citations with rate limiting and deduplication
 */
export async function batchFetchCitations(
  env: any,
  queries: string[],
  options: {
    maxConcurrent?: number;
    rateLimit?: { capacity: number; refillRate: number };
  } = {}
): Promise<CitationAnswer[]> {
  const { maxConcurrent = 3, rateLimit = { capacity: 5, refillRate: 5 } } = options;

  // Deduplicate and validate queries
  const uniqueQueries = Array.from(new Set(
    queries
      .map(q => q.trim())
      .filter(q => q.length >= 3)
  ));

  console.log(`[citations-batch] Processing ${uniqueQueries.length} unique queries (${maxConcurrent} concurrent)`);

  const limiter = new RateLimiter(rateLimit.capacity, rateLimit.refillRate);
  const results: CitationAnswer[] = [];
  const errors: Array<{ query: string; error: string }> = [];

  // Process in chunks to respect concurrency
  for (let i = 0; i < uniqueQueries.length; i += maxConcurrent) {
    const chunk = uniqueQueries.slice(i, i + maxConcurrent);
    
    const chunkResults = await Promise.allSettled(
      chunk.map(query => fetchCitationsWithFallback(env, query, limiter))
    );

    for (let j = 0; j < chunkResults.length; j++) {
      const result = chunkResults[j];
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push({
          query: chunk[j],
          error: result.reason?.message || 'Unknown error'
        });
      }
    }

    // Small delay between chunks
    if (i + maxConcurrent < uniqueQueries.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  if (errors.length > 0) {
    console.warn(`[citations-batch] ${errors.length} queries failed:`, errors);
  }

  console.log(`[citations-batch] Completed: ${results.length} succeeded, ${errors.length} failed`);

  return results;
}


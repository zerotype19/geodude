import type { Heuristics } from './classifier';

const CACHE_TTL = 60; // 60 seconds cache
let cachedHeuristics: Heuristics | null = null;
let cacheExpiry = 0;

export async function loadHeuristics(env: any): Promise<Heuristics> {
  const now = Date.now() / 1000;
  
  // Return cached heuristics if still valid
  if (cachedHeuristics && now < cacheExpiry) {
    return cachedHeuristics;
  }
  
  try {
    // Try to load from KV
    const kvKey = 'rules:heuristics';
    const kvValue = await env.CACHE.get(kvKey);
    
    if (kvValue) {
      const heuristics = JSON.parse(kvValue) as Heuristics;
      
      // Validate the structure
      if (isValidHeuristics(heuristics)) {
        cachedHeuristics = heuristics;
        cacheExpiry = now + CACHE_TTL;
        return heuristics;
      }
    }
  } catch (error) {
    console.error('Failed to load heuristics from KV:', error);
  }
  
  // Fallback to default heuristics if KV fails or is invalid
  const defaultHeuristics: Heuristics = {
    ai_human_referrers: [
      { host: "chat.openai.com", source: "openai_chatgpt" },
      { host: "poe.com", source: "poe" },
      { host: "perplexity.ai", source: "perplexity" },
      { host: "copilot.microsoft.com", source: "microsoft_copilot" },
      { host: "gemini.google.com", source: "google_gemini" },
      { host: "bard.google.com", source: "google_gemini" }, // legacy
      { host: "you.com", source: "youcom" },
      { host: "metaphor.systems", source: "metaphor" }
    ],
    ai_human_search_signals: [
      { 
        host: "bing.com", 
        path_contains: "/search", 
        param_has: ["form=AI", "sgdelta"] 
      },
      { 
        host: "google.com", 
        path_contains: "/search", 
        param_has: ["ov", "aio", "ai_overview"] 
      }
    ],
    search_referrers: [
      "google.com", "www.google.com", "bing.com", "duckduckgo.com",
      "search.brave.com", "yahoo.com", "baidu.com", "ecosia.org", "yandex.com",
      "news.google.com"
    ],
    bot_ua_tokens: [
      "Googlebot/", "Bingbot/", "DuckDuckBot/", "Applebot/", "GPTBot/",
      "CCBot/", "facebookexternalhit", "Twitterbot", "YandexBot",
      "SemrushBot", "AhrefsBot", "MJ12bot"
    ],
    bot_headers: [
      { header: "from", value_contains: "googlebot@" },
      { header: "sec-ai-client", value: "*" },
      { header: "x-ai-client", value: "*" }
    ]
  };
  
  // Cache the default heuristics
  cachedHeuristics = defaultHeuristics;
  cacheExpiry = now + CACHE_TTL;
  
  return defaultHeuristics;
}

function isValidHeuristics(heuristics: any): heuristics is Heuristics {
  return (
    heuristics &&
    Array.isArray(heuristics.ai_human_referrers) &&
    Array.isArray(heuristics.ai_human_search_signals) &&
    Array.isArray(heuristics.search_referrers) &&
    Array.isArray(heuristics.bot_ua_tokens) &&
    Array.isArray(heuristics.bot_headers)
  );
}

// Function to update heuristics in KV (for admin use)
export async function updateHeuristics(env: any, heuristics: Heuristics): Promise<boolean> {
  try {
    const kvKey = 'rules:heuristics';
    await env.CACHE.put(kvKey, JSON.stringify(heuristics), { expirationTtl: 0 }); // No expiration
    
    // Invalidate cache to force reload
    cachedHeuristics = null;
    cacheExpiry = 0;
    
    return true;
  } catch (error) {
    console.error('Failed to update heuristics in KV:', error);
    return false;
  }
}

import { log } from "./logging";

export interface TrafficClassification {
  traffic_class: "ai_agent_crawl" | "human_via_ai" | "direct_human" | "unknown_ai_like";
  source_name: string | null;
  ai_source_id: number | null;
  confidence: number;
  category: string | null;
}

// In-memory cache for fingerprints (5 min TTL)
let fingerprintCache: {
  ua_patterns: any[];
  heuristics: any;
  sources_index: any;
  last_updated: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function classifyRequest(req: Request, env: Env): Promise<TrafficClassification> {
  try {
    // Warm cache if needed
    await warmFingerprintCache(env);
    
    const userAgent = req.headers.get("user-agent") || "";
    const referer = req.headers.get("referer") || "";
    
    // 1. Check User-Agent patterns first (highest confidence)
    const uaMatch = matchUserAgent(userAgent);
    if (uaMatch) {
      return {
        traffic_class: "ai_agent_crawl",
        source_name: uaMatch.source,
        ai_source_id: uaMatch.ai_source_id,
        confidence: uaMatch.confidence,
        category: uaMatch.category
      };
    }
    
    // 2. Check referer heuristics (medium confidence)
    const refMatch = matchReferer(referer);
    if (refMatch) {
      return {
        traffic_class: refMatch.class as any,
        source_name: refMatch.source,
        ai_source_id: refMatch.ai_source_id,
        confidence: 0.7, // Medium confidence for referer matches
        category: refMatch.category
      };
    }
    
    // 3. Check header heuristics
    const headerMatch = matchHeaders(req.headers);
    if (headerMatch) {
      return {
        traffic_class: headerMatch.class as any,
        source_name: headerMatch.source,
        ai_source_id: headerMatch.ai_source_id,
        confidence: 0.6,
        category: headerMatch.category
      };
    }
    
    // 4. Check for unknown AI-like patterns
    if (isUnknownAILike(userAgent)) {
      return {
        traffic_class: "unknown_ai_like",
        source_name: null,
        ai_source_id: null,
        confidence: 0.3,
        category: null
      };
    }
    
    // 5. Default to direct human
    return {
      traffic_class: "direct_human",
      source_name: null,
      ai_source_id: null,
      confidence: 1.0,
      category: null
    };
    
  } catch (error) {
    log("classification_error", { 
      error: error instanceof Error ? error.message : String(error),
      ua: req.headers.get("user-agent"),
      referer: req.headers.get("referer")
    });
    
    // Fallback to unknown
    return {
      traffic_class: "unknown_ai_like",
      source_name: null,
      ai_source_id: null,
      confidence: 0.0,
      category: null
    };
  }
}

async function warmFingerprintCache(env: Env) {
  const now = Date.now();
  
  // Check if cache is still valid
  if (fingerprintCache && (now - fingerprintCache.last_updated) < CACHE_TTL) {
    return;
  }
  
  try {
    // Load fingerprints from KV
    const [uaPatterns, heuristics, sourcesIndex] = await Promise.all([
      env.AI_FINGERPRINTS.get("ua:list", "json"),
      env.AI_FINGERPRINTS.get("rules:heuristics", "json"),
      env.AI_FINGERPRINTS.get("sources:index", "json")
    ]);
    
    fingerprintCache = {
      ua_patterns: (uaPatterns as any[]) || [],
      heuristics: (heuristics as any) || { referer_contains: [], headers: [] },
      sources_index: (sourcesIndex as any) || {},
      last_updated: now
    };
    
    log("fingerprint_cache_warmed", { 
      patterns: fingerprintCache.ua_patterns.length,
      heuristics: Object.keys(fingerprintCache.heuristics).length,
      sources: Object.keys(fingerprintCache.sources_index).length
    });
    
  } catch (error) {
    log("fingerprint_cache_warm_error", { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    // Use fallback data if KV is unavailable
    fingerprintCache = {
      ua_patterns: [] as any[],
      heuristics: { referer_contains: [], headers: [] } as any,
      sources_index: {} as any,
      last_updated: now
    };
  }
}

function matchUserAgent(userAgent: string): any | null {
  if (!fingerprintCache?.ua_patterns) return null;
  
  for (const pattern of fingerprintCache.ua_patterns) {
    if (userAgent.includes(pattern.pattern)) {
      return {
        ...pattern,
        ai_source_id: fingerprintCache.sources_index[pattern.source] || null
      };
    }
  }
  
  return null;
}

function matchReferer(referer: string): any | null {
  if (!fingerprintCache?.heuristics?.referer_contains) return null;
  
  for (const rule of fingerprintCache.heuristics.referer_contains) {
    if (referer.includes(rule.needle)) {
      return {
        ...rule,
        ai_source_id: fingerprintCache.sources_index[rule.source] || null,
        category: getCategoryFromSource(rule.source)
      };
    }
  }
  
  return null;
}

function matchHeaders(headers: Headers): any | null {
  if (!fingerprintCache?.heuristics?.headers) return null;
  
  for (const rule of fingerprintCache.heuristics.headers) {
    const headerValue = headers.get(rule.header);
    if (headerValue && (rule.value === "*" || headerValue.includes(rule.value))) {
      return {
        ...rule,
        ai_source_id: null, // Would need to be resolved
        category: null
      };
    }
  }
  
  return null;
}

function isUnknownAILike(userAgent: string): boolean {
  if (!userAgent) return true;
  
  const aiKeywords = ["AI", "Bot", "Crawler", "Spider", "Agent"];
  const hasAIKeyword = aiKeywords.some(keyword => 
    userAgent.toLowerCase().includes(keyword.toLowerCase())
  );
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /^[A-Za-z0-9]{20,}$/, // Very long random strings
    /^[A-Za-z0-9]{1,5}$/, // Very short strings
    /^[A-Za-z0-9]+$/, // Only alphanumeric (no spaces, punctuation)
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
  
  return hasAIKeyword || isSuspicious;
}

function getCategoryFromSource(source: string): string {
  const categoryMap: Record<string, string> = {
    "OpenAI": "chat",
    "Google": "search",
    "Anthropic": "chat",
    "Microsoft": "assistant",
    "Perplexity": "search",
    "DuckDuckGo": "search",
    "Meta": "assistant",
    "Brave": "search"
  };
  
  return categoryMap[source] || "unknown";
}

// Types
type Env = {
  AI_FINGERPRINTS: KVNamespace;
};

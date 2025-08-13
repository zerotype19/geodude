import { log } from "./logging";

export interface TrafficClassification {
  traffic_class: "ai_agent_crawl" | "human_via_ai" | "direct_human" | "unknown_ai_like";
  source_name: string | null;
  ai_source_id: number | null;
  confidence: number;
  category: string | null;
}

// In-memory cache for rules manifest (5 min TTL)
let rulesCache: {
  manifest: any;
  last_updated: number;
  version: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function classifyRequest(req: Request, env: Env): Promise<TrafficClassification> {
  try {
    // Warm cache if needed
    await warmRulesCache(env);

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

async function warmRulesCache(env: Env) {
  const now = Date.now();

  try {
    // Load rules manifest from KV
    const manifest = await env.AI_FINGERPRINTS.get("rules:manifest", "json");

    // Check if cache is still valid and version hasn't changed
    if (rulesCache &&
      (now - rulesCache.last_updated) < CACHE_TTL &&
      rulesCache.version === (manifest?.version || 0)) {
      return;
    }

    if (manifest) {
      rulesCache = {
        manifest,
        last_updated: now,
        version: manifest.version
      };

      log("rules_cache_warmed", {
        version: manifest.version,
        ua_patterns: manifest.ua_list?.length || 0,
        heuristics: Object.keys(manifest.heuristics || {}).length
      });
    } else {
      // Use fallback data if no manifest exists
      rulesCache = {
        manifest: {
          version: 0,
          ua_list: [],
          heuristics: { referer_contains: [], headers: [] }
        },
        last_updated: now,
        version: 0
      };
    }

  } catch (error) {
    log("rules_cache_warm_error", {
      error: error instanceof Error ? error.message : String(error)
    });

    // Use fallback data if KV is unavailable
    rulesCache = {
      manifest: {
        version: 0,
        ua_list: [],
        heuristics: { referer_contains: [], headers: [] }
      },
      last_updated: now,
      version: 0
    };
  }
}

function matchUserAgent(userAgent: string): any | null {
  if (!rulesCache?.manifest?.ua_list) return null;

  for (const pattern of rulesCache.manifest.ua_list) {
    if (userAgent.includes(pattern.pattern)) {
      return {
        ...pattern,
        ai_source_id: null // Would need to be resolved from ai_sources table
      };
    }
  }

  return null;
}

function matchReferer(referer: string): any | null {
  if (!rulesCache?.manifest?.heuristics?.referer_contains) return null;

  for (const rule of rulesCache.manifest.heuristics.referer_contains) {
    if (referer.includes(rule.needle)) {
      return {
        ...rule,
        ai_source_id: null, // Would need to be resolved from ai_sources table
        category: getCategoryFromSource(rule.source)
      };
    }
  }

  return null;
}

function matchHeaders(headers: Headers): any | null {
  if (!rulesCache?.manifest?.heuristics?.headers) return null;

  for (const rule of rulesCache.heuristics.headers) {
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

/**
 * Get the current ruleset version for stamping events
 */
export function getCurrentRulesetVersion(): number {
  return rulesCache?.version || 0;
}

// Types
type Env = {
  AI_FINGERPRINTS: KVNamespace;
};

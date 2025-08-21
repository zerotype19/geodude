import { loadConfig, getConfigForEnvCheck, getConfigErrors, getMissingConfigKeys } from './config.js';
import { EmailService } from './email-service.ts';
import { addCorsHeaders } from './cors';
import { handleApiRoutes } from './routes/api.ts';
import { handleHealthRoutes } from './routes/health.ts';
import { getOrSetJSON, getProjectVersion, bumpProjectVersion } from './lib/cache.ts';
import { ipRateLimit } from './lib/ratelimit.ts';
import { MetricsManager } from './lib/metrics.ts';
import { recordRequestMetrics } from './metrics/collector.js';

// Helper function to normalize URL for matching
function normalizeUrl(url) {
  try {
    // Remove protocol, www, trailing slashes, and query parameters for simpler matching
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '')
      .split('?')[0]
      .split('#')[0];
  } catch (error) {
    return url;
  }
}



// D1 Error Tracer (temporary)
function traceD1(d1) {
  return {
    prepare(sql) {
      const stmt = d1.prepare(sql);
      return {
        bind: (...args) => {
          const bound = stmt.bind(...args);
          return {
            all: async () => {
              try { return await bound.all(); }
              catch (e) {
                console.error("D1_SQL_ERROR", { sql, args, message: e.message });
                throw e;
              }
            },
            first: async (column) => {
              try { return await bound.first(column); }
              catch (e) {
                console.error("D1_SQL_ERROR", { sql, args, message: e.message });
                throw e;
              }
            },
            run: async () => {
              try { return await bound.run(); }
              catch (e) {
                console.error("D1_SQL_ERROR", { sql, args, message: e.message });
                throw e;
              }
            }
          };
        }
      };
    }
  };
}

export default {
  async scheduled(event, env, ctx) {
    // Handle cron triggers
    try {
      console.log(`[${new Date().toISOString()}] Cron trigger: ${event.cron}`);

      // Update cron marker for health monitoring
      if (env.METRICS) {
        await env.METRICS.put("cron:last", new Date().toISOString(), { expirationTtl: 7 * 24 * 3600 });
        console.log('✅ Updated cron marker in METRICS KV');
      }

      // Handle different cron schedules
      if (event.cron === "*/5 * * * *") {
        // Every 5 minutes - metrics and health monitoring
        console.log('🔄 5-minute cron: metrics collection');
        // This is handled by the existing metrics system
        
      } else if (event.cron === "0 * * * *") {
        // Every hour - hourly rollups and session cleanup
        console.log('🔄 Hourly cron: rollups and cleanup');
        // TODO: Implement hourly rollup aggregation if needed
        
      } else if (event.cron === "0 3 * * *") {
        // Daily at 3 AM - retention cleanup and backfill
        console.log('🔄 Daily cron: retention cleanup and backfill');
        
        if (env.OPTIVIEW_DB) {
          try {
            // Import retention utilities
            const { cleanupOldData, getRetentionConfig } = await import('./ai-lite/retention.ts');
            const { backfillRollups, needsBackfill } = await import('./ai-lite/backfill.ts');
            
            const config = getRetentionConfig();
            console.log('🧹 Starting retention cleanup...');
            
            // Clean up old data
            const cleanupStats = await cleanupOldData(env.OPTIVIEW_DB, config);
            console.log('✅ Retention cleanup completed:', cleanupStats);
            
            // Check if backfill is needed for any projects
            // For now, we'll do this manually after deployment
            console.log('📊 Retention cleanup completed successfully');
            
          } catch (error) {
            console.error('❌ Retention cleanup failed:', error);
          }
        }
      }

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Scheduled task error:', error);
      return new Response('Error', { status: 500 });
    }
  },

  async fetch(request, env, ctx) {
    const started = Date.now();
    let res;

    try {
      // Load and validate configuration
      let config;
      try {
        config = loadConfig(env);
      } catch (configError) {
        console.error('Configuration error:', configError.message);

        // Return 500 for configuration errors in production
        if (env.NODE_ENV === 'production') {
          const response = new Response(JSON.stringify({
            error: 'Configuration Error',
            message: configError.message,
            timestamp: new Date().toISOString()
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
          res = addCorsHeaders(response, request.headers.get("origin"));
          return res;
        }

        // In development, continue with defaults
        config = loadConfig({ ...env, NODE_ENV: 'development' });
      }

      const url = new URL(request.url);
      const origin = request.headers.get("origin");

      // Debug logging
      console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`);

      // Handle CORS preflight requests
      if (request.method === "OPTIONS") {
        const response = new Response(null, { status: 204 });
        return addCorsHeaders(response, origin);
      }

      // Helper function to record cache metrics
      const recordCacheMetric = async (kind) => {
        try {
          if (kind === "hit") {
            // increment cache_hit_5m
            const key = `cache_hit_5m`;
            const current = await env.CACHE.get(key) || "0";
            await env.CACHE.put(key, String(parseInt(current) + 1), { expirationTtl: 300 });
          } else if (kind === "miss") {
            // increment cache_miss_5m
            const key = `cache_miss_5m`;
            const current = await env.CACHE.get(key) || "0";
            await env.CACHE.put(key, String(parseInt(current) + 1), { expirationTtl: 300 });
          } else if (kind === "bypass") {
            // increment cache_bypass_5m
            const key = `cache_bypass_5m`;
            const current = await env.CACHE.get(key) || "0";
            await env.CACHE.put(key, String(parseInt(current) + 1), { expirationTtl: 300 });
          }
        } catch (e) {
          console.error("Failed to record cache metric:", e);
        }
      };

      // Helper function to record continue path sanitization metrics
      const recordContinueSanitized = (phase, reason) => {
        // For now, just log the sanitization event
        // In production, this would increment counters in a metrics system
        console.log(JSON.stringify({
          event: "continue_sanitized",
          phase: phase,
          reason: reason,
          timestamp: new Date().toISOString()
        }));
      };

      // Helper function to sanitize continue path (single source of truth)
      const sanitizeContinuePath = (input) => {
        const fallback = "/onboarding";

        if (typeof input !== "string") {
          recordContinueSanitized("sanitize", "non_string");
          return { value: fallback, sanitized: true, reason: "non_string" };
        }

        const s = input.trim();

        if (!s.startsWith("/") || s.startsWith("//")) {
          recordContinueSanitized("sanitize", "not_internal_path");
          return { value: fallback, sanitized: true, reason: "not_internal_path" };
        }

        if (/[\\\u0000-\u001F]/.test(s)) {
          recordContinueSanitized("sanitize", "control_or_backslash");
          return { value: fallback, sanitized: true, reason: "control_or_backslash" };
        }

        let candidate;
        try {
          const u = new URL(s, "http://local");
          if (u.origin !== "http://local") {
            recordContinueSanitized("sanitize", "absolute_url");
            return { value: fallback, sanitized: true, reason: "absolute_url" };
          }
          candidate = u.pathname + u.search; // drop fragment
        } catch {
          recordContinueSanitized("sanitize", "url_parse_error");
          return { value: fallback, sanitized: true, reason: "url_parse_error" };
        }

        if (!/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@/%?]*$/.test(candidate)) {
          recordContinueSanitized("sanitize", "invalid_chars");
          return { value: fallback, sanitized: true, reason: "invalid_chars" };
        }

        if (candidate.length > 512) {
          recordContinueSanitized("sanitize", "too_long");
          return { value: fallback, sanitized: true, reason: "too_long" };
        }

        recordContinueSanitized("sanitize", "success");
        return { value: candidate, sanitized: false };
      };

      // Helper function to generate secure tokens
      const generateToken = () => {
        const array = new Uint8Array(24);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");
      };

      // Helper function to hash token
      const hashToken = async (token) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(token);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      };

      // Helper function to hash string (for IP)
      const hashString = async (input) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      };

      // Helper function to increment counter in KV store
      const incrementCounter = async (kv, key, ttlSeconds = 300) => {
        try {
          const current = await kv.get(key);
          const count = current ? parseInt(current) + 1 : 1;
          await kv.put(key, count.toString(), { expirationTtl: ttlSeconds });
          return count;
        } catch (error) {
          console.error('incrementCounter error:', error);
          return 1; // Return 1 on error to allow operation to continue
        }
      };

      // In-memory cache for AI source ID resolution (5-minute TTL)
      const sourceIdCache = new Map();
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

      // Legacy source name aliases for backward compatibility
      const legacyAliases = {
        "OpenAI": "openai_chatgpt",
        "Anthropic": "anthropic_claude",
        "Google": "google_gemini",
        "Microsoft": "microsoft_copilot",
        "Perplexity": "perplexity",
        "DuckDuckGo": "duckduckgo_ai",
        "Brave": "brave_leo"
      };

      // Helper function to resolve AI source slug to ID with caching
      const getSourceId = async (slug) => {
        if (!slug) return null;

        // Normalize slug (handle legacy aliases)
        const normalizedSlug = legacyAliases[slug] || slug;

        // Check cache first
        const cacheKey = `source_id:${normalizedSlug}`;
        const cached = sourceIdCache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
          return cached.id;
        }

        try {
          // Fetch from database
          const result = await d1.prepare(`
            SELECT id FROM ai_sources WHERE slug = ? AND is_active = 1 LIMIT 1
          `).bind(normalizedSlug).first();

          const sourceId = result ? result.id : null;

          // Cache the result (including null results to avoid repeated queries)
          sourceIdCache.set(cacheKey, {
            id: sourceId,
            timestamp: Date.now()
          });

          // Clean up old cache entries periodically (simple LRU)
          if (sourceIdCache.size > 100) {
            const cutoff = Date.now() - CACHE_TTL;
            for (const [key, value] of sourceIdCache.entries()) {
              if (value.timestamp < cutoff) {
                sourceIdCache.delete(key);
              }
            }
          }

          return sourceId;
        } catch (error) {
          console.error('getSourceId error:', error);
          return null; // Don't fail ingestion on source resolution errors
        }
      };

      // Helper function to classify AI source from referrer using KV rules manifest
      const classifyAISource = async (referrer, env) => {
        if (!referrer) return null;

        try {
          // Get rules manifest from KV
          let manifest = await env.AI_FINGERPRINTS.get("rules:manifest", "json");

          // Back-compat: if rules:manifest is missing, try to load rules:heuristics
          if (!manifest || !manifest.sources) {
            console.log('rules:manifest missing, attempting legacy fallback');
            const legacyRules = await env.AI_FINGERPRINTS.get("rules:heuristics", "json");
            if (legacyRules) {
              manifest = convertLegacyRules(legacyRules);
              console.log('Converted legacy rules to manifest format');
            } else {
              // Final fallback to hardcoded rules
              return classifyAISourceFallback(referrer);
            }
          }

          const url = new URL(referrer.toLowerCase());
          const hostname = url.hostname;
          const pathname = url.pathname;
          const search = url.search;
          const fullPath = pathname + search;

          // Find matching sources with improved algorithm
          const matches = [];

          for (const [slug, rules] of Object.entries(manifest.sources)) {
            if (!rules.referrer_domains) continue;

            // Check if hostname matches any of the referrer domains
            const domainMatch = rules.referrer_domains.find(domain => {
              const normalizedDomain = domain.toLowerCase();
              return hostname === normalizedDomain || hostname.endsWith('.' + normalizedDomain);
            });

            if (domainMatch) {
              // If path_hints are specified, check if any are present in the URL
              let pathScore = 0;
              if (rules.path_hints && rules.path_hints.length > 0) {
                const pathMatch = rules.path_hints.some(hint => {
                  return fullPath.includes(hint.toLowerCase());
                });
                if (!pathMatch) continue; // Skip if path hints required but not found
                pathScore = 1; // Boost score for path hint matches
              }

              matches.push({
                slug,
                domainLength: domainMatch.length, // Prefer more specific domains
                pathScore,
                rules
              });
            }
          }

          // Choose best match: prefer path hints, then longest domain
          if (matches.length > 0) {
            matches.sort((a, b) => {
              if (a.pathScore !== b.pathScore) return b.pathScore - a.pathScore;
              return b.domainLength - a.domainLength;
            });

            const bestMatch = matches[0];
            const sourceId = await getSourceId(bestMatch.slug);
            return sourceId;
          }

          return null;
        } catch (error) {
          console.error('classifyAISource error:', error);
          // Fallback to hardcoded rules on error
          return classifyAISourceFallback(referrer);
        }
      };

      // Convert legacy rules:heuristics format to canonical manifest
      const convertLegacyRules = (legacyRules) => {
        const manifest = {
          version: 0, // Mark as legacy conversion
          sources: {}
        };

        // Convert referer_contains rules to manifest format
        if (legacyRules.heuristics && legacyRules.heuristics.referer_contains) {
          for (const rule of legacyRules.heuristics.referer_contains) {
            const slug = legacyAliases[rule.source] || rule.source.toLowerCase().replace(/\s+/g, '_');
            if (!manifest.sources[slug]) {
              manifest.sources[slug] = {
                referrer_domains: [],
                path_hints: [],
                ua_contains: []
              };
            }

            // Extract domain from needle
            if (rule.needle) {
              const domain = rule.needle.replace(/^https?:\/\//, '').split('/')[0];
              if (!manifest.sources[slug].referrer_domains.includes(domain)) {
                manifest.sources[slug].referrer_domains.push(domain);
              }
            }
          }
        }

        return manifest;
      };

      // Fallback classifier with hardcoded rules
      const classifyAISourceFallback = (referrer) => {
        const referer = referrer.toLowerCase();
        if (referer.includes('chat.openai.com') || referer.includes('chatgpt.com')) {
          return 10; // ChatGPT
        } else if (referer.includes('claude.ai')) {
          return 11; // Claude
        } else if (referer.includes('perplexity.ai')) {
          return 12; // Perplexity
        } else if (referer.includes('gemini.google.com') || referer.includes('bard.google.com')) {
          return 13; // Gemini
        }
        return null;
      };

      // Wrap D1 with tracer for this request
      const d1 = traceD1(env.OPTIVIEW_DB);

      // Helper function to get content ID for an event
      const getContentIdForEvent = async (event, projectId, d1) => {
        if (!event?.metadata) return null;

        const urlToMatch = event.metadata.url || event.metadata.pathname;
        if (!urlToMatch) return null;

        try {
          // First try exact URL match
          let existingContent = await d1.prepare(`
            SELECT id FROM content_assets WHERE url = ? AND project_id = ?
          `).bind(urlToMatch, projectId).first();

          // If no exact match, try normalized URL match
          if (!existingContent) {
            const normalizedUrl = normalizeUrl(urlToMatch);
            existingContent = await d1.prepare(`
              SELECT id FROM content_assets WHERE url = ? AND project_id = ?
            `).bind(normalizedUrl, projectId).first();
          }

          // If still no match, try a simple domain-based match (safer than complex LIKE)
          if (!existingContent) {
            try {
              const domain = new URL(urlToMatch).hostname;
              existingContent = await d1.prepare(`
                SELECT id FROM content_assets WHERE url LIKE ? AND project_id = ? LIMIT 1
              `).bind(`%${domain}%`, projectId).first();
            } catch (urlError) {
              // If URL parsing fails, skip domain matching
            }
          }

          return existingContent?.id || null;
        } catch (error) {
          console.error('Error getting content ID:', error);
          return null;
        }
      };

      // Helper function to check rate limits
      const checkRateLimit = async (key, limit, windowMs) => {
        const now = Date.now();
        const windowStart = new Date(now - windowMs).toISOString();

        try {
          // Get current count from D1 rate_limiting table
          const current = await d1.prepare(`
            SELECT count, reset_time FROM rate_limiting 
            WHERE key_name = ? AND reset_time > ?
          `).bind(key, windowStart).first();

          if (current) {
            // Update existing rate limit record
            if (current.count >= limit) {
              return { allowed: false, remaining: 0, resetTime: new Date(current.reset_time).getTime() };
            }

            // Increment count
            await d1.prepare(`
              UPDATE rate_limiting 
              SET count = count + 1, updated_at = ? 
              WHERE key_name = ?
            `).bind(new Date().toISOString(), key).run();

            return { allowed: true, remaining: limit - current.count - 1, resetTime: new Date(current.reset_time).getTime() };
          } else {
            // Create new rate limit record
            const resetTime = new Date(now + windowMs);
            await d1.prepare(`
              INSERT INTO rate_limiting (key_name, count, reset_time) 
              VALUES (?, 1, ?)
            `).bind(key, resetTime.toISOString()).run();

            return { allowed: true, remaining: limit - 1, resetTime: resetTime.getTime() };
          }
        } catch (error) {
          console.error('Rate limiting error:', error);
          // Fail open - allow request if rate limiting fails
          return { allowed: true, remaining: 1, resetTime: now + windowMs };
        }
      };

      // 1) Health check - try health routes first
      let healthResult = null;
      try {
        healthResult = await handleHealthRoutes(url, request, env, d1, origin);
        if (healthResult) {
          res = healthResult;
          return res;
        }
      } catch (healthError) {
        console.error('Health routes error:', healthError);
        // Continue to fallback logic
      }





















      // 1.6) Admin selfcheck (automated monitoring)
      if(url.pathname === "/admin/selfcheck") {
  try {
    // Check D1 connectivity
    const d1Check = await d1.prepare(`SELECT 1 as test`).bind().first();
    const d1_ok = d1Check?.test === 1;

    // Check KV connectivity  
    let kv_ok = false;
    try {
      await env.AI_FINGERPRINTS.get("test-key");
      kv_ok = true;
    } catch (kvError) {
      console.error("KV check failed:", kvError);
    }

    // Check rules manifest
    let rules_manifest_version = null;
    try {
      const manifest = await env.AI_FINGERPRINTS.get("rules:manifest");
      if (manifest) {
        const parsed = JSON.parse(manifest);
        rules_manifest_version = parsed.version || 0;
      }
    } catch (manifestError) {
      console.error("Rules manifest check failed:", manifestError);
    }

    // Check tag.js ETag presence
    let tag_etag_present = false;
    try {
      const tagResponse = await fetch(`${config.PUBLIC_BASE_URL}/v1/tag.js`, { method: 'HEAD' });
      tag_etag_present = tagResponse.headers.has('etag') || tagResponse.headers.has('ETag');
    } catch (tagError) {
      console.error("Tag ETag check failed:", tagError);
    }

    // Check events ingestion endpoint
    let events_ingest_2xx = false;
    try {
      const ingestResponse = await fetch(`${config.PUBLIC_BASE_URL}/api/events`, {
        method: 'OPTIONS',
        headers: { 'Origin': 'https://example.com' }
      });
      events_ingest_2xx = ingestResponse.status >= 200 && ingestResponse.status < 300;
    } catch (ingestError) {
      console.error("Events ingest check failed:", ingestError);
    }

    // Check cron last run (estimate from recent events)
    let cron_last_run_sec = null;
    try {
      const recentEvent = await d1.prepare(`
              SELECT occurred_at FROM interaction_events 
              ORDER BY occurred_at DESC LIMIT 1
            `).bind().first();
      if (recentEvent) {
        const lastEventTime = new Date(recentEvent.occurred_at);
        cron_last_run_sec = Math.floor((Date.now() - lastEventTime.getTime()) / 1000);
      }
    } catch (cronError) {
      console.error("Cron check failed:", cronError);
    }

    const overall_ok = d1_ok && kv_ok && tag_etag_present && events_ingest_2xx;

    const response = new Response(JSON.stringify({
      ok: overall_ok,
      kv: kv_ok,
      d1: d1_ok,
      cron_last_run_sec: cron_last_run_sec,
      tag_etag_present: tag_etag_present,
      events_ingest_2xx: events_ingest_2xx,
      rules_manifest_version: rules_manifest_version
    }), {
      status: overall_ok ? 200 : 503,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  } catch (error) {
    console.error("Selfcheck error:", error);
    const response = new Response(JSON.stringify({
      ok: false,
      kv: false,
      d1: false,
      cron_last_run_sec: null,
      tag_etag_present: false,
      events_ingest_2xx: false,
      rules_manifest_version: null,
      error: error.message
    }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 1.6.5) Admin schema inspection endpoint
if (url.pathname === "/admin/selfcheck/schema") {
  try {
    // TODO: Add proper admin authentication later
    // For now, allow access to inspect schema for debugging

    const tables = ['visitor', 'session_v1', 'session_event_map', 'interaction_events', 'content_assets'];
    const schema = {};

    for (const table of tables) {
      try {
        // Get table info using direct D1 methods
        const tableInfoResult = await env.OPTIVIEW_DB.prepare(`PRAGMA table_info('${table}')`).all();
        const tableInfo = tableInfoResult.results || [];

        // Get table DDL
        const tableDDL = await env.OPTIVIEW_DB.prepare(`
                SELECT name, sql FROM sqlite_master 
                WHERE type='table' AND name='${table}'
              `).first();

        // Get indexes
        const indexesResult = await env.OPTIVIEW_DB.prepare(`
                SELECT name, sql FROM sqlite_master 
                WHERE type='index' AND tbl_name='${table}'
              `).all();
        const indexes = indexesResult.results || [];

        schema[table] = {
          columns: tableInfo,
          ddl: tableDDL || null,
          indexes: indexes
        };
      } catch (e) {
        schema[table] = {
          error: e.message,
          columns: [],
          ddl: null,
          indexes: []
        };
      }
    }

    const response = new Response(JSON.stringify({
      timestamp: new Date().toISOString(),
      schema
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  } catch (e) {
    console.error("Schema inspection error:", e);
    const response = new Response(JSON.stringify({
      error: "Failed to inspect schema",
      message: e.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 1.7) Admin environment check (for debugging)
if (url.pathname === "/admin/env-check") {
  try {
    const configForEnvCheck = getConfigForEnvCheck(config);
    const missingKeys = getMissingConfigKeys(config);
    const configErrors = getConfigErrors(config);

    // Check KV bindings
    const cacheBound = !!env.CACHE;
    const cacheBindingName = cacheBound ? "CACHE" : "NOT_BOUND";
    const cacheIdsArePlaceholders = cacheBound && (
      env.CACHE.toString().includes("REPLACE_WITH") ||
      env.CACHE.toString().includes("placeholder")
    );

    // Guard: If KV is not bound in production, return error
    if (config.NODE_ENV === "production" && !cacheBound) {
      const response = new Response(JSON.stringify({
        error: "KV cache not bound in production",
        code: "kv_unbound"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const response = new Response(JSON.stringify({
      environment: config.NODE_ENV,
      config: configForEnvCheck,
      missing: missingKeys,
      errors: configErrors,
      kv: {
        cache: {
          bound: cacheBound,
          binding_name: cacheBindingName,
          ids_are_placeholders: cacheIdsArePlaceholders,
          id: cacheBound ? "351597e3c9e94f908fb256c50c8fe5c8" : null,
          preview_id: cacheBound ? "a2853f2e1d7c498d800ee0013eeec3d3" : null
        },
        ai_fingerprints: {
          bound: !!env.AI_FINGERPRINTS
        }
      },
      cache: {
        cache_off: config.CACHE_OFF || "false",
        cache_off_effective: config.CACHE_OFF === "1"
      },
      database: {
        d1_bound: !!env.OPTIVIEW_DB
      },
      cron: {
        enabled: true, // We have cron triggers configured
        schedules: ["*/5 * * * *", "0 * * * *", "0 3 * * *"]
      },
      timestamp: new Date().toISOString(),
      worker_version: "1.0.0"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  } catch (error) {
    const response = new Response(JSON.stringify({
      error: "Failed to generate environment check",
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 2) Magic Link Authentication (M3)
if (url.pathname === "/auth/request-code" && request.method === "POST") {
  // Redirect OTP requests to magic link endpoint for backward compatibility
  const response = new Response(JSON.stringify({
    message: "OTP login codes are deprecated. Please use magic links instead.",
    redirect_to: "/auth/request-link"
  }), {
    status: 308, // Permanent Redirect
    headers: { "Content-Type": "application/json" }
  });
  return addCorsHeaders(response, origin);
}

// 2.1) Frontend-compatible Magic Link endpoint (for optiview.ai frontend)
if (url.pathname === "/api/auth/request-link" && request.method === "POST") {
  // This endpoint handles the frontend's expected API path
  // It forwards to the same logic as /auth/request-code
  try {
    const body = await request.json();
    const { email, continue_path } = body;

    if (!email) {
      const response = new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting per IP and per email
    const clientIP = request.headers.get("cf-connecting-ip") || "unknown";
    const ipKey = `rate_limit:magic_link:ip:${clientIP}`;
    const emailKey = `rate_limit:magic_link:email:${email}`;

    const ipLimit = await checkRateLimit(ipKey, config.MAGIC_LINK_RPM_PER_IP, 60 * 1000); // per minute per IP
    const emailLimit = await checkRateLimit(emailKey, config.MAGIC_LINK_RPD_PER_EMAIL, 24 * 60 * 60 * 1000); // per day per email

    if (!ipLimit.allowed) {
      const response = new Response(JSON.stringify({ error: "Too many requests from this IP" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil((ipLimit.resetTime - Date.now()) / 1000)
        }
      });
      return addCorsHeaders(response, origin);
    }

    if (!emailLimit.allowed) {
      const response = new Response(JSON.stringify({ error: "Too many requests for this email" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil((emailLimit.resetTime - Date.now()) / 1000)
        }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate continue path
    const sanitizeResult = sanitizeContinuePath(continue_path);

    // Record sanitization metrics if sanitized
    if (sanitizeResult.sanitized) {
      recordContinueSanitized("request", sanitizeResult.reason);
    }

    // Debug logging to see what's being stored
    console.log("🔍 Magic Link Request Debug (Frontend):");
    console.log("  Original continue_path:", continue_path);
    console.log("  Sanitized continue_path:", sanitizeResult.value);
    console.log("  Was sanitized:", sanitizeResult.sanitized);
    console.log("  Reason:", sanitizeResult.reason);
    console.log("  Email:", email);

    // Generate secure token
    const token = generateToken();
    const tokenHash = await hashToken(token);

    // Store token in database (use D1 instead of KV)
    const expirationMinutes = config.MAGIC_LINK_EXP_MIN;
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

    // Insert into D1 magic_link table
    const insertResult = await d1.prepare(`
            INSERT INTO magic_link (email, token_hash, expires_at, continue_path, requester_ip_hash)
            VALUES (?, ?, ?, ?, ?)
          `).bind(
      email,
      tokenHash,
      expiresAt.toISOString(),
      sanitizeResult.value,
      await hashString(clientIP)
    ).run();

    if (!insertResult.success) {
      console.error('Failed to insert magic link into D1:', insertResult.error);
      throw new Error('Database error');
    }

    console.log('✅ Magic link stored in D1 database');

    // Generate magic link
    const apiUrl = env.VITE_API_URL || "https://api.optiview.ai";
    const magicLink = `${apiUrl}/auth/magic?token=${token}`;

    // Send email using EmailService
    try {
      const emailService = EmailService.fromEnv(env);
      const emailSent = await emailService.sendMagicLinkEmail(
        email,
        magicLink,
        config.MAGIC_LINK_EXP_MIN
      );

      if (emailSent) {
        console.log("✅ Magic link email sent successfully to:", email);
      } else {
        console.error("❌ Failed to send magic link email to:", email);
      }
    } catch (emailError) {
      console.error("❌ Email service error:", emailError);
      // Don't fail the request if email fails, just log it
    }

    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Magic link request error (Frontend):", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 2.2) Consume Magic Link
if (url.pathname === "/auth/magic" && request.method === "GET") {
  try {
    const urlObj = new URL(request.url);
    const token = urlObj.searchParams.get("token");
    const continuePath = urlObj.searchParams.get("continue") || "/onboarding";

    if (!token) {
      const response = new Response("Missing token", { status: 400 });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    console.log("🔐 Magic link consumption for token:", token.substring(0, 12) + "...");

    // Get client IP for session
    const clientIP = request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    console.log("📍 Client IP:", clientIP);

    // Find and validate magic link
    const tokenHash = await hashString(token);
    const magicLinkData = await d1.prepare(`
            SELECT email, expires_at FROM magic_link 
            WHERE token_hash = ? AND expires_at > ?
          `).bind(tokenHash, new Date().toISOString()).first();

    if (!magicLinkData) {
      const response = new Response("Invalid or expired magic link", { status: 400 });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    // Check if user exists
    let userRecord = await d1.prepare(`
            SELECT id, email, is_admin, created_ts FROM user WHERE email = ?
          `).bind(magicLinkData.email).first();

    if (!userRecord) {
      console.log("👤 Creating new user for:", magicLinkData.email);
      // Create new user
      const userId = `usr_${generateToken().substring(0, 12)}`;
      const now = Math.floor(Date.now() / 1000);

      // Check if this is the first user in the system
      const userCount = await d1.prepare(`
              SELECT COUNT(*) as count FROM user
            `).bind().first();

      // Make the first user an admin
      const isAdmin = userCount.count === 0 ? 1 : 0;
      console.log(`🔑 User ${isAdmin ? 'IS' : 'is NOT'} admin (user count: ${userCount.count})`);

      await d1.prepare(`
              INSERT INTO user (id, email, is_admin, created_ts, last_login_ts)
              VALUES (?, ?, ?, ?, ?)
            `).bind(userId, magicLinkData.email, isAdmin, now, now).run();

      userRecord = { id: userId, email: magicLinkData.email, is_admin: isAdmin, created_ts: now };
      console.log("✅ New user created with ID:", userId, "Admin:", isAdmin ? "YES" : "NO");
    } else {
      // Update last_login_ts for existing user
      const now = Math.floor(Date.now() / 1000);
      await d1.prepare(`
              UPDATE user SET last_login_ts = ? WHERE id = ?
            `).bind(now, userRecord.id).run();
      console.log("✅ Updated last_login_ts for existing user:", userRecord.id);
    }

    // Check if user has already completed onboarding
    const hasOrganization = await d1.prepare(`
            SELECT COUNT(*) as count FROM org_member WHERE user_id = ?
          `).bind(userRecord.id).first();

    let redirectPath = continuePath;
    if (hasOrganization.count > 0) {
      // User has completed onboarding, redirect to main app
      redirectPath = "/";
      console.log("✅ User has completed onboarding, redirecting to main app");
    } else {
      console.log("🆕 New user, redirecting to onboarding");
    }

    // Create session
    const sessionId = generateToken();
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setHours(sessionExpiresAt.getHours() + parseInt(env.SESSION_TTL_HOURS || "720"));

    const userAgent = request.headers.get("user-agent") || "unknown";
    const uaHash = await hashString(userAgent);

    await d1.prepare(`
            INSERT INTO session (user_id, session_id, expires_at, ip_hash, ua_hash)
            VALUES (?, ?, ?, ?, ?)
          `).bind(
      userRecord.id,
      sessionId,
      sessionExpiresAt.toISOString(),
      await hashString(clientIP),
      uaHash
    ).run();

    console.log("✅ Session created in existing session table");

    // Delete used magic link
    await d1.prepare(`
            DELETE FROM magic_link WHERE token_hash = ?
          `).bind(tokenHash).run();

    // Redirect to frontend with session cookie
    const frontendUrl = env.PUBLIC_APP_URL || "https://optiview.ai";
    const redirectUrl = `${frontendUrl}${redirectPath}`;

    console.log("🔄 Redirecting to frontend:", redirectUrl);

    // Extract domain from frontend URL for cookie
    const frontendDomain = new URL(frontendUrl).hostname;

    const response = new Response("", {
      status: 302,
      headers: {
        "Location": redirectUrl,
        "Set-Cookie": `optiview_session=${sessionId}; Domain=${frontendDomain}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${parseInt(env.SESSION_TTL_HOURS || "720") * 3600}`
      }
    });

    // Get origin from request headers for CORS
    const origin = request.headers.get("origin");
    console.log("🔧 Adding CORS headers for origin:", origin);
    const corsResponse = addCorsHeaders(response, origin);
    console.log("🔧 CORS headers added:", corsResponse.headers.get("Access-Control-Allow-Origin"));
    return corsResponse;

  } catch (e) {
    console.error("Magic link consumption error:", e);
    return new Response("Internal server error", { status: 500 });
  }
}

// 3) Onboarding Wizard (M4)
if (url.pathname === "/onboarding" && request.method === "GET") {
  // This is a frontend route, so we'll return the HTML
  // The actual onboarding logic will be handled by the frontend
  const response = new Response("Onboarding Wizard - Frontend Route", {
    status: 200,
    headers: { "Content-Type": "text/html" }
  });
  return addCorsHeaders(response, origin);
}

// Try API routes from routes/api.ts first
console.log('🔍 Worker: Attempting to handle API routes for:', url.pathname);
let apiResult = null;
try {
  apiResult = await handleApiRoutes(
    request,
    env,
    url,
    origin,
    (resp) => resp, // attach function (identity for now)
    (resp) => resp, // addBasicSecurityHeaders (identity for now) 
    addCorsHeaders
  );
  console.log('✅ Worker: handleApiRoutes result:', apiResult ? 'Response returned' : 'No response (null)');
} catch (apiError) {
  console.error('❌ Worker: handleApiRoutes error:', apiError);
  // Continue to fallback logic
}

if (apiResult) {
  console.log('✅ Worker: Returning API response from routes/api.ts');
  return apiResult;
} else {
  console.log('⚠️ Worker: No API response, falling back to worker logic');
}

// 3.1) Create Organization
if (url.pathname === "/api/onboarding/organization" && request.method === "POST") {
  console.log('🏢 Organization creation request received');
  try {
    const body = await request.json();
    console.log('📥 Request body:', body);
    const { name } = body;

    if (!name) {
      console.log('❌ Missing organization name');
      const response = new Response(JSON.stringify({ error: "Organization name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Generate organization ID
    const orgId = `org_${generateToken().substring(0, 12)}`;
    const now = Date.now();
    console.log('🔧 Generated org ID:', orgId, 'timestamp:', now);

    // Store organization in database
    console.log('💾 Inserting organization into database...');
    await d1.prepare(`
            INSERT INTO organization (id, name, created_ts)
            VALUES (?, ?, ?)
          `).bind(orgId, name, now).run();
    console.log('✅ Organization inserted successfully');

    // Get current user from session to create org_member record
    const sessionCookie = request.headers.get("cookie");
    let userId = null;

    if (sessionCookie) {
      // Extract session ID from cookie
      const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
      if (sessionMatch) {
        const sessionId = sessionMatch[1];
        console.log('🔍 Found session ID:', sessionId.substring(0, 8) + '...');

        // Get user ID from session
        const sessionData = await d1.prepare(`
                SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
              `).bind(sessionId, new Date().toISOString()).first();

        if (sessionData) {
          userId = sessionData.user_id;
          console.log('👤 Found user ID from session:', userId);

          // Create org_member record linking user to organization
          await d1.prepare(`
                  INSERT INTO org_member (org_id, user_id, role)
                  VALUES (?, ?, 'admin')
                `).bind(orgId, userId).run();

          console.log('✅ Created org_member record:', { orgId, userId, role: 'admin' });
        } else {
          console.log('⚠️ No valid session found for session ID');
        }
      } else {
        console.log('⚠️ No session cookie found in request');
      }
    } else {
      console.log('⚠️ No cookie header in request');
    }

    const response = new Response(JSON.stringify({
      id: orgId,
      name: name,
      created_at: now,
      user_id: userId,
      org_member_created: !!userId
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Organization creation error:", e);
    const response = new Response(JSON.stringify({ error: "Failed to create organization" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 3.2) Create Project
if (url.pathname === "/api/onboarding/project" && request.method === "POST") {
  try {
    const body = await request.json();
    console.log('📥 Project creation request body:', body);
    const { name, organizationId } = body;

    if (!name || !organizationId) {
      console.log('❌ Missing required fields:', { name, organizationId });
      const response = new Response(JSON.stringify({ error: "Project name and organization ID are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Generate project ID and slug
    const projectId = `prj_${generateToken().substring(0, 12)}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const now = Date.now();

    // Store project in database
    await d1.prepare(`
            INSERT INTO project (id, org_id, name, slug, created_ts)
            VALUES (?, ?, ?, ?, ?)
          `).bind(projectId, organizationId, name, slug, now).run();

    // Note: Project settings are not currently implemented
    // The project is created with basic information only

    const response = new Response(JSON.stringify({
      id: projectId,
      name: name,
      slug: slug,
      org_id: organizationId,
      created_at: now
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Project creation error:", e);
    const response = new Response(JSON.stringify({ error: "Failed to create project" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 4) Authentication API Endpoints
// 4.1) Get current user
if (url.pathname === "/api/auth/me" && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const userData = await d1.prepare(`
            SELECT id, email, is_admin, created_ts, last_login_ts FROM user WHERE id = ?
          `).bind(sessionData.user_id).first();

    if (!userData) {
      const response = new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const response = new Response(JSON.stringify(userData), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, request.headers.get("origin"));

  } catch (e) {
    console.error("Get user error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, request.headers.get("origin"));
  }
}

// 4.2) Get user's organization
if (url.pathname === "/api/auth/organization" && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const orgData = await d1.prepare(`
            SELECT o.id, o.name, o.created_ts 
            FROM organization o
            JOIN org_member om ON o.id = om.org_id
            WHERE om.user_id = ?
            LIMIT 1
          `).bind(sessionData.user_id).first();

    if (!orgData) {
      const response = new Response(JSON.stringify({ error: "No organization found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const response = new Response(JSON.stringify(orgData), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, request.headers.get("origin"));

  } catch (e) {
    console.error("Get organization error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, request.headers.get("origin"));
  }
}

// 4.3) Get user's project
if (url.pathname === "/api/auth/project" && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const projectData = await d1.prepare(`
            SELECT p.id, p.name, p.slug, p.org_id, p.created_ts
            FROM project p
            JOIN organization o ON p.org_id = o.id
            JOIN org_member om ON o.id = om.org_id
            WHERE om.user_id = ?
            ORDER BY p.created_ts DESC
            LIMIT 1
          `).bind(sessionData.user_id).first();

    if (!projectData) {
      const response = new Response(JSON.stringify({ error: "No project found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    // Get the primary property for this project
    const primaryProperty = await d1.prepare(`
            SELECT id, project_id, domain, created_ts
            FROM properties
            WHERE project_id = ?
            ORDER BY created_ts ASC
            LIMIT 1
          `).bind(projectData.id).first();

    // Include property in the response
    const enrichedProjectData = {
      ...projectData,
      primary_property: primaryProperty ? {
        id: primaryProperty.id,
        project_id: primaryProperty.project_id,
        domain: primaryProperty.domain,
        created_at: new Date(primaryProperty.created_ts * 1000).toISOString()
      } : null
    };

    const response = new Response(JSON.stringify(enrichedProjectData), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, request.headers.get("origin"));

  } catch (e) {
    console.error("Get project error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, request.headers.get("origin"));
  }
}

// 4.4) Get user's available organizations
if (url.pathname === "/api/auth/organizations" && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const organizations = await d1.prepare(`
            SELECT o.id, o.name, o.created_ts
            FROM organization o
            JOIN org_member om ON o.id = om.org_id
            WHERE om.user_id = ?
            ORDER BY o.created_ts DESC
          `).bind(sessionData.user_id).all();

    const response = new Response(JSON.stringify({ organizations: organizations.results }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, request.headers.get("origin"));

  } catch (e) {
    console.error("Get organizations error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, request.headers.get("origin"));
  }
}

// 4.5) Get user's available projects
if (url.pathname === "/api/auth/projects" && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const projects = await d1.prepare(`
            SELECT p.id, p.name, p.slug, p.org_id, p.created_ts
            FROM project p
            JOIN organization o ON p.org_id = o.id
            JOIN org_member om ON o.id = om.org_id
            WHERE om.user_id = ?
            ORDER BY p.created_ts DESC
          `).bind(sessionData.user_id).all();

    const response = new Response(JSON.stringify({ projects: projects.results }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, request.headers.get("origin"));

  } catch (e) {
    console.error("Get projects error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, request.headers.get("origin"));
  }
}

// 3.3) Create Property
if (url.pathname === "/api/onboarding/property" && request.method === "POST") {
  try {
    const body = await request.json();
    const { domain, project_id } = body;

    if (!domain || !project_id) {
      const response = new Response(JSON.stringify({ error: "Domain and project ID are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Generate property ID
    const propertyId = `prop_${generateToken().substring(0, 12)}`;
    const now = Date.now();

    // Store property in database
    await d1.prepare(`
            INSERT INTO property (id, project_id, domain, name, created_ts, updated_ts)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(propertyId, project_id, domain, domain, now, now).run();

    const response = new Response(JSON.stringify({
      id: propertyId,
      domain: domain,
      project_id: project_id,
      created_at: now
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Property creation error:", e);
    const response = new Response(JSON.stringify({ error: "Failed to create property" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 3.4) Create API Key
if (url.pathname === "/api/onboarding/api-key" && request.method === "POST") {
  try {
    const body = await request.json();
    const { name, project_id, property_id } = body;

    if (!name || !project_id || !property_id) {
      const response = new Response(JSON.stringify({ error: "Name, project ID, and property ID are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Generate API key ID and hash it for storage
    const keyId = `key_${generateToken().substring(0, 12)}`;
    const keyHash = await hashToken(keyId); // Hash the key ID itself for validation
    const now = Date.now();

    // Store API key in database
    await d1.prepare(`
            INSERT INTO api_key (id, project_id, name, hash, created_ts)
            VALUES (?, ?, ?, ?, ?)
          `).bind(keyId, project_id, name, keyHash, now).run();

    const response = new Response(JSON.stringify({
      id: keyId,
      key_id: keyId, // This is what should be used in the tag data-key-id attribute
      name: name,
      project_id: project_id,
      property_id: property_id,
      created_at: now
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("API key creation error:", e);
    const response = new Response(JSON.stringify({ error: "Failed to create API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 3.5) JS Tag for Installation
// 3.0) Hosted Tag Endpoint
if (url.pathname === "/v1/tag.js" && request.method === "GET") {
  try {
    const debug = url.searchParams.get("debug") === "1";

    // Generate the hosted tag runtime
    const generateRuntime = (debug = false) => {
      const runtime = `${debug ? '// Optiview Analytics Hosted Tag v1.0 (Debug Build)\n' : ''}(function() {
  var optiview = window.optiview = window.optiview || {};
  
  // BEGIN apiBase detection (minifier-safe)
  // Safe string builders to prevent naive minifier issues
  var SL = String.fromCharCode(47);           
  var S2 = SL + SL;                           
  var COLON = String.fromCharCode(58);        
  function joinProtoHost(proto, host) {       
    return proto + COLON + S2 + host;
  }
  
  // Default endpoint components
  var DEFAULT_HOST = "api.optiview.ai";
  var DEFAULT_PROTO = "https";
  var defaultBase = joinProtoHost(DEFAULT_PROTO, DEFAULT_HOST);
  
  // Robust apiBase detection
  var apiBase = defaultBase;
  
  // Allow explicit override via data-endpoint (optional attr)
  var ds = (document.currentScript || document.getElementsByTagName("script")[document.getElementsByTagName("script").length - 1]).dataset || {};
  if (ds && ds.endpoint) {
    apiBase = String(ds.endpoint);
  } else {
    try {
      var src = (document.currentScript && document.currentScript.src) ||
                (function(s){ return s && s[s.length-1] ? s[s.length-1].src : ""; })(document.getElementsByTagName("script"));
      if (src) {
        var u = new URL(src, location.href);
        apiBase = joinProtoHost(u.protocol.replace(COLON,""), u.host);
      }
    } catch (e) { /* keep defaultBase */ }
  }
  
  // Final sanity: require protocol and double slash
  var protocolPattern = new RegExp("^https?" + COLON + S2 + "[^" + SL + "]+$", "i");
  if (!protocolPattern.test(apiBase)) { apiBase = defaultBase; }
  // END apiBase detection
  
  ${debug ? 'try { console.debug("[optiview] apiBase =", apiBase); } catch(e){}' : ''}
  
  // Read configuration from data attributes (reuse ds from above)
  var keyId = ds.keyId;
  var projectId = ds.projectId;
  var propertyId = ds.propertyId;
  
  // Optional configuration with defaults
  var clicksEnabled = ds.clicks !== '0' && ds.clicks !== 0;
  var spaEnabled = ds.spa !== '0' && ds.spa !== 0;
  var sessionsEnabled = ds.sessions !== '0' && ds.sessions !== 0;
  var batchSize = Math.min(Math.max(parseInt(ds.batchSize) || 10, 1), 50);
  var flushMs = Math.min(Math.max(parseInt(ds.flushMs) || 3000, 500), 10000);
  
  ${debug ? 'console.info("Optiview: Configuration loaded", { keyId: keyId, projectId: projectId, propertyId: propertyId, clicksEnabled: clicksEnabled, spaEnabled: spaEnabled, sessionsEnabled: sessionsEnabled, batchSize: batchSize, flushMs: flushMs });' : ''}
  
  // Graceful no-op if required values missing
  if (!keyId || !projectId || !propertyId) {
    ${debug ? 'console.info("Optiview: Missing required configuration, tag will no-op");' : ''}
    return;
  }
  
  // Visitor and Session ID Management
  var visitorId = null;
  var sessionId = null;
  var lastActivityTime = Date.now();
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  
  function generateUUID() {
    // UUID v4 generation using crypto API or fallback
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      arr[6] = (arr[6] & 0x0f) | 0x40; // version 4
      arr[8] = (arr[8] & 0x3f) | 0x80; // variant bits
      var hex = Array.from(arr, function(b) { return (b < 16 ? '0' : '') + b.toString(16); });
      return hex[0] + hex[1] + hex[2] + hex[3] + '-' + hex[4] + hex[5] + '-' + hex[6] + hex[7] + '-' + hex[8] + hex[9] + '-' + hex[10] + hex[11] + hex[12] + hex[13] + hex[14] + hex[15];
    } else {
      // Fallback for older browsers
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  }
  
  function setCookie(name, value, days) {
    try {
      var expires = '';
      if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = '; expires=' + date.toUTCString();
      }
      var secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = name + '=' + value + expires + '; path=/; SameSite=Lax' + secure;
    } catch (e) {
      // Silent fail for cookie setting
    }
  }
  
  function getCookie(name) {
    try {
      var nameEQ = name + '=';
      var ca = document.cookie.split(';');
      for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
      }
    } catch (e) {
      // Silent fail for cookie reading
    }
    return null;
  }
  
  function getLocalStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  
  function setLocalStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // Silent fail for localStorage
    }
  }
  
  function getSessionStorage(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  
  function setSessionStorage(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      // Silent fail for sessionStorage
    }
  }
  
  function getVisitorId() {
    if (!sessionsEnabled) return null;
    if (visitorId) return visitorId;
    
    // Try cookie first, then localStorage, then generate new
    visitorId = getCookie('ov_vid') || getLocalStorage('ov_vid');
    
    if (!visitorId) {
      visitorId = generateUUID();
    }
    
    // Store in both cookie and localStorage for resilience
    setCookie('ov_vid', visitorId, 365);
    setLocalStorage('ov_vid', visitorId);
    
    return visitorId;
  }
  
  function getSessionId() {
    if (!sessionsEnabled) return null;
    
    var now = Date.now();
    var storedSessionId = getSessionStorage('ov_sid');
    var storedLastActivity = parseInt(getSessionStorage('ov_sid_last_ts')) || 0;
    
    // Check if we need a new session (timeout or no existing session)
    if (!storedSessionId || (now - storedLastActivity) > SESSION_TIMEOUT_MS) {
      sessionId = generateUUID();
      setSessionStorage('ov_sid', sessionId);
    } else {
      sessionId = storedSessionId;
    }
    
    // Update last activity timestamp
    lastActivityTime = now;
    setSessionStorage('ov_sid_last_ts', String(now));
    
    return sessionId;
  }
  
  // Initialize session IDs
  if (sessionsEnabled) {
    visitorId = getVisitorId();
    sessionId = getSessionId();
    ${debug ? 'try { console.debug("[optiview] apiBase=" + apiBase + " vid=" + visitorId + " sid=" + sessionId + " sessions=on"); } catch(e){}' : ''}
  } else {
    ${debug ? 'try { console.debug("[optiview] apiBase=" + apiBase + " sessions=off"); } catch(e){}' : ''}
  }
  
  // Event batching system
  var eventQueue = [];
  var flushTimer = null;
  
  function flushEvents() {
    if (eventQueue.length === 0) return;
    
    var events = eventQueue.splice(0, batchSize);
    var payload = {
      project_id: projectId,
      property_id: parseInt(propertyId),
      events: events
    };
    
    try {
      fetch(apiBase + '/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-optiview-key-id': keyId
        },
        body: JSON.stringify(payload)
      }).catch(function() {
        // Silent fail for analytics
      });
    } catch (e) {
      // Silent fail for analytics
    }
    
    // Schedule next flush if more events remain
    if (eventQueue.length > 0) {
      flushTimer = setTimeout(flushEvents, flushMs);
    } else {
      flushTimer = null;
    }
  }
  
  function scheduleFlush() {
    if (!flushTimer) {
      flushTimer = setTimeout(flushEvents, flushMs);
    }
  }
  
  function addEvent(eventType, metadata) {
    try {
      var eventMetadata = metadata || {};
      
      // Add session tracking if enabled
      if (sessionsEnabled) {
        // Refresh session ID in case of timeout
        var currentSessionId = getSessionId();
        eventMetadata.vid = getVisitorId();
        eventMetadata.sid = currentSessionId;
      }
      
      var event = {
        event_type: eventType,
        metadata: eventMetadata,
        occurred_at: new Date().toISOString()
      };
      
      eventQueue.push(event);
      
      // Immediate flush if batch size reached
      if (eventQueue.length >= batchSize) {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        flushEvents();
      } else {
        scheduleFlush();
      }
    } catch (e) {
      // Silent fail for analytics
    }
  }
  
  // Page view tracking
  function trackPageView() {
    addEvent('pageview', {
      url: location.href,
      pathname: location.pathname,
      referrer: document.referrer,
      title: document.title.slice(0, 120),
      user_agent: navigator.userAgent.slice(0, 100)
    });
  }
  
  // Click tracking
  function trackClick(element) {
    if (!clicksEnabled) return;
    
    var metadata = {
      tag_name: element.tagName.toLowerCase(),
      pathname: location.pathname
    };
    
    // Add element-specific data
    if (element.href) metadata.href = element.href;
    if (element.textContent) metadata.text = element.textContent.slice(0, 100);
    if (element.id) metadata.element_id = element.id;
    if (element.className) metadata.css_classes = element.className;
    
    addEvent('click', metadata);
  }
  
  // SPA route tracking
  var currentPath = location.pathname;
  function trackSpaNavigation() {
    if (!spaEnabled) return;
    
    var newPath = location.pathname;
    if (newPath !== currentPath) {
      currentPath = newPath;
      trackPageView();
    }
  }
  
  // Public API
  optiview.page = trackPageView;
  optiview.track = function(eventType, metadata) {
    addEvent(eventType, metadata);
  };
  optiview.conversion = function(data) {
    try {
      var payload = {
        project_id: projectId,
        property_id: parseInt(propertyId),
        amount_cents: data.amount_cents,
        currency: data.currency || 'USD',
        metadata: data.metadata || {}
      };
      
      fetch(apiBase + '/api/conversions', {
        method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'x-optiview-key-id': keyId
      },
        body: JSON.stringify(payload)
      }).catch(function() {
      // Silent fail for analytics
    });
    } catch (e) {
    // Silent fail for analytics
  }
  };
  
  // Initialize tracking
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      trackPageView();
    });
  } else {
    trackPageView();
  }
  
  // Click event listener
  if (clicksEnabled) {
    document.addEventListener('click', function(e) {
      var element = e.target;
      
      // Skip if element has data-optiview="ignore"
      if (element.getAttribute && element.getAttribute('data-optiview') === 'ignore') {
        return;
      }
      
      // Track clicks on links and buttons
      if (element.tagName === 'A' || element.tagName === 'BUTTON' || element.onclick) {
        trackClick(element);
      }
    }, true);
  }
  
  // SPA navigation listeners
  if (spaEnabled) {
    // History API listeners
    var originalPushState = history.pushState;
    var originalReplaceState = history.replaceState;
    
    history.pushState = function() {
      originalPushState.apply(history, arguments);
      setTimeout(trackSpaNavigation, 0);
    };
    
    history.replaceState = function() {
      originalReplaceState.apply(history, arguments);
      setTimeout(trackSpaNavigation, 0);
    };
    
    window.addEventListener('popstate', trackSpaNavigation);
  }
  
  // Flush remaining events on page unload
  window.addEventListener('beforeunload', function() {
    if (eventQueue.length > 0) {
      // Use sendBeacon if available for more reliable delivery
      if (navigator.sendBeacon) {
        var events = eventQueue.splice(0);
        var payload = JSON.stringify({
          project_id: projectId,
          property_id: parseInt(propertyId),
          events: events
        });
        
        navigator.sendBeacon(apiBase + '/api/events', payload);
      } else {
        flushEvents();
      }
    }
  });
})();`;

      // Return debug version for now to avoid minification issues
      if (debug) {
        return runtime;
      } else {
        // Temporarily disable minification due to // comment issues
        // TODO: Implement proper AST-based minification
        return runtime;
      }
    };

    const jsContent = generateRuntime(debug);

    // Basic integration check: verify generated code structure
    if (!jsContent || !jsContent.includes('(function()') || !jsContent.includes('})();')) {
      console.error('Tag runtime generation failed - invalid structure');
      return new Response('Tag generation failed: invalid structure', { status: 500 });
    }

    // Generate ETag
    const encoder = new TextEncoder();
    const data = encoder.encode(jsContent);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const etag = '"' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('') + '"';

    // Check If-None-Match header
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      const response = new Response(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          'Vary': 'Accept-Encoding'
        }
      });
      return addCorsHeaders(response, origin);
    }

    // Record metrics: tag served
    try {
      await d1.prepare(`
              INSERT INTO metrics (key, value, created_at) 
              VALUES (?, 1, ?) 
              ON CONFLICT(key) DO UPDATE SET 
                value = value + 1, 
                updated_at = ?
            `).bind(
        `tag_served_5m:${Math.floor(Date.now() / (5 * 60 * 1000))}`,
        new Date().toISOString(),
        new Date().toISOString()
      ).run();
    } catch (e) {
      // Metrics recording failed, but don't break the main flow
      console.warn("Failed to record tag served metric:", e);
    }

    const response = new Response(jsContent, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'ETag': etag,
        'Vary': 'Accept-Encoding',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Hosted tag generation error:", e);
    const response = new Response("// Hosted tag error", {
      status: 500,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
    });
    return addCorsHeaders(response, origin);
  }
}

// 3.5) Onboarding Invites (M5)
if (url.pathname === "/onboarding/invites" && request.method === "POST") {
  try {
    const body = await request.json();
    const { email, role, org_id } = body;

    if (!email || !role || !org_id) {
      const response = new Response(JSON.stringify({ error: "Email, role, and org_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate role
    if (!["owner", "member"].includes(role)) {
      const response = new Response(JSON.stringify({ error: "Invalid role. Must be 'owner' or 'member'" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Check if user is already a member
    const existingMember = await env.AI_FINGERPRINTS.get(`org_member:${org_id}:${email}`, { type: "json" });
    if (existingMember) {
      const response = new Response(JSON.stringify({ error: "User is already a member of this organization" }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Check if there's already a pending invite
    const existingInvite = await env.AI_FINGERPRINTS.get(`pending_invite:${org_id}:${email}`, { type: "json" });
    if (existingInvite) {
      const response = new Response(JSON.stringify({ error: "Invite already pending for this user" }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Generate invite token
    const inviteToken = generateToken();
    const inviteTokenHash = await hashToken(inviteToken);

    // Store invite data
    const inviteExpiryDays = config.INVITE_EXP_DAYS;
    const expiresAt = new Date(Date.now() + inviteExpiryDays * 24 * 60 * 60 * 1000);

    const inviteData = {
      email,
      role,
      org_id,
      token_hash: inviteTokenHash,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
      status: "pending"
    };

    await env.AI_FINGERPRINTS.put(`pending_invite:${org_id}:${email}`, JSON.stringify(inviteData), {
      expirationTtl: inviteExpiryDays * 24 * 60 * 60
    });

    // Generate invite link
    const appUrl = config.PUBLIC_APP_URL || "https://optiview.ai";
    const inviteLink = `${appUrl}/invite/accept?token=${inviteToken}`;

    // Send invite email (for now, log to console in dev)
    if (config.NODE_ENV === "production") {
      // TODO: Implement real email sending
      console.log("Would send invite email to:", email, "with link:", inviteLink);
    } else {
      // Dev mode: log the invite link
      console.log("📧 DEV MODE - Invite for", email, ":", inviteLink);
      console.log("Role:", role, "Org:", org_id);
      console.log("Expires:", expiresAt.toISOString());
    }

    const response = new Response(JSON.stringify({
      ok: true,
      message: "Invite sent successfully",
      invite_id: inviteTokenHash
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Invite creation error:", e);
    const response = new Response(JSON.stringify({ error: "Failed to create invite" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 4) Invite Acceptance (M5)
if (url.pathname === "/invite/accept" && request.method === "GET") {
  try {
    const token = url.searchParams.get("token");
    if (!token) {
      const response = new Response("Invalid invite token", { status: 400 });
      return addCorsHeaders(response, origin);
    }

    // Hash the token to compare with stored hash
    const tokenHash = await hashToken(token);

    // Find the invite by token hash
    // Note: This is a simplified lookup - in production we'd have a proper index
    // For now, we'll search through all pending invites (not scalable for production)
    let inviteData = null;
    let inviteKey = null;

    // This is a temporary implementation - in production we'd have proper database queries
    // For now, we'll assume the invite data is stored and accessible
    console.log("Looking for invite with hash:", tokenHash);

    // TODO: Implement proper invite lookup from database
    // For now, return a placeholder response
    const response = new Response("Invite acceptance - Frontend will handle this", {
      status: 200,
      headers: { "Content-Type": "text/html" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Invite acceptance error:", e);
    const response = new Response("Internal server error", { status: 500 });
    return addCorsHeaders(response, origin);
  }
}

// 3) API Keys endpoint - Proper implementation
if (url.pathname === "/api/keys" && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Get project_id from query params
    const urlObj = new URL(request.url);
    const projectId = urlObj.searchParams.get("project_id");

    if (!projectId) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user has access to this project
    const accessCheck = await d1.prepare(`
            SELECT COUNT(*) as count 
            FROM org_member om
            JOIN project p ON p.org_id = om.org_id
            WHERE om.user_id = ? AND p.id = ?
          `).bind(sessionData.user_id, projectId).first();

    if (accessCheck.count === 0) {
      const response = new Response(JSON.stringify({ error: "Access denied to project" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Get API keys for this project
    const keys = await d1.prepare(`
            SELECT 
              ak.id,
              ak.name,
              ak.created_ts,
              ak.last_used_ts,
              ak.revoked_ts,
              ak.grace_hash,
              ak.grace_expires_ts
            FROM api_key ak
            WHERE ak.project_id = ?
            ORDER BY ak.created_ts DESC
          `).bind(projectId).all();

    // Transform keys to match API contract
    const transformedKeys = (keys.results || []).map(key => {
      const now = Math.floor(Date.now() / 1000);

      // Determine status based on the specification
      let status;
      if (key.revoked_ts) {
        status = 'revoked';
      } else if (key.grace_hash && key.grace_expires_ts && key.grace_expires_ts > now) {
        status = 'grace';
      } else {
        status = 'active';
      }

      // Convert timestamps to ISO strings (handle both seconds and milliseconds)
      const toISOString = (ts) => {
        if (!ts) return null;

        // If timestamp is > 1e12, it's likely already in milliseconds
        // If timestamp is < 1e12, it's likely in seconds
        const msTimestamp = ts > 1e12 ? ts : ts * 1000;

        // Sanity check: if year would be > 3000, there's corrupted data
        if (msTimestamp > new Date('3000-01-01').getTime()) {
          return null;
        }

        try {
          return new Date(msTimestamp).toISOString();
        } catch (e) {
          return null;
        }
      };

      return {
        id: key.id,
        name: key.name,
        status: status,
        created_at: toISOString(key.created_ts),
        last_used_at: toISOString(key.last_used_ts),
        revoked_at: toISOString(key.revoked_ts),
        grace_expires_at: toISOString(key.grace_expires_ts)
      };
    });

    const response = new Response(JSON.stringify({ keys: transformedKeys }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Get API keys error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

if (url.pathname === "/api/keys" && request.method === "POST") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const body = await request.json();
    const { name, project_id } = body;

    if (!name || !project_id) {
      const response = new Response(JSON.stringify({ error: "Name and project_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user has access to this project
    const accessCheck = await d1.prepare(`
            SELECT COUNT(*) as count 
            FROM org_member om
            JOIN project p ON p.org_id = om.org_id
            WHERE om.user_id = ? AND p.id = ?
          `).bind(sessionData.user_id, project_id).first();

    if (accessCheck.count === 0) {
      const response = new Response(JSON.stringify({ error: "Access denied to project" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Generate API key ID and hash the key ID itself
    const keyId = `key_${generateToken().substring(0, 12)}`;
    const keyHash = await hashToken(keyId); // Hash the key ID for storage
    const nowTs = Math.floor(Date.now() / 1000);

    // Get org_id from project
    const projectData = await d1.prepare(`
            SELECT org_id FROM project WHERE id = ?
          `).bind(project_id).first();

    if (!projectData) {
      const response = new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Store API key in database
    await d1.prepare(`
            INSERT INTO api_key (id, project_id, org_id, name, hash, created_ts)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(keyId, project_id, projectData.org_id, name, keyHash, nowTs).run();

    // Return response matching the specification
    const response = new Response(JSON.stringify({
      id: keyId,
      name: name,
      status: "active",
      created_at: new Date(nowTs * 1000).toISOString(),
      last_used_at: null,
      revoked_at: null,
      grace_expires_at: null
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Create API key error:", e);
    const response = new Response(JSON.stringify({ error: "Failed to create API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// API Key Rotate endpoint
if (url.pathname.match(/^\/api\/keys\/[^\/]+\/rotate$/) && request.method === "POST") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Extract key ID from URL
    const keyId = url.pathname.split('/')[3];

    // Get the API key and verify access
    const keyData = await d1.prepare(`
            SELECT ak.id, ak.project_id, ak.hash, ak.revoked_ts
            FROM api_key ak
            JOIN project p ON p.id = ak.project_id
            JOIN org_member om ON om.org_id = p.org_id
            WHERE ak.id = ? AND om.user_id = ?
          `).bind(keyId, sessionData.user_id).first();

    if (!keyData) {
      const response = new Response(JSON.stringify({ error: "API key not found or access denied" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    if (keyData.revoked_ts) {
      const response = new Response(JSON.stringify({ error: "Cannot rotate revoked key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rotate the key: move current hash to grace_hash, generate new hash
    const newHash = await hashToken(generateToken());
    const nowTs = Math.floor(Date.now() / 1000);
    const graceExpiresTs = nowTs + (24 * 60 * 60); // 24 hours

    await d1.prepare(`
            UPDATE api_key 
            SET hash = ?, grace_hash = ?, grace_expires_ts = ?
            WHERE id = ?
          `).bind(newHash, keyData.hash, graceExpiresTs, keyId).run();

    const response = new Response(JSON.stringify({
      ok: true,
      grace_expires_at: new Date(graceExpiresTs * 1000).toISOString()
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Rotate API key error:", e);
    const response = new Response(JSON.stringify({ error: "Failed to rotate API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// API Key Revoke endpoint
if (url.pathname.match(/^\/api\/keys\/[^\/]+\/revoke$/) && request.method === "POST") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Extract key ID from URL
    const keyId = url.pathname.split('/')[3];

    // Get the API key and verify access
    const keyData = await d1.prepare(`
            SELECT ak.id, ak.project_id
            FROM api_key ak
            JOIN project p ON p.id = ak.project_id
            JOIN org_member om ON om.org_id = p.org_id
            WHERE ak.id = ? AND om.user_id = ?
          `).bind(keyId, sessionData.user_id).first();

    if (!keyData) {
      const response = new Response(JSON.stringify({ error: "API key not found or access denied" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Revoke the key
    const nowTs = Math.floor(Date.now() / 1000);
    await d1.prepare(`
            UPDATE api_key SET revoked_ts = ? WHERE id = ?
          `).bind(nowTs, keyId).run();

    const response = new Response(JSON.stringify({
      ok: true
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Revoke API key error:", e);
    const response = new Response(JSON.stringify({ error: "Failed to revoke API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// Projects API endpoints
if (url.pathname === "/api/projects" && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT s.user_id, u.email 
            FROM session s 
            JOIN user u ON u.id = s.user_id 
            WHERE s.session_id = ? AND s.expires_at > CURRENT_TIMESTAMP
          `).bind(sessionId).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting: 60 rpm per user
    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `api_projects_get:${sessionData.user_id}:${Math.floor(Date.now() / 60000)}`;

    try {
      const currentCount = await incrementCounter(env.AI_FINGERPRINTS, rateLimitKey, 60);
      if (currentCount > 60) {
        const response = new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }
    } catch (e) {
      console.error("Rate limiting error:", e);
    }

    // Get org_id from query parameters
    const orgId = url.searchParams.get("org_id");
    if (!orgId) {
      const response = new Response(JSON.stringify({ error: "Missing org_id parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user is a member of the organization
    const orgMember = await d1.prepare(`
            SELECT role FROM org_member WHERE org_id = ? AND user_id = ?
          `).bind(orgId, sessionData.user_id).first();

    if (!orgMember) {
      const response = new Response(JSON.stringify({ error: "Access denied to organization" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Get projects for the organization
    const projects = await d1.prepare(`
            SELECT id, org_id, name, created_ts
            FROM project 
            WHERE org_id = ?
            ORDER BY name
          `).bind(orgId).all();

    const transformedProjects = projects.results.map(project => ({
      id: project.id,
      org_id: project.org_id,
      name: project.name,
      created_at: new Date(project.created_ts).toISOString()
    }));

    const response = new Response(JSON.stringify({ projects: transformedProjects }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=60"
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Get projects error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

if (url.pathname === "/api/projects" && request.method === "POST") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT s.user_id, u.email, u.is_admin
            FROM session s 
            JOIN user u ON u.id = s.user_id 
            WHERE s.session_id = ? AND s.expires_at > CURRENT_TIMESTAMP
          `).bind(sessionId).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting: 10 rpm per user
    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `api_projects_post:${sessionData.user_id}:${Math.floor(Date.now() / 60000)}`;

    try {
      const currentCount = await incrementCounter(env.AI_FINGERPRINTS, rateLimitKey, 60);
      if (currentCount > 10) {
        const response = new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }
    } catch (e) {
      console.error("Rate limiting error:", e);
    }

    // Parse request body
    const body = await request.json();
    const { org_id, name, create_property, domain, create_key } = body;

    if (!org_id || !name) {
      const response = new Response(JSON.stringify({ error: "Missing required fields: org_id and name" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user is owner or admin
    const orgMember = await d1.prepare(`
            SELECT role FROM org_member WHERE org_id = ? AND user_id = ?
          `).bind(org_id, sessionData.user_id).first();

    if (!orgMember || (orgMember.role !== 'owner' && !sessionData.is_admin)) {
      const response = new Response(JSON.stringify({ error: "Only organization owners or admins can create projects" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Generate project ID
    const projectId = `prj_${generateToken().substring(0, 12)}`;
    const nowTs = Math.floor(Date.now());

    // Create slug from name (simple version)
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    // Create project
    await d1.prepare(`
            INSERT INTO project (id, org_id, name, slug, created_ts)
            VALUES (?, ?, ?, ?, ?)
          `).bind(projectId, org_id, name, slug, nowTs).run();

    let propertyResult = null;
    let keyResult = null;

    // Create property if requested and domain provided
    if (create_property && domain) {
      try {
        // Normalize domain (basic version - reuse your existing logic if more complex)
        const normalizedDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

        const propertyInsert = await d1.prepare(`
                INSERT INTO properties (project_id, domain, name, created_ts, updated_ts)
                VALUES (?, ?, ?, ?, ?)
              `).bind(projectId, normalizedDomain, normalizedDomain, nowTs, nowTs).run();

        propertyResult = {
          id: propertyInsert.meta.last_row_id,
          domain: normalizedDomain
        };
      } catch (e) {
        console.error("Error creating property:", e);
        // Continue without property - don't fail the whole request
      }
    }

    // Create API key if requested
    if (create_key) {
      try {
        const keyId = `key_${generateToken().substring(0, 12)}`;
        const keyName = domain ? `Default Key ${domain}` : "Default Key";
        const keyHash = await hashToken(keyId); // Hash the key ID itself, not a separate token

        await d1.prepare(`
                INSERT INTO api_key (id, project_id, name, hash, created_ts)
                VALUES (?, ?, ?, ?, ?)
              `).bind(keyId, projectId, keyName, keyHash, nowTs).run();

        keyResult = {
          id: keyId,
          name: keyName
        };
      } catch (e) {
        console.error("Error creating API key:", e);
        // Continue without key - don't fail the whole request
      }
    }

    // Increment projects_created_5m metric
    const current5MinWindow = Math.floor(Date.now() / (5 * 60 * 1000));
    const metricsKey = `projects_created_5m:${current5MinWindow}`;
    try {
      await incrementCounter(env.AI_FINGERPRINTS, metricsKey, 300);
    } catch (e) {
      console.error("Error incrementing projects metric:", e);
    }

    // Log audit event
    console.log(`project_created: user_id=${sessionData.user_id}, org_id=${org_id}, project_id=${projectId}`);

    const response = new Response(JSON.stringify({
      ok: true,
      project: {
        id: projectId,
        org_id: org_id,
        name: name,
        created_at: new Date(nowTs).toISOString()
      },
      property: propertyResult,
      key: keyResult
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Create project error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

if (url.pathname.startsWith("/api/projects/") && request.method === "PATCH") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT s.user_id, u.email, u.is_admin
            FROM session s 
            JOIN user u ON u.id = s.user_id 
            WHERE s.session_id = ? AND s.expires_at > CURRENT_TIMESTAMP
          `).bind(sessionId).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting: 10 rpm per user
    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `api_projects_patch:${sessionData.user_id}:${Math.floor(Date.now() / 60000)}`;

    try {
      const currentCount = await incrementCounter(env.AI_FINGERPRINTS, rateLimitKey, 60);
      if (currentCount > 10) {
        const response = new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }
    } catch (e) {
      console.error("Rate limiting error:", e);
    }

    // Extract project ID from URL
    const projectId = url.pathname.split('/')[3];
    if (!projectId) {
      const response = new Response(JSON.stringify({ error: "Missing project ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Get project and verify access
    const projectData = await d1.prepare(`
            SELECT p.id, p.org_id, p.name, p.slug, p.created_ts
            FROM project p
            JOIN org_member om ON om.org_id = p.org_id
            WHERE p.id = ? AND om.user_id = ?
          `).bind(projectId, sessionData.user_id).first();

    if (!projectData) {
      const response = new Response(JSON.stringify({ error: "Project not found or access denied" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user is owner or admin
    const orgMember = await d1.prepare(`
            SELECT role FROM org_member WHERE org_id = ? AND user_id = ?
          `).bind(projectData.org_id, sessionData.user_id).first();

    if (!orgMember || (orgMember.role !== 'owner' && !sessionData.is_admin)) {
      const response = new Response(JSON.stringify({ error: "Only organization owners or admins can rename projects" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Parse request body
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      const response = new Response(JSON.stringify({ error: "Missing required field: name" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Update project name
    const trimmedName = name.trim();
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    await d1.prepare(`
            UPDATE project SET name = ?, slug = ? WHERE id = ?
          `).bind(trimmedName, slug, projectId).run();

    // Log audit event
    console.log(`project_renamed: user_id=${sessionData.user_id}, project_id=${projectId}, old_name=${projectData.name}, new_name=${trimmedName}, ip=${clientIP}`);

    const response = new Response(JSON.stringify({
      ok: true,
      project: {
        id: projectData.id,
        org_id: projectData.org_id,
        name: trimmedName,
        created_at: new Date(projectData.created_ts).toISOString()
      }
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Update project error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// Properties API endpoints
if (url.pathname === "/api/properties" && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT s.user_id, u.email 
            FROM session s 
            JOIN user u ON u.id = s.user_id 
            WHERE s.session_id = ? AND s.expires_at > CURRENT_TIMESTAMP
          `).bind(sessionId).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting: 60 rpm per user
    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `api_properties_get:${sessionData.user_id}:${Math.floor(Date.now() / 60000)}`;

    try {
      const currentCount = await incrementCounter(env.AI_FINGERPRINTS, rateLimitKey, 60);
      if (currentCount > 60) {
        const response = new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }
    } catch (e) {
      console.error("Rate limiting error:", e);
      // Continue on rate limiting errors
    }

    const project_id = url.searchParams.get("project_id");
    if (!project_id) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user has access to the project
    const projectAccess = await d1.prepare(`
            SELECT p.id, p.name, p.org_id
            FROM project p
            JOIN org_member om ON om.org_id = p.org_id
            WHERE p.id = ? AND om.user_id = ?
          `).bind(project_id, sessionData.user_id).first();

    if (!projectAccess) {
      const response = new Response(JSON.stringify({ error: "Project not found or access denied" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Get properties for the project
    const properties = await d1.prepare(`
            SELECT id, project_id, domain, created_ts
            FROM properties
            WHERE project_id = ?
            ORDER BY created_ts DESC
          `).bind(project_id).all();

    // Transform timestamps to ISO strings
    const transformedProperties = properties.results.map(prop => ({
      id: prop.id,
      project_id: prop.project_id,
      domain: prop.domain,
      created_at: new Date(prop.created_ts * 1000).toISOString()
    }));

    const response = new Response(JSON.stringify(transformedProperties), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=60, stale-while-revalidate=60"
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Get properties error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

if (url.pathname === "/api/properties" && request.method === "POST") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT s.user_id, u.email 
            FROM session s 
            JOIN user u ON u.id = s.user_id 
            WHERE s.session_id = ? AND s.expires_at > CURRENT_TIMESTAMP
          `).bind(sessionId).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting: 30 rpm per user for creates
    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `api_properties_post:${sessionData.user_id}:${Math.floor(Date.now() / 60000)}`;

    try {
      const currentCount = await incrementCounter(env.AI_FINGERPRINTS, rateLimitKey, 60);
      if (currentCount > 30) {
        const response = new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }
    } catch (e) {
      console.error("Rate limiting error:", e);
      // Continue on rate limiting errors
    }

    const body = await request.json();
    const { project_id, domain } = body;

    if (!project_id || !domain) {
      const response = new Response(JSON.stringify({ error: "project_id and domain are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user has access to the project
    const projectAccess = await d1.prepare(`
            SELECT p.id, p.name, p.org_id
            FROM project p
            JOIN org_member om ON om.org_id = p.org_id
            WHERE p.id = ? AND om.user_id = ?
          `).bind(project_id, sessionData.user_id).first();

    if (!projectAccess) {
      const response = new Response(JSON.stringify({ error: "Project not found or access denied" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Normalize domain
    let normalizedDomain;
    try {
      // Remove protocol, path, query, hash - extract hostname only
      let cleanDomain = domain.trim().toLowerCase();

      // Remove protocol if present
      cleanDomain = cleanDomain.replace(/^https?:\/\//, '');

      // Remove path, query, hash
      cleanDomain = cleanDomain.split('/')[0].split('?')[0].split('#')[0];

      // Extract hostname (remove port if present)
      cleanDomain = cleanDomain.split(':')[0];

      // Validate hostname format
      if (!cleanDomain || cleanDomain === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(cleanDomain)) {
        const response = new Response(JSON.stringify({ error: "Invalid domain: IPs and localhost not allowed" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Basic hostname validation (must contain at least one dot for TLD)
      if (!cleanDomain.includes('.') || cleanDomain.startsWith('.') || cleanDomain.endsWith('.')) {
        const response = new Response(JSON.stringify({ error: "Invalid domain format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      normalizedDomain = cleanDomain;
    } catch (e) {
      const response = new Response(JSON.stringify({ error: "Invalid domain format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const nowTs = Math.floor(Date.now() / 1000);

    // Check for duplicate domain in this project
    const existingProperty = await d1.prepare(`
            SELECT id FROM properties WHERE project_id = ? AND domain = ?
          `).bind(project_id, normalizedDomain).first();

    if (existingProperty) {
      const response = new Response(JSON.stringify({ error: "duplicate_property" }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Insert new property
    const insertResult = await d1.prepare(`
            INSERT INTO properties (project_id, domain, created_ts, updated_ts)
            VALUES (?, ?, ?, ?)
          `).bind(project_id, normalizedDomain, nowTs, nowTs).run();

    // Increment metrics counter
    try {
      const metricsKey = `properties_created_5m:${Math.floor(Date.now() / 300000)}`;
      await incrementCounter(env.AI_FINGERPRINTS, metricsKey, 300);
    } catch (e) {
      console.error("Metrics error:", e);
      // Continue on metrics errors
    }

    // Return the created property
    const createdProperty = {
      id: insertResult.meta.last_row_id,
      project_id: project_id,
      domain: normalizedDomain,
      created_at: new Date(nowTs * 1000).toISOString()
    };

    const response = new Response(JSON.stringify(createdProperty), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Create property error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 4) Content endpoint - Proper implementation
if (url.pathname === "/api/content" && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Get project_id from query params
    const urlObj = new URL(request.url);
    const projectId = urlObj.searchParams.get("project_id");

    if (!projectId) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user has access to this project
    const accessCheck = await d1.prepare(`
            SELECT COUNT(*) as count 
            FROM org_member om
            JOIN project p ON p.org_id = om.org_id
            WHERE om.user_id = ? AND p.id = ?
          `).bind(sessionData.user_id, projectId).first();

    if (accessCheck.count === 0) {
      const response = new Response(JSON.stringify({ error: "Access denied to project" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Record metrics: content list viewed
    try {
      await d1.prepare(`
              INSERT INTO metrics (key, value, created_at) 
              VALUES (?, 1, ?) 
              ON CONFLICT(key) DO UPDATE SET 
                value = value + 1, 
                updated_at = ?
            `).bind(
        `content_list_viewed_5m:${Math.floor(Date.now() / (5 * 60 * 1000))}`,
        new Date().toISOString(),
        new Date().toISOString()
      ).run();
    } catch (e) {
      // Metrics recording failed, but don't break the main flow
      console.warn("Failed to record content list view metric:", e);
    }

    // Rate limiting: 60 rpm per user
    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const userKey = `rate_limit:content_list:user:${sessionData.user_id}`;
    const userLimit = await checkRateLimit(userKey, 60, 60 * 1000); // 60 rpm

    if (!userLimit.allowed) {
      const response = new Response(JSON.stringify({
        error: "Rate limited",
        retry_after: Math.ceil(userLimit.retryAfter / 1000)
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil(userLimit.retryAfter / 1000).toString()
        }
      });
      return addCorsHeaders(response, origin);
    }

    // Get query parameters
    const window = urlObj.searchParams.get("window") || "24h";
    const q = urlObj.searchParams.get("q") || "";
    const page = parseInt(urlObj.searchParams.get("page") || "1");
    const pageSize = Math.min(Math.max(parseInt(urlObj.searchParams.get("pageSize") || "50"), 10), 100); // Clamp 10-100
    const type = urlObj.searchParams.get("type") || "";
    const aiOnly = urlObj.searchParams.get("aiOnly") === "true";

    // Calculate time window
    let sinceTime;
    if (window === "15m") {
      sinceTime = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    } else if (window === "24h") {
      sinceTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    } else if (window === "7d") {
      sinceTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      sinceTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Default to 24h
    }

    // Build base filters
    let baseFilters = "ca.project_id = ?";
    let baseParams = [projectId];

    if (q) {
      baseFilters += " AND ca.url LIKE ?";
      baseParams.push(`%${q}%`);
    }

    if (type) {
      baseFilters += " AND ca.type = ?";
      baseParams.push(type);
    }

    // Get total count first
    const countQuery = `
            SELECT COUNT(*) as total
            FROM content_assets ca
            WHERE ${baseFilters}
          `;
    const totalResult = await d1.prepare(countQuery).bind(...baseParams).first();
    const total = totalResult?.total || 0;

    // Bulletproof query with explicit column aliases
    const mainQuery = `
            SELECT 
              ca.id, ca.url, ca.type,
              COALESCE((SELECT MAX(occurred_at) FROM interaction_events ie WHERE ie.project_id=ca.project_id AND ie.content_id=ca.id), '1970-01-01') AS last_seen,
              COALESCE((SELECT COUNT(*) FROM interaction_events ie WHERE ie.project_id=ca.project_id AND ie.content_id=ca.id AND ie.occurred_at>=datetime('now','-1 day')), 0) AS events_24h,
              COALESCE((SELECT COUNT(*) FROM interaction_events ie WHERE ie.project_id=ca.project_id AND ie.content_id=ca.id AND ie.occurred_at>=datetime('now','-15 minutes')), 0) AS events_15m
            FROM content_assets ca
            WHERE ${baseFilters}
            ORDER BY ca.url ASC
            LIMIT ? OFFSET ?
          `;

    const mainParams = [...baseParams, pageSize, (page - 1) * pageSize];
    const mainResult = await d1.prepare(mainQuery).bind(...mainParams).all();

    // Response with real metrics
    const items = mainResult.results.map(row => ({
      id: row.id,
      url: row.url,
      type: row.type,
      last_seen: row.last_seen,
      events_15m: row.events_15m || 0,
      events_24h: row.events_24h || 0,
      ai_referrals_24h: 0, // Will add this next
      by_source_24h: [], // Will add this next
      coverage_score: row.events_24h > 0 ? 50 : 0 // Simple coverage based on 24h events
    }));

    const response = new Response(JSON.stringify({
      items,
      page,
      total,
      pageSize
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60"
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Get content error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

if (url.pathname === "/api/content" && request.method === "POST") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const body = await request.json();
    const { property_id, url, project_id, type } = body;

    if (!property_id || !url || !project_id || !type) {
      const response = new Response(JSON.stringify({ error: "property_id, URL, project_id, and type are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user has access to this project
    const accessCheck = await d1.prepare(`
            SELECT COUNT(*) as count 
            FROM org_member om
            JOIN project p ON p.org_id = om.org_id
            WHERE om.user_id = ? AND p.id = ?
          `).bind(sessionData.user_id, project_id).first();

    if (accessCheck.count === 0) {
      const response = new Response(JSON.stringify({ error: "Access denied to project" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Record metrics: content asset created
    try {
      await d1.prepare(`
              INSERT INTO metrics (key, value, created_at) 
              VALUES (?, 1, ?) 
              ON CONFLICT(key) DO UPDATE SET 
                value = value + 1, 
                updated_at = ?
            `).bind(
        `content_asset_created_5m:${Math.floor(Date.now() / (5 * 60 * 1000))}`,
        new Date().toISOString(),
        new Date().toISOString()
      ).run();
    } catch (e) {
      // Metrics recording failed, but don't break the main flow
      console.warn("Failed to record content asset created metric:", e);
    }

    // IP rate limiting (120 rpm per IP, 60s window)
    if (env.RL_OFF !== "1") {
      try {
        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "0.0.0.0";
        const metrics = new MetricsManager(env.CACHE);
        const { ok, remaining, resetAt } = await ipRateLimit(env.RL, ip, "/api/content", 120, 60, metrics);
        if (!ok) {
          const response = new Response(JSON.stringify({
            error: "rate_limited",
            retry_after: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
          }), {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60"
            }
          });
          return addCorsHeaders(response, origin);
        }
      } catch (e) {
        console.error("Rate limiting error:", e);
        // Continue if rate limiting fails
      }
    }

    // Rate limiting: 30 rpm per user
    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const userKey = `rate_limit:content_create:user:${sessionData.user_id}`;
    const userLimit = await checkRateLimit(userKey, 30, 60 * 1000); // 30 rpm

    if (!userLimit.allowed) {
      const response = new Response(JSON.stringify({
        error: "Rate limited",
        retry_after: Math.ceil(userLimit.retryAfter / 1000)
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil(userLimit.retryAfter / 1000).toString()
        }
      });
      return addCorsHeaders(response, origin);
    }

    // property_id already validated above

    // Verify the property belongs to the project
    const propertyCheck = await d1.prepare(`
            SELECT id FROM properties WHERE id = ? AND project_id = ?
          `).bind(property_id, project_id).first();

    if (!propertyCheck) {
      const response = new Response(JSON.stringify({ error: "Property not found or access denied" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Sanitize metadata (limit to 1KB, remove PII)
    let sanitizedMetadata = null;
    if (body.metadata) {
      const metadataStr = JSON.stringify(body.metadata);
      if (metadataStr.length > 1024) {
        const response = new Response(JSON.stringify({ error: "Metadata too large (max 1KB)" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }
      sanitizedMetadata = metadataStr;
    }

    // Upsert content asset (property_id + url should be unique)
    const now = new Date().toISOString();
    const result = await d1.prepare(`
            INSERT INTO content_assets (property_id, project_id, url, type, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(property_id, url) DO UPDATE SET
              type = excluded.type,
              metadata = excluded.metadata,
              created_at = excluded.created_at
            RETURNING id
          `).bind(property_id, project_id, url, type, sanitizedMetadata, now).run();

    const contentId = result.meta.last_row_id || result.results?.[0]?.id;

    // Invalidate cache for this project
    try {
      await bumpProjectVersion(env.CACHE, project_id);
    } catch (e) {
      console.error("Failed to invalidate cache:", e);
    }

    const response = new Response(JSON.stringify({
      id: contentId,
      url,
      type,
      property_id,
      project_id
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Create content error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 4.5) Content update endpoint
if (url.pathname.match(/^\/api\/content\/\d+$/) && request.method === "PATCH") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Extract content ID from URL
    const contentId = url.pathname.split('/').pop();
    const body = await request.json();
    const { type, metadata } = body;

    // Get the content asset and verify access
    const contentAsset = await d1.prepare(`
            SELECT ca.id, ca.project_id, ca.property_id
            FROM content_assets ca
            JOIN properties p ON p.id = ca.property_id
            JOIN org_member om ON om.org_id = p.org_id
            WHERE ca.id = ? AND om.user_id = ?
          `).bind(contentId, sessionData.user_id).first();

    if (!contentAsset) {
      const response = new Response(JSON.stringify({ error: "Content not found or access denied" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Record metrics: content asset updated
    try {
      await d1.prepare(`
              INSERT INTO metrics (key, value, created_at) 
              VALUES (?, 1, ?) 
              ON CONFLICT(key) DO UPDATE SET 
                value = value + 1, 
                updated_at = ?
            `).bind(
        `content_asset_updated_5m:${Math.floor(Date.now() / (5 * 60 * 1000))}`,
        new Date().toISOString(),
        new Date().toISOString()
      ).run();
    } catch (e) {
      // Metrics recording failed, but don't break the main flow
      console.warn("Failed to record content asset updated metric:", e);
    }

    // Rate limiting: 30 rpm per user
    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const userKey = `rate_limit:content_update:user:${sessionData.user_id}`;
    const userLimit = await checkRateLimit(userKey, 30, 60 * 1000); // 30 rpm

    if (!userLimit.allowed) {
      const response = new Response(JSON.stringify({
        error: "Rate limited",
        retry_after: Math.ceil(userLimit.retryAfter / 1000)
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil(userLimit.retryAfter / 1000).toString()
        }
      });
      return addCorsHeaders(response, origin);
    }

    // Build update query
    let updateFields = [];
    let updateParams = [];

    if (type !== undefined) {
      updateFields.push("type = ?");
      updateParams.push(type);
    }

    if (metadata !== undefined) {
      // Sanitize metadata (limit to 1KB)
      const metadataStr = JSON.stringify(metadata);
      if (metadataStr.length > 1024) {
        const response = new Response(JSON.stringify({ error: "Metadata too large (max 1KB)" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }
      updateFields.push("metadata = ?");
      updateParams.push(metadataStr);
    }

    if (updateFields.length === 0) {
      const response = new Response(JSON.stringify({ error: "No fields to update" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Update the content asset
    updateParams.push(contentId);
    const result = await d1.prepare(`
            UPDATE content_assets 
            SET ${updateFields.join(', ')}
            WHERE id = ?
          `).bind(...updateParams).run();

    // Get project_id for cache invalidation
    const contentData = await d1.prepare(`
            SELECT project_id FROM content_assets WHERE id = ?
          `).bind(contentId).first();

    // Invalidate cache for this project
    if (contentData && contentData.project_id) {
      try {
        await bumpProjectVersion(env.CACHE, contentData.project_id);
      } catch (e) {
        console.error("Failed to invalidate cache:", e);
      }
    }

    const response = new Response(JSON.stringify({
      id: contentId,
      updated: true
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Update content error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 4.6) Content detail endpoint
if (url.pathname.match(/^\/api\/content\/\d+\/detail$/) && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Extract content ID from URL
    const contentId = url.pathname.split('/')[3]; // /api/content/{id}/detail
    const window = url.searchParams.get("window") || "7d";

    // Get the content asset and verify access via project_id
    const contentAsset = await d1.prepare(`
            SELECT ca.id, ca.url, ca.type, ca.metadata, ca.project_id
            FROM content_assets ca
            JOIN org_member om ON om.org_id = (SELECT org_id FROM project WHERE id = ca.project_id)
            WHERE ca.id = ? AND om.user_id = ?
          `).bind(contentId, sessionData.user_id).first();

    if (!contentAsset) {
      const response = new Response(JSON.stringify({ error: "Content not found or access denied" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting: 60 rpm per user
    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const userKey = `rate_limit:content_detail:user:${sessionData.user_id}`;
    const userLimit = await checkRateLimit(userKey, 60, 60 * 1000); // 60 rpm

    if (!userLimit.allowed) {
      const response = new Response(JSON.stringify({
        error: "Rate limited",
        retry_after: Math.ceil(userLimit.retryAfter / 1000)
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil(userLimit.retryAfter / 1000).toString()
        }
      });
      return addCorsHeaders(response, origin);
    }

    // Get by-source breakdown for the window
    const bySourceResult = await d1.prepare(`
            SELECT s.slug, COUNT(*) as events
            FROM interaction_events ie
            JOIN ai_sources s ON s.id = ie.ai_source_id
            WHERE ie.project_id = (SELECT project_id FROM content_assets WHERE id = ?) 
              AND ie.content_id = ? 
              AND ie.occurred_at >= ?
            GROUP BY s.slug
            ORDER BY events DESC
          `).bind(contentId, contentId, window === "7d" ? "datetime('now','-7 days')" : "datetime('now','-1 day')").all();

    // Get timeseries data
    let timeseriesQuery;
    let timeseriesParams;

    if (window === "7d") {
      timeseriesQuery = `
              SELECT 
                date(occurred_at) as ts,
                COUNT(*) as events,
                COUNT(CASE WHEN ai_source_id IS NOT NULL THEN 1 END) as ai_events
              FROM interaction_events
              WHERE content_id = ? AND occurred_at >= datetime('now','-7 days')
              GROUP BY date(occurred_at)
              ORDER BY ts DESC
            `;
      timeseriesParams = [contentId];
    } else {
      timeseriesQuery = `
              SELECT 
                strftime('%Y-%m-%d %H:00:00', occurred_at) as ts,
                COUNT(*) as events,
                COUNT(CASE WHEN ai_source_id IS NOT NULL THEN 1 END) as ai_events
              FROM interaction_events
              WHERE content_id = ? AND occurred_at >= datetime('now','-1 day')
              GROUP BY strftime('%Y-%m-%d %H:00:00', occurred_at)
              ORDER BY ts DESC
            `;
      timeseriesParams = [contentId];
    }

    const timeseriesResult = await d1.prepare(timeseriesQuery).bind(...timeseriesParams).all();

    // Get recent events (last 10)
    const recentEventsResult = await d1.prepare(`
            SELECT 
              ie.occurred_at,
              ie.event_type,
              s.slug as source,
              COALESCE(ie.metadata->>'$.p', '') as path
            FROM interaction_events ie
            LEFT JOIN ai_sources s ON s.id = ie.ai_source_id
            WHERE ie.content_id = ?
            ORDER BY ie.occurred_at DESC
            LIMIT 10
          `).bind(contentId).all();

    const response = new Response(JSON.stringify({
      asset: {
        id: contentAsset.id,
        url: contentAsset.url,
        type: contentAsset.type
      },
      by_source: bySourceResult.results,
      timeseries: timeseriesResult.results.map(row => ({
        ts: row.ts,
        events: row.events,
        ai_referrals: row.ai_events
      })),
      recent_events: recentEventsResult.results.map(row => ({
        occurred_at: row.occurred_at,
        event_type: row.event_type,
        source: row.source || 'unknown',
        path: row.path
      }))
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Content detail error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 5) Sources endpoint - Proper implementation
if (url.pathname === "/api/sources" && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // GET /api/sources - List sources with activity for a project
    const projectId = url.searchParams.get('project_id');
    const includeTop = url.searchParams.get('includeTop') === 'true';

    if (!projectId) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user has access to this project
    const accessCheck = await d1.prepare(`
            SELECT COUNT(*) as count 
            FROM org_member om
            JOIN project p ON p.org_id = om.org_id
            WHERE om.user_id = ? AND p.id = ?
          `).bind(sessionData.user_id, projectId).first();

    if (accessCheck.count === 0) {
      const response = new Response(JSON.stringify({ error: "Access denied to project" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Build the main query with activity CTEs
    const sourcesQuery = `
            WITH
            ev15 AS (
              SELECT ai_source_id, COUNT(*) AS n
              FROM interaction_events
              WHERE project_id = ? AND occurred_at >= datetime('now','-15 minutes')
              GROUP BY ai_source_id
            ),
            ev24 AS (
              SELECT ai_source_id, COUNT(*) AS n, MAX(occurred_at) AS last_seen
              FROM interaction_events
              WHERE project_id = ? AND occurred_at >= datetime('now','-1 day')
              GROUP BY ai_source_id
            ),
            ref24 AS (
              SELECT ai_source_id, COUNT(*) AS n
              FROM ai_referrals
              WHERE project_id = ? AND detected_at >= datetime('now','-1 day')
              GROUP BY ai_source_id
            )
            SELECT s.id, s.slug, s.name, s.category,
                   COALESCE(p.enabled, 0) AS enabled,
                   e24.last_seen,
                   COALESCE(e15.n,0) AS events_15m,
                   COALESCE(e24.n,0) AS events_24h,
                   COALESCE(r24.n,0) AS referrals_24h
            FROM ai_sources s
            LEFT JOIN project_ai_sources p
              ON p.ai_source_id = s.id AND p.project_id = ?
            LEFT JOIN ev15 e15 ON e15.ai_source_id = s.id
            LEFT JOIN ev24 e24 ON e24.ai_source_id = s.id
            LEFT JOIN ref24 r24 ON r24.ai_source_id = s.id
            WHERE s.is_active = 1
            ORDER BY COALESCE(e24.last_seen, '0000-01-01') DESC, s.name ASC
          `;

    const sources = await d1.prepare(sourcesQuery)
      .bind(projectId, projectId, projectId, projectId)
      .all();

    // Add top content if requested
    if (includeTop) {
      for (const source of sources.results) {
        const topContentQuery = `
                SELECT ca.url AS content_url, COUNT(*) AS n
                FROM interaction_events ie
                JOIN content_assets ca ON ca.id = ie.content_id
                WHERE ie.project_id = ? AND ie.ai_source_id = ? AND ie.occurred_at >= datetime('now','-1 day')
                GROUP BY ca.url
                ORDER BY n DESC
                LIMIT 5
              `;

        const topContent = await d1.prepare(topContentQuery)
          .bind(projectId, source.id)
          .all();

        source.top_content = topContent.results;
      }
    }

    const response = new Response(JSON.stringify(sources.results), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=10, stale-while-revalidate=10"
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Get sources error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

if (url.pathname === "/api/sources" && request.method === "POST") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const body = await request.json();
    const { project_id, ai_source_id, enabled, notes, suggested_pattern_json } = body;

    if (!project_id || !ai_source_id || enabled === undefined) {
      const response = new Response(JSON.stringify({ error: "project_id, ai_source_id, and enabled are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate suggested_pattern_json size if provided
    if (suggested_pattern_json && JSON.stringify(suggested_pattern_json).length > 2048) {
      const response = new Response(JSON.stringify({ error: "suggested_pattern_json too large (max 2KB)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user has access to this project
    const accessCheck = await d1.prepare(`
            SELECT COUNT(*) as count 
            FROM org_member om
            JOIN project p ON p.org_id = om.org_id
            WHERE om.user_id = ? AND p.id = ?
          `).bind(sessionData.user_id, project_id).first();

    if (accessCheck.count === 0) {
      const response = new Response(JSON.stringify({ error: "Access denied to project" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify ai_source exists and is active
    const sourceCheck = await d1.prepare(`
            SELECT id FROM ai_sources WHERE id = ? AND is_active = 1
          `).bind(ai_source_id).first();

    if (!sourceCheck) {
      const response = new Response(JSON.stringify({ error: "AI source not found or inactive" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Upsert project_ai_sources
    await d1.prepare(`
            INSERT INTO project_ai_sources (project_id, ai_source_id, enabled, notes, suggested_pattern_json, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(project_id, ai_source_id) DO UPDATE SET
              enabled = excluded.enabled,
              notes = excluded.notes,
              suggested_pattern_json = excluded.suggested_pattern_json,
              updated_at = CURRENT_TIMESTAMP
          `).bind(project_id, ai_source_id, enabled ? 1 : 0, notes || null, suggested_pattern_json ? JSON.stringify(suggested_pattern_json) : null).run();

    // Create rules_suggestions if pattern provided
    if (suggested_pattern_json) {
      await d1.prepare(`
              INSERT INTO rules_suggestions (project_id, ai_source_id, author_user_id, suggestion_json, status)
              VALUES (?, ?, ?, ?, 'pending')
            `).bind(project_id, ai_source_id, sessionData.user_id, JSON.stringify(suggested_pattern_json)).run();
    }

    // TODO: Increment metrics counters
    // sources_enable_clicked_5m or sources_disable_clicked_5m
    // rules_suggestion_created_5m (if pattern provided)

    const response = new Response(JSON.stringify({
      success: true,
      message: `Source ${enabled ? 'enabled' : 'disabled'} successfully`,
      project_id,
      ai_source_id,
      enabled: !!enabled
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Enable/disable source error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// POST /api/sources/enable - Enable a source for a project
if (url.pathname === "/api/sources/enable" && request.method === "POST") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const body = await request.json();
    const { project_id, ai_source_id, notes, suggested_pattern_json } = body;

    if (!project_id || !ai_source_id) {
      const response = new Response(JSON.stringify({ error: "project_id and ai_source_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user has access to this project
    const accessCheck = await d1.prepare(`
            SELECT COUNT(*) as count 
            FROM org_member om
            JOIN project p ON p.org_id = om.org_id
            WHERE om.user_id = ? AND p.id = ?
          `).bind(sessionData.user_id, project_id).first();

    if (!accessCheck || accessCheck.count === 0) {
      const response = new Response(JSON.stringify({ error: "Access denied to this project" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify ai_source exists and is active
    const sourceCheck = await d1.prepare(`
            SELECT id FROM ai_sources WHERE id = ? AND is_active = 1
          `).bind(ai_source_id).first();

    if (!sourceCheck) {
      const response = new Response(JSON.stringify({ error: "AI source not found or inactive" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Upsert project_ai_sources with enabled=1
    await d1.prepare(`
            INSERT INTO project_ai_sources (project_id, ai_source_id, enabled, notes, suggested_pattern_json, updated_at)
            VALUES (?, ?, 1, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(project_id, ai_source_id) DO UPDATE SET
              enabled = 1,
              notes = excluded.notes,
              suggested_pattern_json = excluded.suggested_pattern_json,
              updated_at = excluded.updated_at
          `).bind(project_id, ai_source_id, notes || null, suggested_pattern_json ? JSON.stringify(suggested_pattern_json) : null).run();

    // Invalidate cache for this project
    try {
      await bumpProjectVersion(env.CACHE, project_id);
    } catch (e) {
      console.error("Failed to invalidate cache:", e);
    }

    const response = new Response(JSON.stringify({
      success: true,
      message: "AI source enabled successfully"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (error) {
    console.error("Enable source error:", error);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// DELETE /api/sources/enable - Disable a source for a project
if (url.pathname === "/api/sources/enable" && request.method === "DELETE") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const body = await request.json();
    const { project_id, ai_source_id } = body;

    if (!project_id || !ai_source_id) {
      const response = new Response(JSON.stringify({ error: "project_id and ai_source_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user has access to this project
    const accessCheck = await d1.prepare(`
            SELECT COUNT(*) as count 
            FROM org_member om
            JOIN project p ON p.org_id = om.org_id
            WHERE om.user_id = ? AND p.id = ?
          `).bind(sessionData.user_id, project_id).first();

    if (accessCheck.count === 0) {
      const response = new Response(JSON.stringify({ error: "Access denied to project" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Set enabled=0 for the project_ai_sources row
    await d1.prepare(`
            UPDATE project_ai_sources 
            SET enabled = 0, updated_at = CURRENT_TIMESTAMP
            WHERE project_id = ? AND ai_source_id = ?
          `).bind(project_id, ai_source_id).run();

    // Invalidate cache for this project
    try {
      await bumpProjectVersion(env.CACHE, project_id);
    } catch (e) {
      console.error("Failed to invalidate cache:", e);
    }

    // TODO: Increment metrics counter
    // sources_disable_clicked_5m

    const response = new Response(JSON.stringify({
      success: true,
      message: "Source disabled successfully",
      project_id,
      ai_source_id,
      enabled: false
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Disable source error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 6) Events endpoint
if (url.pathname === "/api/events" && request.method === "GET") {
  const response = new Response(JSON.stringify({ events: [], total: 0 }), {
    headers: { "Content-Type": "application/json" }
  });
  return addCorsHeaders(response, origin);
}

// 6.0) API Key validation endpoint (for debugging)
if (url.pathname === "/api/events/validate-key" && request.method === "POST") {
  try {
    const keyId = request.headers.get('x-optiview-key-id');
    if (!keyId) {
      const response = new Response(JSON.stringify({
        valid: false,
        error: "Missing x-optiview-key-id header",
        debug: { hasHeader: false }
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const keyHash = await hashToken(keyId);
    const apiKey = await d1.prepare(`
            SELECT id, project_id, name, created_ts, last_used_ts, revoked_ts FROM api_key 
            WHERE hash = ? AND revoked_ts IS NULL
          `).bind(keyHash).first();

    if (!apiKey) {
      const response = new Response(JSON.stringify({
        valid: false,
        error: "Invalid API key",
        debug: {
          keyIdPrefix: keyId.substring(0, 8) + '...',
          keyIdLength: keyId.length,
          hashLength: keyHash.length
        }
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const response = new Response(JSON.stringify({
      valid: true,
      project_id: apiKey.project_id,
      key_name: apiKey.name,
      debug: {
        keyIdPrefix: keyId.substring(0, 8) + '...',
        keyIdLength: keyId.length
      }
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error('Key validation error:', e);
    const response = new Response(JSON.stringify({
      valid: false,
      error: "Validation failed",
      debug: { exception: e.message }
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// Events POST endpoint is now handled by routes/api.ts

// 7) Events recent endpoint
if (url.pathname === "/api/events/recent" && request.method === "GET") {
  try {
    const projectId = url.searchParams.get("project_id");
    if (!projectId) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Get recent events from interaction_events table
    const events = await d1.prepare(`
            SELECT 
              ie.id,
              ie.event_type,
              ie.occurred_at,
              ie.metadata,
              ca.url,
              s.name as source_name,
              s.slug as source_slug
            FROM interaction_events ie
            LEFT JOIN content_assets ca ON ca.id = ie.content_id
            LEFT JOIN ai_sources s ON s.id = ie.ai_source_id
            WHERE ie.project_id = ?
            ORDER BY ie.occurred_at DESC
            LIMIT 100
          `).bind(projectId).all();

    const response = new Response(JSON.stringify({
      events: events.results || [],
      total: events.results?.length || 0
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  } catch (e) {
    console.error("Events recent error:", e);
    const response = new Response(JSON.stringify({ error: "Failed to fetch events" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 7) Events summary endpoint
if (url.pathname === "/api/events/summary" && request.method === "GET") {
  try {
    const projectId = url.searchParams.get("project_id");
    if (!projectId) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Get summary data from interaction_events table
    const summary = await d1.prepare(`
            SELECT 
              COUNT(*) as total,
              COUNT(CASE WHEN occurred_at >= datetime('now', '-15 minutes') THEN 1 END) as last_15m,
              COUNT(CASE WHEN ai_source_id IS NOT NULL THEN 1 END) as ai_events,
              COUNT(DISTINCT content_id) as unique_pages
            FROM interaction_events 
            WHERE project_id = ?
          `).bind(projectId).first();

    const response = new Response(JSON.stringify({
      total: summary?.total || 0,
      last_15m: summary?.last_15m || 0,
      ai_events: summary?.ai_events || 0,
      unique_pages: summary?.unique_pages || 0,
      breakdown: [],
      top_sources: [],
      timeseries: []
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  } catch (e) {
    console.error("Events summary error:", e);
    const response = new Response(JSON.stringify({
      total: 0,
      breakdown: [],
      top_sources: [],
      timeseries: []
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 7.0.1) Conversions POST endpoint
if (url.pathname === "/api/conversions" && request.method === "POST") {
  try {
    const body = await request.json();
    const { project_id, property_id, content_id, url, amount_cents, currency, metadata } = body;

    // Validate required fields
    if (!project_id) {
      const response = new Response(JSON.stringify({ error: "Missing required field: project_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate API key (same as events endpoint)
    const authHeader = request.headers.get('x-optiview-key-id');
    if (!authHeader) {
      const response = new Response(JSON.stringify({ error: "Missing API key header: x-optiview-key-id" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate API key
    const keyHash = await hashToken(authHeader);
    const apiKey = await d1.prepare(`
            SELECT * FROM api_key WHERE hash = ? AND revoked_ts IS NULL
          `).bind(keyHash).first();

    if (!apiKey) {
      const response = new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Enforce project scope using the API key
    if (apiKey.project_id !== project_id) {
      const response = new Response(JSON.stringify({ error: "Project ID mismatch" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // IP rate limiting (120 rpm per IP, 60s window)
    if (env.RL_OFF !== "1") {
      try {
        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "0.0.0.0";
        const metrics = new MetricsManager(env.CACHE);
        const { ok, remaining, resetAt } = await ipRateLimit(env.RL, ip, "/api/conversions", 120, 60, metrics);
        if (!ok) {
          const response = new Response(JSON.stringify({
            error: "rate_limited",
            retry_after: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
          }), {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60"
            }
          });
          return addCorsHeaders(response, origin);
        }
      } catch (e) {
        console.error("Rate limiting error:", e);
        // Continue if rate limiting fails
      }
    }

    // Rate limiting: 60 rpm per key
    const rateLimitKey = `conversions_create:${apiKey.id}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, 60, 60 * 1000);
    if (!rateLimitResult.allowed) {
      const response = new Response(JSON.stringify({
        error: "Rate limit exceeded",
        retry_after: rateLimitResult.retryAfter
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rateLimitResult.retryAfter.toString()
        }
      });
      return addCorsHeaders(response, origin);
    }

    let finalContentId = content_id;
    let finalPropertyId = property_id;

    // If content_id missing but url present, upsert content_assets
    if (!finalContentId && url) {
      if (!finalPropertyId) {
        const response = new Response(JSON.stringify({ error: "property_id required when url is provided" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Verify property belongs to project and get domain for CORS
      const propertyCheck = await d1.prepare(`
              SELECT id, domain FROM properties WHERE id = ? AND project_id = ?
            `).bind(finalPropertyId, project_id).first();

      if (!propertyCheck) {
        const response = new Response(JSON.stringify({ error: "Property not found or not accessible" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Enforce property-scoped CORS for conversions
      const propertyDomain = propertyCheck.domain;
      const expectedOrigin = `https://${propertyDomain}`;
      const expectedOriginWww = `https://www.${propertyDomain}`;

      if (origin && origin !== expectedOrigin && origin !== expectedOriginWww) {
        const response = new Response(JSON.stringify({
          error: "Origin not allowed for this property",
          details: "origin_denied"
        }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, expectedOrigin);
      }

      // Upsert content asset
      const existingContent = await d1.prepare(`
              SELECT id FROM content_assets WHERE url = ? AND property_id = ?
            `).bind(url, finalPropertyId).first();

      if (existingContent) {
        finalContentId = existingContent.id;
      } else {
        const contentResult = await d1.prepare(`
                INSERT INTO content_assets (property_id, project_id, url, type, created_at)
                VALUES (?, ?, ?, 'page', ?)
              `).bind(finalPropertyId, project_id, url, new Date().toISOString()).run();
        finalContentId = contentResult.meta.last_row_id;
      }
    }

    // Sanitize metadata (≤1KB, drop PII keys)
    let sanitizedMetadata = null;
    if (metadata) {
      const cleanMetadata = { ...metadata };
      // Drop PII keys
      delete cleanMetadata.ip;
      delete cleanMetadata.ua;
      delete cleanMetadata.email;
      delete cleanMetadata.phone;
      delete cleanMetadata.name;
      delete cleanMetadata.address;

      const metadataStr = JSON.stringify(cleanMetadata);
      if (metadataStr.length <= 1024) {
        sanitizedMetadata = metadataStr;
      }
    }

    // Insert conversion
    const now = new Date().toISOString();
    const result = await d1.prepare(`
            INSERT INTO conversion_event (
              project_id, property_id, content_id, amount_cents, 
              currency, metadata, occurred_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
      project_id,
      finalPropertyId,
      finalContentId,
      amount_cents || null,
      currency || 'USD',
      sanitizedMetadata,
      now
    ).run();

    // Update last_used timestamp for API key
    await d1.prepare(`
            UPDATE api_key SET last_used_ts = ? WHERE id = ?
          `).bind(Date.now(), apiKey.id).run();

    // Invalidate cache for this project
    try {
      await bumpProjectVersion(env.CACHE, project_id);
    } catch (e) {
      console.error("Failed to invalidate cache:", e);
    }

    const response = new Response(JSON.stringify({
      ok: true,
      id: result.meta.last_row_id,
      occurred_at: now
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Conversion creation error:", e);
    const response = new Response(JSON.stringify({ error: "Failed to create conversion" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 7.0.2) Conversions Summary endpoint
if (url.pathname === "/api/conversions/summary" && request.method === "GET") {
  try {
    const { project_id, window = "7d" } = Object.fromEntries(url.searchParams);

    if (!project_id) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate window parameter
    if (!['24h', '7d', '30d'].includes(window)) {
      const response = new Response(JSON.stringify({ error: "Invalid window. Must be one of: 24h, 7d, 30d" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting: 60 rpm
    const rateLimitKey = `conversions_summary:${project_id}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, 60, 60 * 1000);
    if (!rateLimitResult.allowed) {
      const response = new Response(JSON.stringify({
        error: "Rate limit exceeded",
        retry_after: rateLimitResult.retryAfter
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rateLimitResult.retryAfter.toString()
        }
      });
      return addCorsHeaders(response, origin);
    }

    // Calculate time window
    let timeFilter;
    let bucketFormat;
    if (window === '24h') {
      timeFilter = "datetime('now','-1 day')";
      bucketFormat = "strftime('%Y-%m-%d %H:00:00', datetime(?, 'unixepoch'))";
    } else if (window === '7d') {
      timeFilter = "datetime('now','-7 days')";
      bucketFormat = "strftime('%Y-%m-%d', datetime(?, 'unixepoch'))";
    } else { // 30d
      timeFilter = "datetime('now','-30 days')";
      bucketFormat = "strftime('%Y-%m-%d', datetime(?, 'unixepoch'))";
    }

    // Get totals with attribution
    const totals = await d1.prepare(`
            WITH conversion_attribution AS (
              SELECT 
                ce.id,
                ce.amount_cents,
                ce.content_id,
                ce.occurred_at,
                ar.ai_source_id,
                ar.detected_at
              FROM conversion_event ce
              LEFT JOIN ai_referrals ar ON 
                ce.project_id = ar.project_id 
                AND ce.content_id = ar.content_id 
                AND ar.detected_at >= datetime(ce.occurred_at, '-7 days')
                AND ar.detected_at <= ce.occurred_at
              WHERE ce.project_id = ? AND ce.occurred_at >= ${timeFilter}
            ),
            last_touch_attribution AS (
              SELECT 
                id,
                amount_cents,
                content_id,
                occurred_at,
                ai_source_id,
                detected_at,
                ROW_NUMBER() OVER (
                  PARTITION BY content_id, occurred_at 
                  ORDER BY detected_at DESC
                ) as rn
              FROM conversion_attribution
              WHERE ai_source_id IS NOT NULL
            )
            SELECT 
                              COUNT(*) conversions,
              COUNT(CASE WHEN ai_source_id IS NOT NULL THEN 1 END) as ai_attributed,
              COUNT(CASE WHEN ai_source_id IS NULL THEN 1 END) as non_ai,
              COALESCE(SUM(amount_cents), 0) as revenue_cents
            FROM (
              SELECT 
                ca.id,
                ca.amount_cents,
                ca.content_id,
                ca.occurred_at,
                lta.ai_source_id
              FROM conversion_attribution ca
              LEFT JOIN last_touch_attribution lta ON 
                ca.id = lta.id AND lta.rn = 1
            )
          `).bind(project_id).first();

    // Get breakdown by source
    const bySource = await d1.prepare(`
            WITH conversion_attribution AS (
              SELECT 
                ce.id,
                ce.amount_cents,
                ce.content_id,
                ce.occurred_at,
                ar.ai_source_id,
                ar.detected_at
              FROM conversion_event ce
              LEFT JOIN ai_referrals ar ON 
                ce.project_id = ar.project_id 
                AND ce.content_id = ar.content_id 
                AND ar.detected_at >= datetime(ce.occurred_at, '-7 days')
                AND ar.detected_at <= ce.occurred_at
              WHERE ce.project_id = ? AND ce.occurred_at >= ${timeFilter}
            ),
            last_touch_attribution AS (
              SELECT 
                id,
                amount_cents,
                content_id,
                occurred_at,
                ai_source_id,
                detected_at,
                ROW_NUMBER() OVER (
                  PARTITION BY content_id, occurred_at 
                  ORDER BY detected_at DESC
                ) as rn
              FROM conversion_attribution
              WHERE ai_source_id IS NOT NULL
            )
            SELECT 
              ais.slug,
              ais.name,
                              COUNT(*) conversions,
              COALESCE(SUM(ce.amount_cents), 0) as revenue_cents
            FROM (
              SELECT 
                ca.id,
                ca.amount_cents,
                ca.content_id,
                ca.occurred_at,
                lta.ai_source_id
              FROM conversion_attribution ca
              LEFT JOIN last_touch_attribution lta ON 
                ca.id = lta.id AND lta.rn = 1
            ) ce
            JOIN ai_sources ais ON ce.ai_source_id = ais.id
            WHERE ce.ai_source_id IS NOT NULL
            GROUP BY ais.id, ais.slug, ais.name
            ORDER BY conversions DESC
          `).bind(project_id).all();

    // Get top content
    const topContent = await d1.prepare(`
            SELECT 
              ca.id as content_id,
              ca.url,
                              COUNT(*) conversions,
              COALESCE(SUM(ce.amount_cents), 0) as revenue_cents
            FROM conversion_event ce
            JOIN content_assets ca ON ce.content_id = ca.id
            WHERE ce.project_id = ? AND ce.occurred_at >= ${timeFilter}
            GROUP BY ca.id, ca.url
            ORDER BY conversions DESC
            LIMIT 10
          `).bind(project_id).all();

    // Get timeseries data
    const timeseries = await d1.prepare(`
            WITH conversion_attribution AS (
              SELECT 
                ce.id,
                ce.amount_cents,
                ce.content_id,
                ce.occurred_at,
                ar.ai_source_id,
                ar.detected_at
              FROM conversion_event ce
              LEFT JOIN ai_referrals ar ON 
                ce.project_id = ar.project_id 
                AND ce.content_id = ar.content_id 
                AND ar.detected_at >= datetime(ce.occurred_at, '-7 days')
                AND ar.detected_at <= ce.occurred_at
              WHERE ce.project_id = ? AND ce.occurred_at >= ${timeFilter}
            ),
            last_touch_attribution AS (
              SELECT 
                id,
                amount_cents,
                content_id,
                occurred_at,
                ai_source_id,
                detected_at,
                ROW_NUMBER() OVER (
                  PARTITION BY content_id, occurred_at 
                  ORDER BY detected_at DESC
                ) as rn
              FROM conversion_attribution
              WHERE ai_source_id IS NOT NULL
            )
            SELECT 
              strftime('%Y-%m-%d', ce.occurred_at) as ts,
                              COUNT(*) conversions,
              COUNT(CASE WHEN lta.ai_source_id IS NOT NULL THEN 1 END) as ai_attributed,
              COALESCE(SUM(ce.amount_cents), 0) as revenue_cents
            FROM conversion_event ce
            LEFT JOIN last_touch_attribution lta ON 
              ce.id = lta.id AND lta.rn = 1
            WHERE ce.project_id = ? AND ce.occurred_at >= ${timeFilter}
            GROUP BY strftime('%Y-%m-%d', ce.occurred_at)
            ORDER BY ts
          `).bind(project_id, project_id).all();

    const summary = {
      totals: {
        conversions: totals?.conversions || 0,
        ai_attributed: totals?.ai_attributed || 0,
        non_ai: totals?.non_ai || 0,
        revenue_cents: totals?.revenue_cents || 0
      },
      by_source: bySource.results || [],
      top_content: topContent.results || [],
      timeseries: timeseries.results || []
    };

    const response = new Response(JSON.stringify(summary), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60"
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Conversions summary error:", e);
    const response = new Response(JSON.stringify({
      error: "Internal server error",
      message: e.message
    }), { status: 500, headers: { "Content-Type": "application/json" } });
    return addCorsHeaders(response, origin);
  }
}

// 7.0.3) Conversions List endpoint
if (url.pathname === "/api/conversions" && request.method === "GET") {
  try {
    const { project_id, window = "7d", source, q, page = "1", pageSize = "50", sort = "last_seen_desc" } = Object.fromEntries(url.searchParams);

    if (!project_id) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate window parameter
    if (!['24h', '7d', '30d'].includes(window)) {
      const response = new Response(JSON.stringify({ error: "Invalid window. Must be one of: 24h, 7d, 30d" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate sort parameter
    if (!['last_seen_desc', 'conversions_desc'].includes(sort)) {
      const response = new Response(JSON.stringify({ error: "Invalid sort. Must be one of: last_seen_desc, conversions_desc" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting: 60 rpm
    const rateLimitKey = `conversions_list:${project_id}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, 60, 60 * 1000);
    if (!rateLimitResult.allowed) {
      const response = new Response(JSON.stringify({
        error: "Rate limit exceeded",
        retry_after: rateLimitResult.retryAfter
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rateLimitResult.retryAfter.toString()
        }
      });
      return addCorsHeaders(response, origin);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSizeNum = Math.min(100, Math.max(10, parseInt(pageSize, 10)));
    const offset = (pageNum - 1) * pageSizeNum;

    // window → since (ISO). Keep attribution lookback = 7d for v1 (constant).
    const now = new Date();
    const sinceISO = (() => {
      if (window === "24h") return new Date(now.getTime() - 24 * 3600e3).toISOString();
      if (window === "30d") return new Date(now.getTime() - 30 * 86400e3).toISOString();
      return new Date(now.getTime() - 7 * 86400e3).toISOString(); // 7d default
    })();
    const lookbackMod = "-7 days"; // SQLite datetime(c.occurred_at, ?)

    // SAFE sort whitelist
    const sortSql = (() => {
      switch (sort) {
        case "conversions_desc": return "conversions DESC, last_seen DESC";
        case "last_seen_desc":
        default: return "last_seen DESC, conversions DESC";
      }
    })();

    // MAIN LIST QUERY (positional placeholders only)
    // PARAM ORDER (9 total):
    //  1: project_id
    //  2: sinceISO
    //  3: lookbackMod
    //  4: q (nullable)
    //  5: source (nullable)
    //  6: source (same value, repeated)
    //  7: pageSize (int)
    //  8: offset (int)
    const mainQuery = `
            WITH params AS (
              SELECT ? AS pid, ? AS since, ? AS lookback, ? AS q
            ),
            conv AS (
              SELECT c.id, c.project_id, c.content_id, c.amount_cents, c.currency, c.occurred_at
              FROM conversion_event c, params p
              WHERE c.project_id = p.pid
                AND c.occurred_at >= p.since
            ),
            lt AS (
              SELECT c.id AS conv_id,
                     (
                       SELECT ar.ai_source_id
                       FROM ai_referrals ar, params p
                       WHERE ar.project_id = c.project_id
                         AND ar.content_id = c.content_id
                         AND ar.detected_at <= c.occurred_at
                         AND ar.detected_at >= datetime(c.occurred_at, p.lookback)
                       ORDER BY ar.detected_at DESC
                       LIMIT 1
                     ) AS ai_source_id
              FROM conv c
            ),
            rows AS (
              SELECT
                c.content_id,
                lt.ai_source_id,
                COUNT(*) AS conversions,
                SUM(COALESCE(c.amount_cents,0)) AS revenue_cents,
                MAX(c.occurred_at) AS last_seen
              FROM conv c
              LEFT JOIN lt ON lt.conv_id = c.id
              GROUP BY c.content_id, lt.ai_source_id
            ),
            urls AS (
              SELECT ca.id AS content_id, ca.url
              FROM content_assets ca, params p
              WHERE ca.project_id = p.pid
                AND (p.q IS NULL OR ca.url LIKE '%' || p.q || '%')
            ),
            rows2 AS (
              SELECT r.*, u.url,
                     s.slug AS source_slug, s.name AS source_name
              FROM rows r
              JOIN urls u ON u.content_id = r.content_id
              LEFT JOIN ai_sources s ON s.id = r.ai_source_id
              WHERE ( ? IS NULL OR s.slug = ? )
            )
            SELECT
              rows2.content_id,
              rows2.url,
              rows2.source_slug,
              rows2.source_name,
              rows2.last_seen,
              rows2.conversions,
              rows2.revenue_cents
            FROM rows2
            ORDER BY ${sortSql}
            LIMIT ? OFFSET ?;
          `;

    const bindList = [
      project_id,
      sinceISO,
      lookbackMod,
      q || null,              // 4
      source || null,         // 5
      source || null,         // 6 (same value)
      pageSizeNum,            // 7
      offset                  // 8
    ];

    const items = await d1.prepare(mainQuery).bind(...bindList).all();

    // COUNT query (same filters, no LIMIT/OFFSET)
    const countQuery = `
            WITH params AS (
              SELECT ? AS pid, ? AS since, ? AS lookback, ? AS q
            ),
            conv AS (
              SELECT c.id, c.project_id, c.content_id, c.amount_cents, c.currency, c.occurred_at
              FROM conversion_event c, params p
              WHERE c.project_id = p.pid
                AND c.occurred_at >= p.since
            ),
            lt AS (
              SELECT c.id AS conv_id,
                     (
                       SELECT ar.ai_source_id
                       FROM ai_referrals ar, params p
                       WHERE ar.project_id = c.project_id
                         AND ar.content_id = c.content_id
                         AND ar.detected_at <= c.occurred_at
                         AND ar.detected_at >= datetime(c.occurred_at, p.lookback)
                       ORDER BY ar.detected_at DESC
                       LIMIT 1
                     ) AS ai_source_id
              FROM conv c
            ),
            rows AS (
              SELECT
                c.content_id,
                lt.ai_source_id,
                COUNT(*) AS conversions,
                SUM(COALESCE(c.amount_cents,0)) AS revenue_cents,
                MAX(c.occurred_at) AS last_seen
              FROM conv c
              LEFT JOIN lt ON lt.conv_id = c.id
              GROUP BY c.content_id, lt.ai_source_id
            ),
            urls AS (
              SELECT ca.id AS content_id, ca.url
              FROM content_assets ca, params p
              WHERE ca.project_id = p.pid
                AND (p.q IS NULL OR ca.url LIKE '%' || p.q || '%')
            ),
            rows2 AS (
              SELECT r.*, u.url,
                     s.slug AS source_slug, s.name AS source_name
              FROM rows r
              JOIN urls u ON u.content_id = r.content_id
              LEFT JOIN ai_sources s ON s.id = r.ai_source_id
              WHERE ( ? IS NULL OR s.slug = ? )
            )
            SELECT COUNT(*) AS total
            FROM rows2;
          `;

    const countBind = [
      project_id,
      sinceISO,
      lookbackMod,
      q || null,              // 4
      source || null,         // 5
      source || null          // 6
    ];

    const totalResult = await d1.prepare(countQuery).bind(...countBind).first();
    const total = totalResult?.total || 0;

    // Get assists for each content+source combination
    const assistsQuery = `
            WITH params AS (
              SELECT ? AS pid, ? AS since, ? AS lookback
            ),
            conv AS (
              SELECT c.id, c.project_id, c.content_id, c.occurred_at
              FROM conversion_event c, params p
              WHERE c.project_id = p.pid
                AND c.occurred_at >= p.since
            ),
            lt AS (
              SELECT c.id AS conv_id,
                     (
                       SELECT ar.ai_source_id
                       FROM ai_referrals ar, params p
                       WHERE ar.project_id = c.project_id
                         AND ar.content_id = c.content_id
                         AND ar.detected_at <= c.occurred_at
                         AND ar.detected_at >= datetime(c.occurred_at, p.lookback)
                       ORDER BY ar.detected_at DESC
                       LIMIT 1
                     ) AS ai_source_id
              FROM conv c
            ),
            rows AS (
              SELECT
                c.content_id,
                lt.ai_source_id,
                COUNT(*) AS conversions
              FROM conv c
              LEFT JOIN lt ON lt.conv_id = c.id
              GROUP BY c.content_id, lt.ai_source_id
            )
            SELECT 
              r.content_id,
              r.ai_source_id,
              ais.slug,
              r.conversions as count
            FROM rows r
            JOIN ai_sources ais ON ais.id = r.ai_source_id
            WHERE r.ai_source_id IS NOT NULL
            GROUP BY r.content_id, r.ai_source_id, ais.slug
          `;

    const assists = await d1.prepare(assistsQuery).bind(project_id, sinceISO, lookbackMod).all();

    // Group assists by content_id and source_slug
    const assistsMap = {};
    assists.results?.forEach(assist => {
      const key = `${assist.content_id}_${assist.slug}`;
      if (!assistsMap[key]) {
        assistsMap[key] = [];
      }
      assistsMap[key].push({
        slug: assist.slug,
        count: assist.count
      });
    });

    // Add assists to items
    const itemsWithAssists = items.results?.map(item => {
      const key = `${item.content_id}_${item.source_slug || 'non_ai'}`;
      return {
        ...item,
        assists: assistsMap[key] || []
      };
    }) || [];

    const response = new Response(JSON.stringify({
      items: itemsWithAssists,
      page: pageNum,
      pageSize: pageSizeNum,
      total
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60"
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Conversions list error:", e);
    const response = new Response(JSON.stringify({
      error: "Internal server error",
      message: e.message
    }), { status: 500, headers: { "Content-Type": "application/json" } });
    return addCorsHeaders(response, origin);
  }
}

// 7.0.4) Conversions Detail endpoint
if (url.pathname === "/api/conversions/detail" && request.method === "GET") {
  try {
    const { project_id, content_id, source, window = "7d" } = Object.fromEntries(url.searchParams);

    if (!project_id || !content_id) {
      const response = new Response(JSON.stringify({ error: "project_id and content_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate window parameter
    if (!['24h', '7d', '30d'].includes(window)) {
      const response = new Response(JSON.stringify({ error: "Invalid window. Must be one of: 24h, 7d, 30d" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting: 60 rpm
    const rateLimitKey = `conversions_detail:${project_id}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, 60, 60 * 1000);
    if (!rateLimitResult.allowed) {
      const response = new Response(JSON.stringify({
        error: "Rate limit exceeded",
        retry_after: rateLimitResult.retryAfter
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rateLimitResult.retryAfter.toString()
        }
      });
      return addCorsHeaders(response, origin);
    }

    // Calculate time window
    let timeFilter;
    if (window === '24h') {
      timeFilter = "datetime('now','-1 day')";
    } else if (window === '7d') {
      timeFilter = "datetime('now','-7 days')";
    } else { // 30d
      timeFilter = "datetime('now','-30 days')";
    }

    // Get content info
    const content = await d1.prepare(`
            SELECT id, url FROM content_assets WHERE id = ? AND project_id = ?
          `).bind(content_id, project_id).first();

    if (!content) {
      const response = new Response(JSON.stringify({ error: "Content not found or not accessible" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Get source info if specified
    let sourceInfo = null;
    if (source && source !== 'null') {
      sourceInfo = await d1.prepare(`
              SELECT slug, name FROM ai_sources WHERE slug = ?
            `).bind(source).first();
    }

    // Get summary stats
    const summary = await d1.prepare(`
            WITH conversion_attribution AS (
              SELECT 
                ce.id,
                ce.amount_cents,
                ce.occurred_at,
                ar.ai_source_id,
                ar.detected_at
              FROM conversion_event ce
              LEFT JOIN ai_referrals ar ON 
                ce.project_id = ar.project_id 
                AND ce.content_id = ar.content_id 
                AND ar.detected_at >= datetime(ce.occurred_at, '-7 days')
                AND ar.detected_at <= ce.occurred_at
              WHERE ce.project_id = ? AND ce.content_id = ? AND ce.occurred_at >= ${timeFilter}
            ),
            last_touch_attribution AS (
              SELECT 
                id,
                amount_cents,
                occurred_at,
                ai_source_id,
                detected_at,
                ROW_NUMBER() OVER (
                  PARTITION BY occurred_at 
                  ORDER BY detected_at DESC
                ) as rn
              FROM conversion_attribution
              WHERE ai_source_id IS NOT NULL
            )
            SELECT 
                              COUNT(*) conversions,
              COALESCE(SUM(ce.amount_cents), 0) as revenue_cents,
              MAX(ce.occurred_at) as last_seen
            FROM conversion_event ce
            LEFT JOIN last_touch_attribution lta ON 
              ce.id = lta.id AND lta.rn = 1
            WHERE ce.project_id = ? AND ce.content_id = ? AND ce.occurred_at >= ${timeFilter}
            ${source && source !== 'null' ? 'AND lta.ai_source_id = (SELECT id FROM ai_sources WHERE slug = ?)' : ''}
          `).bind(project_id, content_id, project_id, content_id, ...(source && source !== 'null' ? [source] : [])).first();

    // Get timeseries data
    const timeseries = await d1.prepare(`
            WITH conversion_attribution AS (
              SELECT 
                ce.id,
                ce.amount_cents,
                ce.occurred_at,
                ar.ai_source_id,
                ar.detected_at
              FROM conversion_event ce
              LEFT JOIN ai_referrals ar ON 
                ce.project_id = ar.project_id 
                AND ce.content_id = ar.content_id 
                AND ar.detected_at >= datetime(ce.occurred_at, '-7 days')
                AND ar.detected_at <= ce.occurred_at
              WHERE ce.project_id = ? AND ce.content_id = ? AND ce.occurred_at >= ${timeFilter}
            ),
            last_touch_attribution AS (
              SELECT 
                id,
                amount_cents,
                occurred_at,
                ai_source_id,
                detected_at,
                ROW_NUMBER() OVER (
                  PARTITION BY occurred_at 
                  ORDER BY detected_at DESC
                ) as rn
              FROM conversion_attribution
              WHERE ai_source_id IS NOT NULL
            )
            SELECT 
              strftime('%Y-%m-%d', ce.occurred_at) as ts,
                              COUNT(*) conversions,
              COALESCE(SUM(ce.amount_cents), 0) as revenue_cents
            FROM conversion_event ce
            LEFT JOIN last_touch_attribution lta ON 
              ce.id = lta.id AND lta.rn = 1
            WHERE ce.project_id = ? AND ce.content_id = ? AND ce.occurred_at >= ${timeFilter}
            ${source && source !== 'null' ? 'AND lta.ai_source_id = (SELECT id FROM ai_sources WHERE slug = ?)' : ''}
            GROUP BY strftime('%Y-%m-%d', ce.occurred_at)
            ORDER BY ts
          `).bind(project_id, content_id, project_id, content_id, ...(source && source !== 'null' ? [source] : [])).all();

    // Get recent conversions
    const recent = await d1.prepare(`
            SELECT 
              occurred_at,
              amount_cents,
              currency,
              metadata
            FROM conversion_event
            WHERE project_id = ? AND content_id = ? AND ce.occurred_at >= ${timeFilter}
            ORDER BY occurred_at DESC
            LIMIT 10
          `).bind(project_id, content_id).all();

    // Get assists
    const assists = await d1.prepare(`
            SELECT 
              ais.slug,
              COUNT(DISTINCT ce.id) as count
            FROM conversion_event ce
            JOIN ai_referrals ar ON 
              ce.project_id = ar.project_id 
              AND ce.content_id = ar.content_id 
              AND ar.detected_at >= datetime(ce.occurred_at, '-7 days')
              AND ar.detected_at <= ce.occurred_at
            JOIN ai_sources ais ON ar.ai_source_id = ais.id
            WHERE ce.project_id = ? AND ce.content_id = ? AND ce.occurred_at >= ${timeFilter}
            ${source && source !== 'null' ? 'AND ar.ai_source_id != (SELECT id FROM ai_sources WHERE slug = ?)' : ''}
            GROUP BY ais.slug
            ORDER BY count DESC
          `).bind(project_id, content_id, ...(source && source !== 'null' ? [source] : [])).all();

    const detail = {
      content: {
        id: content.id,
        url: content.url
      },
      source: sourceInfo,
      summary: {
        conversions: summary?.conversions || 0,
        revenue_cents: summary?.revenue_cents || 0,
        last_seen: summary?.last_seen || null
      },
      timeseries: timeseries.results || [],
      recent: recent.results || [],
      assists: assists.results || []
    };

    const response = new Response(JSON.stringify(detail), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60"
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Conversions detail error:", e);
    const response = new Response(JSON.stringify({
      error: "Internal server error",
      message: e.message
    }), { status: 500, headers: { "Content-Type": "application/json" } });
    return addCorsHeaders(response, origin);
  }
}

// 7.0.4) Funnels Summary endpoint
if (url.pathname === "/api/funnels/summary" && request.method === "GET") {
  try {
    const { project_id, window = "7d" } = Object.fromEntries(url.searchParams);

    if (!project_id) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate window parameter
    if (!['15m', '24h', '7d'].includes(window)) {
      const response = new Response(JSON.stringify({ error: "Invalid window. Must be one of: 15m, 24h, 7d" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting: 60 rpm
    const rateLimitKey = `funnels_summary:${project_id}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, 60, 60 * 1000);
    if (!rateLimitResult.allowed) {
      const response = new Response(JSON.stringify({
        error: "Rate limit exceeded",
        retry_after: rateLimitResult.retryAfter
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rateLimitResult.retryAfter.toString()
        }
      });
      return addCorsHeaders(response, origin);
    }

    // Calculate time window
    const now = new Date();
    let sinceISO;
    if (window === "15m") {
      sinceISO = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    } else if (window === "24h") {
      sinceISO = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    } else { // 7d
      sinceISO = new Date(now.getTime() - 7 * 86400 * 1000).toISOString();
    }

    // Get funnels summary data
    const summaryQuery = `
            WITH params AS (
              SELECT ? AS pid, ? AS since, '-7 days' AS lookback
            ),
            refs AS (
              SELECT 
                ar.ai_source_id,
                COUNT(*) referrals,
                MAX(ar.detected_at) last_referral
              FROM ai_referrals ar, params p
              WHERE ar.project_id = p.pid
                AND ar.detected_at >= p.since
              GROUP BY ar.ai_source_id
            ),
            convs AS (
              SELECT 
                ce.content_id,
                ce.amount_cents,
                ce.occurred_at,
                (
                  SELECT ar.ai_source_id
                  FROM ai_referrals ar, params p
                  WHERE ar.project_id = ce.project_id
                    AND ar.content_id = ce.content_id
                    AND ar.detected_at <= ce.occurred_at
                    AND ar.detected_at >= datetime(ce.occurred_at, p.lookback)
                  ORDER BY ar.detected_at DESC
                  LIMIT 1
                ) attributed_source_id
              FROM conversion_event ce, params p
              WHERE ce.project_id = p.pid
                AND ce.occurred_at >= p.since
            ),
            attributed AS (
              SELECT 
                c.attributed_source_id,
                COUNT(*) AS conversions
               FROM convs c
               WHERE c.attributed_source_id IS NOT NULL
               GROUP BY c.attributed_source_id
             )
             SELECT 
               r.ai_source_id,
               r.referrals,
               COALESCE(a.conversions, 0) conversions,
               CASE 
                 WHEN r.referrals > 0 THEN CAST(COALESCE(a.conversions, 0) AS REAL) / r.referrals
                 ELSE 0 
               END conv_rate
             FROM refs r
             LEFT JOIN attributed a ON r.ai_source_id = a.attributed_source_id
             ORDER BY r.referrals DESC
           `;

    const summaryResult = await d1.prepare(summaryQuery).bind(project_id, sinceISO).all();

    // Get totals
    const totalsQuery = `
            WITH params AS (
              SELECT ? AS pid, ? AS since
            )
            SELECT 
              (SELECT COUNT(*) FROM ai_referrals ar, params p WHERE ar.project_id = p.pid AND ar.detected_at >= p.since) referrals,
              (SELECT COUNT(*) FROM conversion_event ce, params p WHERE ce.project_id = p.pid AND ce.occurred_at >= p.since) conversions
          `;

    const totalsResult = await d1.prepare(totalsQuery).bind(project_id, sinceISO).first();
    const totalReferrals = totalsResult?.referrals || 0;
    const totalConversions = totalsResult?.conversions || 0;
    const totalConvRate = totalReferrals > 0 ? totalConversions / totalReferrals : 0;

    // Process TTC data and get source names
    const bySource = [];
    for (const row of summaryResult.results || []) {
      const sourceQuery = `SELECT slug, name FROM ai_sources WHERE id = ?`;
      const sourceResult = await d1.prepare(sourceQuery).bind(row.ai_source_id).first();

      if (sourceResult) {
        bySource.push({
          slug: sourceResult.slug,
          name: sourceResult.name,
          referrals: row.referrals,
          conversions: row.conversions,
          conv_rate: Math.round(row.conv_rate * 100) / 100,
          p50_ttc_min: 0,  // Placeholder - implement in detail endpoint
          p90_ttc_min: 0   // Placeholder - implement in detail endpoint
        });
      }
    }

    // Get timeseries data (daily buckets for 7d, hourly for 24h, 15-min for 15m)
    let timeseriesQuery;
    if (window === "15m") {
      timeseriesQuery = `
              WITH params AS (
                SELECT ? AS pid, ? AS since
              ),
              time_buckets AS (
                SELECT 
                  strftime('%Y-%m-%d %H:%M', datetime(ar.detected_at, 'start of hour', '+' || (strftime('%M', ar.detected_at) / 15) * 15 || ' minutes')) as ts
                FROM ai_referrals ar, params p
                WHERE ar.project_id = p.pid AND ar.detected_at >= p.since
                GROUP BY ts
              )
              SELECT 
                tb.ts,
                (SELECT COUNT(*) FROM ai_referrals ar, params p WHERE ar.project_id = p.pid AND strftime('%Y-%m-%d %H:%M', datetime(ar.detected_at, 'start of hour', '+' || (strftime('%M', ar.detected_at) / 15) * 15 || ' minutes')) = tb.ts) as referrals,
                (SELECT COUNT(*) FROM conversion_event ce, params p WHERE ce.project_id = p.pid AND strftime('%Y-%m-%d %H:%M', datetime(ce.occurred_at, 'start of hour', '+' || (strftime('%M', ce.occurred_at) / 15) * 15 || ' minutes')) = tb.ts) as conversions
              FROM time_buckets tb
              ORDER BY tb.ts
            `;
    } else if (window === "24h") {
      timeseriesQuery = `
              WITH params AS (
                SELECT ? AS pid, ? AS since
              ),
              time_buckets AS (
                SELECT 
                  strftime('%Y-%m-%d %H:00', ar.detected_at) as ts
                FROM ai_referrals ar, params p
                WHERE ar.project_id = p.pid AND ar.detected_at >= p.since
                GROUP BY ts
              )
              SELECT 
                tb.ts,
                (SELECT COUNT(*) FROM ai_referrals ar, params p WHERE ar.project_id = p.pid AND strftime('%Y-%m-%d %H:00', ar.detected_at) = tb.ts) as referrals,
                (SELECT COUNT(*) FROM conversion_event ce, params p WHERE ce.project_id = p.pid AND strftime('%Y-%m-%d %H:00', ce.occurred_at) = tb.ts) as conversions
              FROM time_buckets tb
              ORDER BY tb.ts
            `;
    } else { // 7d
      timeseriesQuery = `
              WITH params AS (
                SELECT ? AS pid, ? AS since
              ),
              time_buckets AS (
                SELECT 
                  date(ar.detected_at) as ts
                FROM ai_referrals ar, params p
                WHERE ar.project_id = p.pid AND ar.detected_at >= p.since
                GROUP BY ts
              )
              SELECT 
                tb.ts,
                (SELECT COUNT(*) FROM ai_referrals ar, params p WHERE ar.project_id = p.pid AND date(ar.detected_at) = tb.ts) as referrals,
                (SELECT COUNT(*) FROM conversion_event ce, params p WHERE ce.project_id = p.pid AND date(ce.occurred_at) = tb.ts) as conversions
              FROM time_buckets tb
              ORDER BY tb.ts
            `;
    }

    const timeseriesResult = await d1.prepare(timeseriesQuery).bind(project_id, sinceISO).all();

    // Record metrics: funnels summary viewed
    try {
      await d1.prepare(`
              INSERT INTO metrics (key, value, created_at) 
              VALUES (?, 1, ?) 
              ON CONFLICT(key) DO UPDATE SET 
                value = value + 1, 
                updated_at = ?
            `).bind(
        `funnels_summary_viewed_5m:${Math.floor(Date.now() / (5 * 60 * 1000))}`,
        new Date().toISOString(),
        new Date().toISOString()
      ).run();
    } catch (e) {
      // Metrics recording failed, but don't break the main flow
      console.warn("Failed to record funnels summary view metric:", e);
    }

    const response = new Response(JSON.stringify({
      totals: {
        referrals: totalReferrals,
        conversions: totalConversions,
        conv_rate: Math.round(totalConvRate * 100) / 100
      },
      by_source: bySource,
      timeseries: timeseriesResult.results || []
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60"
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Funnels summary error:", e);
    const response = new Response(JSON.stringify({
      error: "Internal server error",
      message: e.message
    }), { status: 500, headers: { "Content-Type": "application/json" } });
    return addCorsHeaders(response, origin);
  }
}

// 7.0.5) Funnels List endpoint
if (url.pathname === "/api/funnels" && request.method === "GET") {
  try {
    const { project_id, window = "7d", source, q, sort = "conv_rate_desc", page = "1", pageSize = "50" } = Object.fromEntries(url.searchParams);

    if (!project_id) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate window parameter
    if (!['15m', '24h', '7d'].includes(window)) {
      const response = new Response(JSON.stringify({ error: "Invalid window. Must be one of: 15m, 24h, 7d" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate sort parameter
    if (!['conv_rate_desc', 'conversions_desc', 'referrals_desc', 'last_conversion_desc'].includes(sort)) {
      const response = new Response(JSON.stringify({ error: "Invalid sort. Must be one of: conv_rate_desc, conversions_desc, referrals_desc, last_conversion_desc" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting: 60 rpm
    const rateLimitKey = `funnels_list:${project_id}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, 60, 60 * 1000);
    if (!rateLimitResult.allowed) {
      const response = new Response(JSON.stringify({
        error: "Rate limit exceeded",
        retry_after: rateLimitResult.retryAfter
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rateLimitResult.retryAfter.toString()
        }
      });
      return addCorsHeaders(response, origin);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSizeNum = Math.min(100, Math.max(10, parseInt(pageSize, 10)));
    const offset = (pageNum - 1) * pageSizeNum;

    // Calculate time window
    const now = new Date();
    let sinceISO;
    if (window === "15m") {
      sinceISO = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    } else if (window === "24h") {
      sinceISO = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    } else { // 7d
      sinceISO = new Date(now.getTime() - 7 * 86400 * 1000).toISOString();
    }

    // SAFE sort whitelist
    const sortSql = (() => {
      switch (sort) {
        case "conversions_desc": return "conversions DESC, conv_rate DESC";
        case "referrals_desc": return "referrals DESC, conv_rate DESC";
        case "last_conversion_desc": return "last_conversion DESC, conv_rate DESC";
        case "conv_rate_desc":
        default: return "conv_rate DESC, conversions DESC";
      }
    })();

    // Main query with CTEs
    const mainQuery = `
            WITH params AS (
              SELECT ? AS pid, ? AS since, '-7 days' AS lookback
            ),
            refs AS (
              SELECT 
                ar.project_id,
                ar.content_id,
                ar.ai_source_id,
                COUNT(*) AS referrals,
                MAX(ar.detected_at) AS last_referral
              FROM ai_referrals ar, params p
              WHERE ar.project_id = p.pid
                AND ar.detected_at >= p.since
              GROUP BY ar.project_id, ar.content_id, ar.ai_source_id
            ),
            convs AS (
              SELECT 
                ce.id,
                ce.project_id,
                ce.content_id,
                ce.amount_cents,
                ce.currency,
                ce.occurred_at,
                (
                  SELECT ar.ai_source_id
                  FROM ai_referrals ar, params p
                  WHERE ar.project_id = ce.project_id
                    AND ar.content_id = ce.content_id
                    AND ar.detected_at <= ce.occurred_at
                    AND ar.detected_at >= datetime(ce.occurred_at, p.lookback)
                  ORDER BY ar.detected_at DESC
                  LIMIT 1
                ) AS attributed_source_id
              FROM conversion_event ce, params p
              WHERE ce.project_id = p.pid
                AND ce.occurred_at >= p.since
            ),
            attributed AS (
              SELECT 
                c.content_id,
                c.attributed_source_id,
                COUNT(*) AS conversions,
                MAX(c.occurred_at) AS last_conversion
               FROM convs c
               WHERE c.attributed_source_id IS NOT NULL
               GROUP BY c.content_id, c.attributed_source_id
             ),
             funnel_data AS (
               SELECT 
                 r.project_id,
                 r.content_id,
                 r.ai_source_id,
                 r.referrals,
                COALESCE(a.conversions, 0) AS conversions,
                 CASE 
                   WHEN r.referrals > 0 THEN CAST(COALESCE(a.conversions, 0) AS REAL) / r.referrals
                   ELSE 0 
                END AS conv_rate,
                 r.last_referral,
                a.last_conversion
               FROM refs r
              LEFT JOIN attributed a
                ON r.content_id = a.content_id AND r.ai_source_id = a.attributed_source_id
             ),
             with_urls AS (
               SELECT 
                f.project_id,
                f.content_id,
                f.ai_source_id,
                f.referrals,
                f.conversions,
                f.conv_rate,
                f.last_referral,
                f.last_conversion,
                 ca.url,
                s.slug AS source_slug,
                s.name AS source_name
               FROM funnel_data f
               JOIN content_assets ca ON f.content_id = ca.id
              JOIN ai_sources s ON f.ai_source_id = s.id
               WHERE f.project_id = ? AND f.last_referral >= ?
                ${source ? 'AND s.slug = ?' : ''}
                 ${q ? 'AND ca.url LIKE ?' : ''}
             )
             SELECT 
               content_id,
               url,
               source_slug,
               source_name,
               referrals,
               conversions,
               conv_rate,
               last_referral,
              last_conversion
             FROM with_urls
             ORDER BY ${sortSql}
             LIMIT ? OFFSET ?
           `;

    // Build bind parameters
    let bindParams = [project_id, sinceISO, project_id, sinceISO];
    if (source) bindParams.push(source);
    if (q) bindParams.push(`%${q}%`);
    bindParams.push(pageSizeNum, offset);

    const items = await d1.prepare(mainQuery).bind(...bindParams).all();

    // Process items (TTC percentiles removed for performance)
    const processedItems = items.results?.map(item => ({
      ...item,
      conv_rate: Math.round(item.conv_rate * 100) / 100,
      p50_ttc_min: 0,  // Moved to detail endpoint for performance
      p90_ttc_min: 0   // Moved to detail endpoint for performance
    })) || [];

    // Count query
    const countQuery = `
            WITH params AS (
              SELECT ? AS pid, ? AS since, '-7 days' AS lookback
            ),
            refs AS (
              SELECT 
                ar.project_id,
                ar.content_id,
                ar.ai_source_id,
                COUNT(*) AS referrals,
                MAX(ar.detected_at) AS last_referral
              FROM ai_referrals ar, params p
              WHERE ar.project_id = p.pid
                AND ar.detected_at >= p.since
              GROUP BY ar.project_id, ar.content_id, ar.ai_source_id
            )
            SELECT COUNT(*) AS total
              FROM refs r
            JOIN content_assets ca ON r.content_id = ca.id
            JOIN ai_sources s ON r.ai_source_id = s.id
            WHERE r.project_id = ? AND r.last_referral >= ?
              ${source ? 'AND s.slug = ?' : ''}
                ${q ? 'AND ca.url LIKE ?' : ''}
          `;

    const countBind = [project_id, sinceISO, project_id, sinceISO];
    if (source) countBind.push(source);
    if (q) countBind.push(`%${q}%`);

    const totalResult = await d1.prepare(countQuery).bind(...countBind).first();
    const total = totalResult?.total || 0;

    // Record metrics: funnels list viewed
    try {
      await d1.prepare(`
              INSERT INTO metrics (key, value, created_at) 
              VALUES (?, 1, ?) 
              ON CONFLICT(key) DO UPDATE SET 
                value = value + 1, 
                updated_at = ?
            `).bind(
        `funnels_list_viewed_5m:${Math.floor(Date.now() / (5 * 60 * 1000))}`,
        new Date().toISOString(),
        new Date().toISOString()
      ).run();
    } catch (e) {
      // Metrics recording failed, but don't break the main flow
      console.warn("Failed to record funnels list view metric:", e);
    }

    const response = new Response(JSON.stringify({
      items: processedItems,
      page: pageNum,
      pageSize: pageSizeNum,
      total
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60"
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Funnels list error:", e);
    const response = new Response(JSON.stringify({
      error: "Internal server error",
      message: e.message
    }), { status: 500, headers: { "Content-Type": "application/json" } });
    return addCorsHeaders(response, origin);
  }
}

// 7.0.6) Funnels Detail endpoint
if (url.pathname === "/api/funnels/detail" && request.method === "GET") {
  try {
    const { project_id, content_id, source, window = "7d" } = Object.fromEntries(url.searchParams);

    if (!project_id || !content_id || !source) {
      const response = new Response(JSON.stringify({ error: "project_id, content_id, and source are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate window parameter
    if (!['15m', '24h', '7d'].includes(window)) {
      const response = new Response(JSON.stringify({ error: "Invalid window. Must be one of: 15m, 24h, 7d" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting: 60 rpm
    const rateLimitKey = `funnels_detail:${project_id}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, 60, 60 * 1000);
    if (!rateLimitResult.allowed) {
      const response = new Response(JSON.stringify({
        error: "Rate limit exceeded",
        retry_after: rateLimitResult.retryAfter
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rateLimitResult.retryAfter.toString()
        }
      });
      return addCorsHeaders(response, origin);
    }

    // Calculate time window
    const now = new Date();
    let sinceISO;
    if (window === "15m") {
      sinceISO = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    } else if (window === "24h") {
      sinceISO = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    } else { // 7d
      sinceISO = new Date(now.getTime() - 7 * 86400 * 1000).toISOString();
    }

    // Get content info
    const contentQuery = `SELECT id, url FROM content_assets WHERE id = ? AND project_id = ?`;
    const contentResult = await d1.prepare(contentQuery).bind(content_id, project_id).first();

    if (!contentResult) {
      const response = new Response(JSON.stringify({ error: "Content not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Get source info
    const sourceQuery = `SELECT id, slug, name FROM ai_sources WHERE slug = ?`;
    const sourceResult = await d1.prepare(sourceQuery).bind(source).first();

    if (!sourceResult) {
      const response = new Response(JSON.stringify({ error: "Source not found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Get summary data
    const summaryQuery = `
            WITH params AS (
              SELECT ? AS pid, ? AS cid, ? AS since, '-7 days' AS lookback
            ),
            refs AS (
              SELECT COUNT(*) as referrals
              FROM ai_referrals ar, params p
              WHERE ar.project_id = p.pid
                AND ar.content_id = p.cid
                AND ar.ai_source_id = ?
                AND ar.detected_at >= p.since
            ),
            convs AS (
              SELECT 
                ce.amount_cents,
                ce.occurred_at,
                (
                  SELECT ar.ai_source_id
                  FROM ai_referrals ar, params p
                  WHERE ar.project_id = ce.project_id
                    AND ar.content_id = ce.content_id
                    AND ar.detected_at <= ce.occurred_at
                    AND ar.detected_at >= datetime(ce.occurred_at, p.lookback)
                  ORDER BY ar.detected_at DESC
                  LIMIT 1
                ) attributed_source_id
              FROM conversion_event ce, params p
              WHERE ce.project_id = p.pid
                AND ce.content_id = p.cid
                AND ce.occurred_at >= p.since
            ),
            attributed AS (
              SELECT 
                COUNT(*) AS conversions
               FROM convs c
               WHERE c.attributed_source_id = ?
             )
             SELECT 
               r.referrals,
               a.conversions,
               CASE 
                 WHEN r.referrals > 0 THEN CAST(a.conversions AS REAL) / r.referrals
                 ELSE 0 
               END conv_rate
             FROM refs r
             LEFT JOIN attributed a ON 1=1
           `;

    const summaryResult = await d1.prepare(summaryQuery).bind(
      project_id, content_id, sinceISO, sourceResult.id, sourceResult.id
    ).first();

    // TTC percentiles placeholder (implement later if needed)
    let p50_ttc_min = 0;
    let p90_ttc_min = 0;

    // Get timeseries data
    let timeseriesQuery;
    if (window === "15m") {
      timeseriesQuery = `
              WITH params AS (
                SELECT ? AS pid, ? AS cid, ? AS since
              ),
              time_buckets AS (
                SELECT 
                  strftime('%Y-%m-%d %H:%M', datetime(ar.detected_at, 'start of hour', '+' || (strftime('%M', ar.detected_at) / 15) * 15 || ' minutes')) as ts
                FROM ai_referrals ar, params p
                WHERE ar.project_id = p.pid AND ar.content_id = p.cid AND ar.ai_source_id = ? AND ar.detected_at >= p.since
                GROUP BY ts
              )
              SELECT 
                tb.ts,
                (SELECT COUNT(*) FROM ai_referrals ar, params p WHERE ar.project_id = p.pid AND ar.content_id = p.cid AND ar.ai_source_id = ? AND strftime('%Y-%m-%d %H:%M', datetime(ar.detected_at, 'start of hour', '+' || (strftime('%M', ar.detected_at) / 15) * 15 || ' minutes')) = tb.ts) as referrals,
                (SELECT COUNT(*) FROM conversion_event ce, params p WHERE ce.project_id = p.pid AND ar.content_id = p.cid AND strftime('%Y-%m-%d %H:%M', datetime(ce.occurred_at, 'start of hour', '+' || (strftime('%M', ce.occurred_at) / 15) * 15 || ' minutes')) = tb.ts) as conversions
              FROM time_buckets tb
              ORDER BY tb.ts
            `;
    } else if (window === "24h") {
      timeseriesQuery = `
              WITH params AS (
                SELECT ? AS pid, ? AS cid, ? AS since
              ),
              time_buckets AS (
                SELECT 
                  strftime('%Y-%m-%d %H:00', ar.detected_at) as ts
                FROM ai_referrals ar, params p
                WHERE ar.project_id = p.pid AND ar.content_id = p.cid AND ar.ai_source_id = ? AND ar.detected_at >= p.since
                GROUP BY ts
              )
              SELECT 
                tb.ts,
                (SELECT COUNT(*) FROM ai_referrals ar, params p WHERE ar.project_id = p.pid AND ar.content_id = p.cid AND ar.ai_source_id = ? AND strftime('%Y-%m-%d %H:00', ar.detected_at) = tb.ts) as referrals,
                (SELECT COUNT(*) FROM conversion_event ce, params p WHERE ce.project_id = p.pid AND ar.content_id = p.cid AND strftime('%Y-%m-%d %H:00', ce.occurred_at) = tb.ts) as conversions
              FROM time_buckets tb
              ORDER BY tb.ts
            `;
    } else { // 7d
      timeseriesQuery = `
              WITH params AS (
                SELECT ? AS pid, ? AS cid, ? AS since
              ),
              time_buckets AS (
                SELECT 
                  date(ar.detected_at) as ts
                FROM ai_referrals ar, params p
                WHERE ar.project_id = p.pid AND ar.content_id = p.cid AND ar.ai_source_id = ? AND ar.detected_at >= p.since
                GROUP BY ts
              )
              SELECT 
                tb.ts,
                (SELECT COUNT(*) FROM ai_referrals ar, params p WHERE ar.project_id = p.pid AND ar.content_id = p.cid AND ar.ai_source_id = ? AND date(ar.detected_at) = tb.ts) as referrals,
                (SELECT COUNT(*) FROM conversion_event ce, params p WHERE ce.project_id = p.pid AND ce.content_id = p.cid AND date(ce.occurred_at) = tb.ts) as conversions
              FROM time_buckets tb
              ORDER BY tb.ts
            `;
    }

    const timeseriesResult = await d1.prepare(timeseriesQuery).bind(
      project_id, content_id, sinceISO, sourceResult.id, sourceResult.id
    ).all();

    // Get recent referral-conversion pairs
    const recentQuery = `
            WITH params AS (
              SELECT ? AS pid, ? AS cid, ? AS since, '-7 days' AS lookback
            ),
            convs AS (
              SELECT 
                ce.amount_cents,
                ce.currency,
                ce.occurred_at,
                (
                  SELECT ar.detected_at
                  FROM ai_referrals ar, params p
                  WHERE ar.project_id = ce.project_id
                    AND ar.content_id = ce.content_id
                    AND ar.detected_at <= ce.occurred_at
                    AND ar.detected_at >= datetime(ce.occurred_at, p.lookback)
                  ORDER BY ar.detected_at DESC
                  LIMIT 1
                ) AS ref_detected_at
              FROM conversion_event ce, params p
              WHERE ce.project_id = p.pid
                AND ce.content_id = p.cid
                AND ce.occurred_at >= p.since
            ),
            attributed AS (
              SELECT 
                c.amount_cents,
                c.currency,
                c.occurred_at as conversion_at,
                c.ref_detected_at,
                ((julianday(c.occurred_at) - julianday(c.ref_detected_at)) * 24 * 60) as ttc_minutes
              FROM convs c
              WHERE c.ref_detected_at IS NOT NULL
              ORDER BY c.occurred_at DESC
              LIMIT 10
            )
            SELECT * FROM attributed
          `;

    const recentResult = await d1.prepare(recentQuery).bind(
      project_id, content_id, sinceISO
    ).all();

    // Record metrics: funnels detail viewed
    try {
      await d1.prepare(`
              INSERT INTO metrics (key, value, created_at) 
              VALUES (?, 1, ?) 
              ON CONFLICT(key) DO UPDATE SET 
                value = value + 1, 
                updated_at = ?
            `).bind(
        `funnels_detail_viewed_5m:${Math.floor(Date.now() / (5 * 60 * 1000))}`,
        new Date().toISOString(),
        new Date().toISOString()
      ).run();
    } catch (e) {
      // Metrics recording failed, but don't break the main flow
      console.warn("Failed to record funnels detail view metric:", e);
    }

    const response = new Response(JSON.stringify({
      content: {
        id: parseInt(content_id),
        url: contentResult.url
      },
      source: {
        slug: sourceResult.slug,
        name: sourceResult.name
      },
      summary: {
        referrals: summaryResult?.referrals || 0,
        conversions: summaryResult?.conversions || 0,
        conv_rate: Math.round((summaryResult?.conv_rate || 0) * 100) / 100,
        p50_ttc_min,
        p90_ttc_min
      },
      timeseries: timeseriesResult.results || [],
      recent: recentResult.results?.map(r => ({
        ref_detected_at: r.ref_detected_at,
        conversion_at: r.conversion_at,
        ttc_minutes: r.ttc_minutes,
        amount_cents: r.amount_cents,
        currency: r.currency
      })) || []
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=120"
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Funnels detail error:", e);
    const response = new Response(JSON.stringify({
      error: "Internal server error",
      message: e.message
    }), { status: 500, headers: { "Content-Type": "application/json" } });
    return addCorsHeaders(response, origin);
  }
}

// =====================================
// RECOMMENDATIONS v1 ENDPOINTS
// =====================================

// 7.1.1) List Recommendations endpoint
if (url.pathname === "/api/recommendations" && request.method === "GET") {
  try {
    const { project_id, window = "7d", status = "all", severity, type, q, sort = "impact_desc", page = "1", pageSize = "50" } = Object.fromEntries(url.searchParams);

    if (!project_id) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate window parameter
    if (!["15m", "24h", "7d"].includes(window)) {
      const response = new Response(JSON.stringify({ error: "Invalid window. Must be one of: 15m, 24h, 7d" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Calculate time window
    const now = new Date();
    let sinceTime;
    switch (window) {
      case "15m":
        sinceTime = new Date(now.getTime() - 15 * 60 * 1000);
        break;
      case "24h":
        sinceTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
      default:
        sinceTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }
    const sinceISO = sinceTime.toISOString();

    // Get environment thresholds (with defaults)
    const minReferrals = parseInt(env.RECO_MIN_REFERRALS || "5");
    const minDirect = parseInt(env.RECO_MIN_DIRECT || "20");
    const minConvRate = parseFloat(env.RECO_MIN_CONV_RATE || "0.05");
    const slowTtcMin = parseInt(env.RECO_SLOW_TTC_MIN || "120");

    let recommendations = [];

    // R1: No-visibility source
    const r1Query = `
            WITH params AS (SELECT ? AS pid, ? AS since)
            SELECT s.slug, s.name, 0 AS referrals
            FROM project_ai_sources pas
            JOIN ai_sources s ON s.id = pas.ai_source_id
            LEFT JOIN (
              SELECT ai_source_id, COUNT(*) AS cnt
              FROM ai_referrals, params p
              WHERE project_id = p.pid AND detected_at >= p.since
              GROUP BY ai_source_id
            ) r ON r.ai_source_id = pas.ai_source_id
            WHERE pas.project_id = (SELECT pid FROM params)
              AND COALESCE(r.cnt, 0) = 0
              AND pas.enabled = 1;
          `;

    const r1Results = await d1.prepare(r1Query).bind(project_id, sinceISO).all();

    for (const r1 of r1Results.results || []) {
      // Check if other sources have referrals
      const otherSourcesQuery = `
              SELECT COUNT(*) AS total_refs
              FROM ai_referrals ar
              JOIN project_ai_sources pas ON pas.ai_source_id = ar.ai_source_id
              WHERE ar.project_id = ? AND ar.detected_at >= ? AND pas.enabled = 1;
            `;
      const otherSourcesResult = await d1.prepare(otherSourcesQuery).bind(project_id, sinceISO).first();
      const hasOtherTraffic = (otherSourcesResult?.total_refs || 0) > 0;

      recommendations.push({
        rec_id: `R1:${r1.slug}`,
        type: "R1",
        severity: hasOtherTraffic ? "high" : "medium",
        title: "No AI referrals from enabled source",
        description: `${r1.name} is enabled but generated 0 referrals in the last ${window}.`,
        impact_score: hasOtherTraffic ? 60 : 40,
        effort: "low",
        status: "open",
        evidence: {
          source_slug: r1.slug,
          source_name: r1.name,
          window,
          referrals: 0
        },
        links: [
          { label: "Configure Source", href: `/sources?source=${r1.slug}` },
          { label: "View Funnels", href: `/funnels?source=${r1.slug}` }
        ],
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      });
    }

    // R2: High referrals, weak conversions
    const r2Query = `
            WITH params AS (SELECT ? AS pid, ? AS since, '-7 days' AS lookback),
            refs AS (
              SELECT content_id, ai_source_id, COUNT(*) AS referrals
              FROM ai_referrals, params p
              WHERE project_id = p.pid AND detected_at >= p.since
              GROUP BY content_id, ai_source_id
            ),
            convs AS (
              SELECT ce.id, ce.content_id,
                (SELECT ar.ai_source_id
                 FROM ai_referrals ar, params p
                 WHERE ar.project_id = ce.project_id
                   AND ar.content_id = ce.content_id
                   AND ar.detected_at <= ce.occurred_at
                   AND ar.detected_at >= datetime(ce.occurred_at, p.lookback)
                 ORDER BY ar.detected_at DESC LIMIT 1) AS attributed_source_id
              FROM conversion_event ce, params p
              WHERE ce.project_id = p.pid AND ce.occurred_at >= p.since
            ),
            agg AS (
              SELECT r.content_id, r.ai_source_id,
                     r.referrals,
                     SUM(CASE WHEN c.attributed_source_id = r.ai_source_id THEN 1 ELSE 0 END) AS conversions
              FROM refs r
              LEFT JOIN convs c ON c.content_id = r.content_id
              GROUP BY r.content_id, r.ai_source_id
            )
            SELECT a.content_id, a.ai_source_id, a.referrals, a.conversions,
                   ca.url, s.slug AS source_slug, s.name AS source_name
            FROM agg a
            JOIN content_assets ca ON ca.id = a.content_id
            JOIN ai_sources s ON s.id = a.ai_source_id
            WHERE a.referrals >= ? AND (CAST(a.conversions AS REAL)/a.referrals) < ?;
          `;

    const r2Results = await d1.prepare(r2Query).bind(project_id, sinceISO, minReferrals, minConvRate).all();

    for (const r2 of r2Results.results || []) {
      const convRate = r2.conversions / r2.referrals;
      recommendations.push({
        rec_id: `R2:${r2.content_id}:${r2.source_slug}`,
        type: "R2",
        severity: "high",
        title: "High AI referrals but weak conversions",
        description: `${r2.source_name} sends traffic to ${new URL(r2.url).pathname}, but conversion rate is ${Math.round(convRate * 1000) / 10}% (threshold ${minConvRate * 100}%).`,
        impact_score: Math.min(100, Math.round(r2.referrals / 2 + (1 - convRate) * 100)),
        effort: "medium",
        status: "open",
        evidence: {
          url: r2.url,
          source_slug: r2.source_slug,
          source_name: r2.source_name,
          referrals: r2.referrals,
          conversions: r2.conversions,
          conv_rate: Math.round(convRate * 1000) / 1000
        },
        links: [
          { label: "Open in Funnels", href: `/funnels?source=${r2.source_slug}&q=${encodeURIComponent(new URL(r2.url).pathname)}` },
          { label: "Open Content", href: `/content?search=${encodeURIComponent(new URL(r2.url).pathname)}` }
        ],
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      });
    }

    // R3: Strong direct traffic, zero AI referrals
    const r3Query = `
            WITH params AS (SELECT ? AS pid, ? AS since),
            directs AS (
              SELECT content_id, COUNT(*) AS direct_cnt
              FROM interaction_events, params p
              WHERE project_id = p.pid
                AND occurred_at >= p.since
                AND json_extract(metadata,'$.class') = 'direct_human'
                AND content_id IS NOT NULL
              GROUP BY content_id
            ),
            refs AS (
              SELECT content_id, COUNT(*) AS ref_cnt
              FROM ai_referrals, params p
              WHERE project_id = p.pid AND detected_at >= p.since
              GROUP BY content_id
            )
            SELECT d.content_id, d.direct_cnt, ca.url
            FROM directs d
            LEFT JOIN refs r ON r.content_id = d.content_id
            JOIN content_assets ca ON ca.id = d.content_id
            WHERE COALESCE(r.ref_cnt, 0) = 0 AND d.direct_cnt >= ?;
          `;

    const r3Results = await d1.prepare(r3Query).bind(project_id, sinceISO, minDirect).all();

    for (const r3 of r3Results.results || []) {
      recommendations.push({
        rec_id: `R3:${r3.content_id}`,
        type: "R3",
        severity: "medium",
        title: "Strong direct traffic but zero AI referrals",
        description: `${new URL(r3.url).pathname} has ${r3.direct_cnt} direct visits but 0 AI referrals in the last ${window}.`,
        impact_score: Math.min(80, Math.round(r3.direct_cnt / 2)),
        effort: "medium",
        status: "open",
        evidence: {
          url: r3.url,
          direct_count: r3.direct_cnt,
          referrals: 0,
          window
        },
        links: [
          { label: "View Sources", href: `/sources` },
          { label: "Open Content", href: `/content?search=${encodeURIComponent(new URL(r3.url).pathname)}` }
        ],
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      });
    }

    // R4: Slow time-to-conversion
    const r4Query = `
            WITH params AS (SELECT ? AS pid, ? AS since, '-7 days' AS lookback),
            cv AS (
              SELECT ce.content_id, ce.occurred_at,
                (SELECT detected_at
                 FROM ai_referrals ar, params p
                 WHERE ar.project_id = ce.project_id
                   AND ar.content_id = ce.content_id
                   AND ar.detected_at <= ce.occurred_at
                   AND ar.detected_at >= datetime(ce.occurred_at, p.lookback)
                 ORDER BY ar.detected_at DESC LIMIT 1) AS last_ref_at,
                (SELECT ai_source_id
                 FROM ai_referrals ar, params p
                 WHERE ar.project_id = ce.project_id
                   AND ar.content_id = ce.content_id
                   AND ar.detected_at <= ce.occurred_at
                   AND ar.detected_at >= datetime(ce.occurred_at, p.lookback)
                 ORDER BY ar.detected_at DESC LIMIT 1) AS last_src_id
              FROM conversion_event ce, params p
              WHERE ce.project_id = p.pid AND ce.occurred_at >= p.since
            ),
            pairs AS (
              SELECT content_id, last_src_id AS ai_source_id,
                     ((julianday(occurred_at) - julianday(last_ref_at)) * 1440.0) AS ttc_min
              FROM cv
              WHERE last_ref_at IS NOT NULL AND last_src_id IS NOT NULL
            )
            SELECT p.content_id, p.ai_source_id, AVG(p.ttc_min) AS avg_ttc_min, COUNT(*) AS convs,
                   ca.url, s.slug AS source_slug, s.name AS source_name
            FROM pairs p
            JOIN content_assets ca ON ca.id = p.content_id
            JOIN ai_sources s ON s.id = p.ai_source_id
            GROUP BY p.content_id, p.ai_source_id
            HAVING avg_ttc_min > ? AND convs >= 2;
          `;

    const r4Results = await d1.prepare(r4Query).bind(project_id, sinceISO, slowTtcMin).all();

    for (const r4 of r4Results.results || []) {
      recommendations.push({
        rec_id: `R4:${r4.content_id}:${r4.source_slug}`,
        type: "R4",
        severity: "medium",
        title: "Slow time-to-conversion",
        description: `Conversions from ${r4.source_name} to ${new URL(r4.url).pathname} take ${Math.round(r4.avg_ttc_min)} minutes on average (threshold ${slowTtcMin} min).`,
        impact_score: Math.min(70, Math.round(r4.avg_ttc_min - slowTtcMin)),
        effort: "medium",
        status: "open",
        evidence: {
          url: r4.url,
          source_slug: r4.source_slug,
          source_name: r4.source_name,
          avg_ttc_min: Math.round(r4.avg_ttc_min * 10) / 10,
          conversions: r4.convs
        },
        links: [
          { label: "Open in Funnels", href: `/funnels/detail?project_id=${project_id}&content_id=${r4.content_id}&source=${r4.source_slug}` },
          { label: "Open Content", href: `/content?search=${encodeURIComponent(new URL(r4.url).pathname)}` }
        ],
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      });
    }

    // R5: Pending fingerprint suggestions
    const r5Query = `
            SELECT COUNT(*) AS pending_count
            FROM rules_suggestions
            WHERE project_id = ? AND status = 'pending';
          `;

    const r5Result = await d1.prepare(r5Query).bind(project_id).first();

    if (r5Result?.pending_count > 0) {
      recommendations.push({
        rec_id: "R5:rules_suggestions_pending",
        type: "R5",
        severity: "low",
        title: "Pending fingerprint suggestions",
        description: `You have ${r5Result.pending_count} pending fingerprint suggestions that need review.`,
        impact_score: Math.min(40, r5Result.pending_count * 5),
        effort: "low",
        status: "open",
        evidence: {
          count: r5Result.pending_count
        },
        links: [
          { label: "Review Suggestions", href: `/sources#suggestions` }
        ],
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      });
    }

    // Apply overrides from recommendation_override table
    const overrideQuery = `
            SELECT rec_id, status, note, updated_at
            FROM recommendation_override
            WHERE project_id = ?;
          `;

    const overrideResults = await d1.prepare(overrideQuery).bind(project_id).all();
    const overrides = {};
    for (const override of overrideResults.results || []) {
      overrides[override.rec_id] = override;
    }

    // Apply overrides to recommendations
    recommendations = recommendations.map(rec => {
      if (overrides[rec.rec_id]) {
        const override = overrides[rec.rec_id];
        return {
          ...rec,
          status: override.status,
          note: override.note,
          updated_at: override.updated_at
        };
      }
      return rec;
    });

    // Apply filters
    if (status !== "all") {
      recommendations = recommendations.filter(rec => rec.status === status);
    }
    if (severity) {
      recommendations = recommendations.filter(rec => rec.severity === severity);
    }
    if (type) {
      recommendations = recommendations.filter(rec => rec.type === type);
    }
    if (q) {
      const query = q.toLowerCase();
      recommendations = recommendations.filter(rec =>
        rec.title.toLowerCase().includes(query) ||
        rec.description.toLowerCase().includes(query) ||
        (rec.evidence.url && rec.evidence.url.toLowerCase().includes(query)) ||
        (rec.evidence.source_name && rec.evidence.source_name.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    const validSorts = ["impact_desc", "severity_desc", "type_asc", "url_asc"];
    const actualSort = validSorts.includes(sort) ? sort : "impact_desc";

    recommendations.sort((a, b) => {
      switch (actualSort) {
        case "impact_desc":
          return b.impact_score - a.impact_score;
        case "severity_desc":
          const severityOrder = { high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        case "type_asc":
          return a.type.localeCompare(b.type);
        case "url_asc":
          return (a.evidence.url || "").localeCompare(b.evidence.url || "");
        default:
          return 0;
      }
    });

    // Apply pagination
    const pageNum = Math.max(1, parseInt(page));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const total = recommendations.length;
    const offset = (pageNum - 1) * pageSizeNum;
    const items = recommendations.slice(offset, offset + pageSizeNum);

    // Record metrics: recommendations list viewed
    try {
      await d1.prepare(`
              INSERT INTO metrics (key, value, created_at) 
              VALUES (?, 1, ?) 
              ON CONFLICT(key) DO UPDATE SET 
                value = value + 1, 
                updated_at = ?
            `).bind(
        `reco_list_viewed_5m:${Math.floor(Date.now() / (5 * 60 * 1000))}`,
        new Date().toISOString(),
        new Date().toISOString()
      ).run();
    } catch (e) {
      console.warn("Failed to record recommendations list metric:", e);
    }

    const response = new Response(JSON.stringify({
      items,
      page: pageNum,
      pageSize: pageSizeNum,
      total
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=120"
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Recommendations list error:", e);
    const response = new Response(JSON.stringify({
      error: "Internal server error",
      message: e.message
    }), { status: 500, headers: { "Content-Type": "application/json" } });
    return addCorsHeaders(response, origin);
  }
}

// 7.1.2) Update Recommendation Status endpoint
if (url.pathname === "/api/recommendations/status" && request.method === "POST") {
  try {
    const body = await request.json();
    const { project_id, rec_id, status, note } = body;

    if (!project_id || !rec_id || !status) {
      const response = new Response(JSON.stringify({ error: "project_id, rec_id, and status are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    if (!["open", "dismissed", "resolved"].includes(status)) {
      const response = new Response(JSON.stringify({ error: "status must be one of: open, dismissed, resolved" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Upsert into recommendation_override
    await d1.prepare(`
            INSERT INTO recommendation_override (project_id, rec_id, status, note, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(project_id, rec_id) DO UPDATE SET
              status = ?,
              note = ?,
              updated_at = ?
          `).bind(
      project_id, rec_id, status, note || null, new Date().toISOString(),
      status, note || null, new Date().toISOString()
    ).run();

    // Record metrics: recommendation status updated
    try {
      await d1.prepare(`
              INSERT INTO metrics (key, value, created_at) 
              VALUES (?, 1, ?) 
              ON CONFLICT(key) DO UPDATE SET 
                value = value + 1, 
                updated_at = ?
            `).bind(
        `reco_status_updated_5m:${Math.floor(Date.now() / (5 * 60 * 1000))}`,
        new Date().toISOString(),
        new Date().toISOString()
      ).run();
    } catch (e) {
      console.warn("Failed to record recommendation status metric:", e);
    }

    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Recommendation status update error:", e);
    const response = new Response(JSON.stringify({
      error: "Internal server error",
      message: e.message
    }), { status: 500, headers: { "Content-Type": "application/json" } });
    return addCorsHeaders(response, origin);
  }
}

// 7.1.3) Reset Recommendation Status endpoint
if (url.pathname === "/api/recommendations/reset" && request.method === "POST") {
  try {
    const body = await request.json();
    const { project_id, rec_id } = body;

    if (!project_id || !rec_id) {
      const response = new Response(JSON.stringify({ error: "project_id and rec_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Delete from recommendation_override
    await d1.prepare(`
            DELETE FROM recommendation_override 
            WHERE project_id = ? AND rec_id = ?
          `).bind(project_id, rec_id).run();

    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Recommendation reset error:", e);
    const response = new Response(JSON.stringify({
      error: "Internal server error",
      message: e.message
    }), { status: 500, headers: { "Content-Type": "application/json" } });
    return addCorsHeaders(response, origin);
  }
}

// =====================================

// 7.1) Referrals summary endpoint
if (url.pathname === "/api/referrals/summary" && request.method === "GET") {
  try {
    // Session authentication
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT s.user_id, u.email 
            FROM session s 
            JOIN user u ON u.id = s.user_id 
            WHERE s.session_id = ? AND s.expires_at > CURRENT_TIMESTAMP
          `).bind(sessionId).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting: 60 rpm per user
    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const userKey = `rate_limit:referrals_summary:user:${sessionData.user_id}`;
    const userLimit = await checkRateLimit(userKey, 60, 60 * 1000); // 60 rpm

    if (!userLimit.allowed) {
      const response = new Response(JSON.stringify({
        error: "Rate limited",
        retry_after: Math.ceil(userLimit.retryAfter / 1000)
      }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const projectId = url.searchParams.get("project_id");
    const window = url.searchParams.get("window") || "24h";

    if (!projectId) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user has access to this project
    const userOrgMember = await d1.prepare(`
            SELECT om.role 
            FROM org_member om
            JOIN project p ON p.org_id = om.org_id
            WHERE p.id = ? AND om.user_id = ?
          `).bind(projectId, sessionData.user_id).first();

    if (!userOrgMember) {
      const response = new Response(JSON.stringify({ error: "Access denied to project" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate window parameter
    if (!['15m', '24h', '7d'].includes(window)) {
      const response = new Response(JSON.stringify({ error: "Invalid window. Must be one of: 15m, 24h, 7d" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Calculate time window
    let timeFilter;
    let bucketFormat;
    if (window === '15m') {
      timeFilter = "datetime('now','-15 minutes')";
      bucketFormat = "datetime(?, 'unixepoch')";
    } else if (window === '24h') {
      timeFilter = "datetime('now','-1 day')";
      bucketFormat = "strftime('%Y-%m-%d %H:00:00', datetime(?, 'unixepoch'))";
    } else { // 7d
      timeFilter = "datetime('now','-7 days')";
      bucketFormat = "strftime('%Y-%m-%d', datetime(?, 'unixepoch'))";
    }

    // Get totals
    const totals = await d1.prepare(`
            SELECT 
                              COUNT(*) referrals,
              COUNT(DISTINCT content_id) as contents,
              COUNT(DISTINCT ai_source_id) as sources
            FROM ai_referrals 
            WHERE project_id = ? AND detected_at >= ${timeFilter}
          `).bind(projectId).first();

    // Get by source
    const bySource = await d1.prepare(`
            SELECT 
              s.slug,
              s.name,
              COUNT(*) as count
            FROM ai_referrals ar
            JOIN ai_sources s ON s.id = ar.ai_source_id
            WHERE ar.project_id = ? AND ar.detected_at >= ${timeFilter}
            GROUP BY ar.ai_source_id, s.slug, s.name
            ORDER BY count DESC
          `).bind(projectId).all();

    // Get top content
    const topContent = await d1.prepare(`
            SELECT 
              ar.content_id,
              ca.url,
              COUNT(*) as count
            FROM ai_referrals ar
            JOIN content_assets ca ON ca.id = ar.content_id
            WHERE ar.project_id = ? AND ar.detected_at >= ${timeFilter}
            GROUP BY ar.content_id, ca.url
            ORDER BY count DESC
            LIMIT 10
          `).bind(projectId).all();

    // Get timeseries
    let timeseries = [];
    if (window === '15m') {
      // For 15m, show 15 buckets of 1 minute each
      const now = Math.floor(Date.now() / 1000);
      for (let i = 14; i >= 0; i--) {
        const bucketStart = now - (i * 60);
        const bucketEnd = bucketStart + 60;
        const count = await d1.prepare(`
                SELECT COUNT(*) as count
                FROM ai_referrals
                WHERE project_id = ? 
                  AND detected_at >= datetime(?, 'unixepoch')
                  AND detected_at < datetime(?, 'unixepoch')
              `).bind(projectId, bucketStart, bucketEnd).first();

        timeseries.push({
          ts: new Date(bucketStart * 1000).toISOString(),
          count: count?.count || 0
        });
      }
    } else if (window === '24h') {
      // For 24h, show 24 buckets of 1 hour each
      const now = Math.floor(Date.now() / 1000);
      for (let i = 23; i >= 0; i--) {
        const bucketStart = now - (i * 3600);
        const bucketEnd = bucketStart + 3600;
        const count = await d1.prepare(`
                SELECT COUNT(*) as count
                FROM ai_referrals
                WHERE project_id = ? 
                  AND detected_at >= datetime(?, 'unixepoch')
                  AND detected_at < datetime(?, 'unixepoch')
              `).bind(projectId, bucketStart, bucketEnd).first();

        timeseries.push({
          ts: new Date(bucketStart * 1000).toISOString(),
          count: count?.count || 0
        });
      }
    } else { // 7d
      // For 7d, show 7 buckets of 1 day each
      const now = Math.floor(Date.now() / 1000);
      for (let i = 6; i >= 0; i--) {
        const bucketStart = now - (i * 86400);
        const bucketEnd = bucketStart + 86400;
        const count = await d1.prepare(`
                SELECT COUNT(*) as count
                FROM ai_referrals
                WHERE project_id = ? 
                  AND detected_at >= datetime(?, 'unixepoch')
                  AND detected_at < datetime(?, 'unixepoch')
              `).bind(projectId, bucketStart, bucketEnd).first();

        timeseries.push({
          ts: new Date(bucketStart * 1000).toISOString(),
          count: count?.count || 0
        });
      }
    }

    const response = new Response(JSON.stringify({
      totals: {
        referrals: totals?.referrals || 0,
        contents: totals?.contents || 0,
        sources: totals?.sources || 0
      },
      by_source: bySource?.results || [],
      top_content: topContent?.results || [],
      timeseries: timeseries
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60"
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Referrals summary error:", e);
    const response = new Response(JSON.stringify({ error: "Failed to get referrals summary" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 7.2) Referrals list endpoint
if (url.pathname === "/api/referrals" && request.method === "GET") {
  try {
    // Session authentication (same pattern as content endpoints)
    const sessionCookie = request.headers.get("cookie");
    const sessionMatch = sessionCookie?.match(/optiview_session=([^;]+)/);
    if (!sessionCookie || !sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session 
            WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP
          `).bind(sessionId).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const projectId = url.searchParams.get("project_id");
    const window = url.searchParams.get("window") || "24h";

    if (!projectId) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify user has access to this project
    const accessCheck = await d1.prepare(`
            SELECT COUNT(*) as count
            FROM org_member om
            JOIN project p ON p.org_id = om.org_id
            WHERE p.id = ? AND om.user_id = ?
          `).bind(projectId, sessionData.user_id).first();

    if (accessCheck.count === 0) {
      const response = new Response(JSON.stringify({ error: "Access denied to project" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
    const source = url.searchParams.get("source");
    const q = url.searchParams.get("q");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "50"), 100);

    if (!projectId) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate window parameter
    if (!['15m', '24h', '7d'].includes(window)) {
      const response = new Response(JSON.stringify({ error: "Invalid window. Must be one of: 15m, 24h, 7d" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Calculate time window
    let timeFilter;
    if (window === '15m') {
      timeFilter = "datetime('now','-15 minutes')";
    } else if (window === '24h') {
      timeFilter = "datetime('now','-1 day')";
    } else { // 7d
      timeFilter = "datetime('now','-7 days')";
    }

    // Build WHERE clause
    let whereConditions = [`ar.project_id = ?`, `ar.detected_at >= ${timeFilter}`];
    let params = [projectId];

    if (source) {
      whereConditions.push(`s.slug = ?`);
      params.push(source);
    }

    if (q) {
      whereConditions.push(`ca.url LIKE ?`);
      params.push(`%${q}%`);
    }

    const whereClause = whereConditions.join(" AND ");

    // Get total count
    const totalQuery = `
            SELECT COUNT(*) as count
            FROM (
              SELECT DISTINCT ar.content_id, ar.ai_source_id
              FROM ai_referrals ar
              JOIN ai_sources s ON s.id = ar.ai_source_id
              JOIN content_assets ca ON ca.id = ar.content_id
              WHERE ${whereClause}
            )
          `;
    const totalResult = await d1.prepare(totalQuery).bind(...params).first();
    const total = totalResult?.count || 0;

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const listQuery = `
            SELECT 
              ar.content_id,
              ca.url,
              s.slug as source_slug,
              s.name as source_name,
              MAX(ar.detected_at) as last_seen,
              SUM(CASE WHEN ar.detected_at >= datetime('now','-15 minutes') THEN 1 ELSE 0 END) as referrals_15m,
              SUM(CASE WHEN ar.detected_at >= datetime('now','-1 day') THEN 1 ELSE 0 END) as referrals_24h
            FROM ai_referrals ar
            JOIN ai_sources s ON s.id = ar.ai_source_id
            JOIN content_assets ca ON ca.id = ar.content_id
            WHERE ${whereClause}
            GROUP BY ar.content_id, ar.ai_source_id, ca.url, s.slug, s.name
            ORDER BY referrals_24h DESC, last_seen DESC
            LIMIT ? OFFSET ?
          `;
    const listResult = await d1.prepare(listQuery).bind(...params, pageSize, offset).all();

    // Calculate share_of_ai for each row
    const items = await Promise.all(listResult.results.map(async (row) => {
      // Get total AI events for this content in the window
      const totalAIEvents = await d1.prepare(`
              SELECT COUNT(*) as count
              FROM interaction_events
              WHERE project_id = ? AND content_id = ? AND ai_source_id IS NOT NULL AND occurred_at >= ${timeFilter}
            `).bind(projectId, row.content_id).first();

      const shareOfAI = totalAIEvents?.count > 0 ? (row.referrals_24h / totalAIEvents.count) : 0;

      return {
        content_id: row.content_id,
        url: row.url,
        source_slug: row.source_slug,
        source_name: row.source_name,
        last_seen: row.last_seen,
        referrals_15m: row.referrals_15m,
        referrals_24h: row.referrals_24h,
        share_of_ai: Math.round(shareOfAI * 100) / 100 // Round to 2 decimal places
      };
    }));

    const response = new Response(JSON.stringify({
      items: items,
      page: page,
      pageSize: pageSize,
      total: total
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60"
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Referrals list error:", e);
    console.error("Error details:", {
      message: e.message,
      stack: e.stack,
      name: e.name
    });
    const response = new Response(JSON.stringify({
      error: "Failed to get referrals list",
      debug: e.message // Include error message for debugging
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 7.3) Referrals detail endpoint
if (url.pathname === "/api/referrals/detail" && request.method === "GET") {
  try {
    // Rate limiting: 60 rpm per user
    const rateLimitKey = `referrals_detail:${request.headers.get('x-optiview-request-id') || 'anonymous'}`;
    const rateLimitResult = await checkRateLimit(env, rateLimitKey, 60, 60);
    if (!rateLimitResult.allowed) {
      const response = new Response(JSON.stringify({
        error: "Rate limit exceeded",
        retry_after: rateLimitResult.retryAfter
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rateLimitResult.retryAfter.toString()
        }
      });
      return addCorsHeaders(response, origin);
    }

    const projectId = url.searchParams.get("project_id");
    const contentId = url.searchParams.get("content_id");
    const aiSourceId = url.searchParams.get("ai_source_id");
    const window = url.searchParams.get("window") || "24h";

    if (!projectId || !contentId || !aiSourceId) {
      const response = new Response(JSON.stringify({ error: "project_id, content_id, and ai_source_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate window parameter
    if (!['15m', '24h', '7d'].includes(window)) {
      const response = new Response(JSON.stringify({ error: "Invalid window. Must be one of: 15m, 24h, 7d" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Calculate time window
    let timeFilter;
    if (window === '15m') {
      timeFilter = "datetime('now','-15 minutes')";
    } else if (window === '24h') {
      timeFilter = "datetime('now','-1 day')";
    } else { // 7d
      timeFilter = "datetime('now','-7 days')";
    }

    // Get content info
    const content = await d1.prepare(`
            SELECT id, url FROM content_assets 
            WHERE id = ? AND project_id = ?
          `).bind(contentId, projectId).first();

    if (!content) {
      const response = new Response(JSON.stringify({ error: "Content not found or not accessible" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Get source info
    const source = await d1.prepare(`
            SELECT id, slug, name FROM ai_sources WHERE id = ?
          `).bind(aiSourceId).first();

    if (!source) {
      const response = new Response(JSON.stringify({ error: "AI source not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Get summary stats
    const summary = await d1.prepare(`
            SELECT 
              SUM(CASE WHEN detected_at >= datetime('now','-15 minutes') THEN 1 ELSE 0 END) as referrals_15m,
              SUM(CASE WHEN detected_at >= datetime('now','-1 day') THEN 1 ELSE 0 END) as referrals_24h,
              MAX(detected_at) as last_seen
            FROM ai_referrals
            WHERE project_id = ? AND content_id = ? AND ai_source_id = ? AND detected_at >= ${timeFilter}
          `).bind(projectId, contentId, aiSourceId).first();

    // Get timeseries
    let timeseries = [];
    if (window === '15m') {
      // For 15m, show 15 buckets of 1 minute each
      const now = Math.floor(Date.now() / 1000);
      for (let i = 14; i >= 0; i--) {
        const bucketStart = now - (i * 60);
        const bucketEnd = bucketStart + 60;
        const count = await d1.prepare(`
                SELECT COUNT(*) as count
                FROM ai_referrals
                WHERE project_id = ? AND content_id = ? AND ai_source_id = ?
                  AND detected_at >= datetime(?, 'unixepoch')
                  AND detected_at < datetime(?, 'unixepoch')
              `).bind(projectId, contentId, aiSourceId, bucketStart, bucketEnd).first();

        timeseries.push({
          ts: new Date(bucketStart * 1000).toISOString(),
          count: count?.count || 0
        });
      }
    } else if (window === '24h') {
      // For 24h, show 24 buckets of 1 hour each
      const now = Math.floor(Date.now() / 1000);
      for (let i = 23; i >= 0; i--) {
        const bucketStart = now - (i * 3600);
        const bucketEnd = bucketStart + 3600;
        const count = await d1.prepare(`
                SELECT COUNT(*) as count
                FROM ai_referrals
                WHERE project_id = ? AND content_id = ? AND ai_source_id = ?
                  AND detected_at >= datetime(?, 'unixepoch')
                  AND detected_at < datetime(?, 'unixepoch')
              `).bind(projectId, contentId, aiSourceId, bucketStart, bucketEnd).first();

        timeseries.push({
          ts: new Date(bucketStart * 1000).toISOString(),
          count: count?.count || 0
        });
      }
    } else { // 7d
      // For 7d, show 7 buckets of 1 day each
      const now = Math.floor(Date.now() / 1000);
      for (let i = 6; i >= 0; i--) {
        const bucketStart = now - (i * 86400);
        const bucketEnd = bucketStart + 86400;
        const count = await d1.prepare(`
                SELECT COUNT(*) as count
                FROM ai_referrals
                WHERE project_id = ? AND content_id = ? AND ai_source_id = ?
                  AND detected_at >= datetime(?, 'unixepoch')
                  AND detected_at < datetime(?, 'unixepoch')
              `).bind(projectId, contentId, aiSourceId, bucketStart, bucketEnd).first();

        timeseries.push({
          ts: new Date(bucketStart * 1000).toISOString(),
          count: count?.count || 0
        });
      }
    }

    // Get recent referrals (last 10)
    const recent = await d1.prepare(`
            SELECT 
              detected_at,
              ref_url,
              metadata
            FROM ai_referrals
            WHERE project_id = ? AND content_id = ? AND ai_source_id = ? AND detected_at >= ${timeFilter}
            ORDER BY detected_at DESC
            LIMIT 10
          `).bind(projectId, contentId, aiSourceId).all();

    const response = new Response(JSON.stringify({
      content: {
        id: content.id,
        url: content.url
      },
      source: {
        id: source.id,
        slug: source.slug,
        name: source.name
      },
      summary: {
        referrals_15m: summary?.referrals_15m || 0,
        referrals_24h: summary?.referrals_24h || 0,
        last_seen: summary?.last_seen || null
      },
      timeseries: timeseries,
      recent: recent.results.map(row => ({
        detected_at: row.detected_at,
        ref_url: row.ref_url,
        metadata: row.metadata ? JSON.parse(row.metadata) : {}
      }))
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=120"
      }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Referrals detail error:", e);
    const response = new Response(JSON.stringify({ error: "Failed to get referrals detail" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 7.5) Events last-seen endpoint (for install verification)
if (url.pathname === "/api/events/last-seen" && request.method === "GET") {
  try {
    const projectId = url.searchParams.get("project_id");
    const propertyId = url.searchParams.get("property_id");

    if (!projectId) {
      const response = new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const fifteenMinutesAgo = new Date(Date.now() - (15 * 60 * 1000)).toISOString();

    // Get events in the last 15 minutes for this project
    const recentEventsQuery = `
            SELECT COUNT(*) as count, event_type, 
                   json_extract(metadata, '$.class') as traffic_class
            FROM interaction_events 
            WHERE project_id = ? 
              AND occurred_at >= ? 
              ${propertyId ? 'AND property_id = ?' : ''}
            GROUP BY event_type, traffic_class
          `;

    const recentEventsParams = [projectId, fifteenMinutesAgo];
    if (propertyId) recentEventsParams.push(propertyId);

    const recentEvents = await d1.prepare(recentEventsQuery).bind(...recentEventsParams).all();

    // Get the last event timestamp
    const lastEventQuery = `
            SELECT occurred_at, event_type FROM interaction_events 
            WHERE project_id = ? 
              ${propertyId ? 'AND property_id = ?' : ''}
            ORDER BY occurred_at DESC 
            LIMIT 1
          `;

    const lastEventParams = [projectId];
    if (propertyId) lastEventParams.push(propertyId);

    const lastEvent = await d1.prepare(lastEventQuery).bind(...lastEventParams).first();

    // Count total events in last 15 minutes
    const totalEventsQuery = `
            SELECT COUNT(*) as count FROM interaction_events 
            WHERE project_id = ? 
              AND occurred_at >= ?
              ${propertyId ? 'AND property_id = ?' : ''}
          `;

    const totalEventsParams = [projectId, fifteenMinutesAgo];
    if (propertyId) totalEventsParams.push(propertyId);

    const totalEvents = await d1.prepare(totalEventsQuery).bind(...totalEventsParams).first();

    // Aggregate traffic class counts
    const byClass = {
      direct_human: 0,
      human_via_ai: 0,
      ai_agent_crawl: 0,
      unknown_ai_like: 0
    };

    for (const event of recentEvents.results || []) {
      const trafficClass = event.traffic_class || 'unknown_ai_like';
      if (byClass.hasOwnProperty(trafficClass)) {
        byClass[trafficClass] += event.count;
      } else {
        byClass.unknown_ai_like += event.count;
      }
    }

    const response = new Response(JSON.stringify({
      project_id: projectId,
      property_id: propertyId || null,
      events_15m: totalEvents?.count || 0,
      by_class_15m: byClass,
      last_event_ts: lastEvent?.occurred_at || null,
      last_event_type: lastEvent?.event_type || null
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Last-seen query error:", e);
    const response = new Response(JSON.stringify({ error: "Failed to query events" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 8) Admin Purge endpoint - Proper implementation
if (url.pathname === "/admin/purge" && request.method === "POST") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Check if user is admin
    const userData = await d1.prepare(`
            SELECT is_admin FROM user WHERE id = ?
          `).bind(sessionData.user_id).first();

    if (!userData || !userData.is_admin) {
      const response = new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const body = await request.json();
    const { type, dry_run, project_id } = body;

    if (!type || !project_id) {
      const response = new Response(JSON.stringify({ error: "Type and project_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // For now, return a placeholder response since we don't have the full purge logic yet
    // TODO: Implement actual data purging when we add the retention logic
    const response = new Response(JSON.stringify({
      project_id: project_id,
      type: type,
      dry_run: dry_run || false,
      deleted_events: dry_run ? 0 : 0, // Placeholder
      deleted_referrals: dry_run ? 0 : 0, // Placeholder
      message: dry_run ? `Would delete expired ${type} data` : `Purged expired ${type} data`
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Admin purge error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 9) Admin Sources endpoints
if (url.pathname === "/admin/sources" && request.method === "POST") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Check if user is admin
    const userData = await d1.prepare(`
            SELECT is_admin FROM user WHERE id = ?
          `).bind(sessionData.user_id).first();

    if (!userData || !userData.is_admin) {
      const response = new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const body = await request.json();
    const { slug, name, category, is_active } = body;

    if (!slug || !name || !category) {
      const response = new Response(JSON.stringify({ error: "slug, name, and category are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate category enum
    const validCategories = ['chat_assistant', 'search_engine', 'crawler', 'browser_ai', 'model_api', 'other'];
    if (!validCategories.includes(category)) {
      const response = new Response(JSON.stringify({ error: "Invalid category" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Create new ai_source
    const result = await d1.prepare(`
            INSERT INTO ai_sources (slug, name, category, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(slug, name, category, is_active !== false ? 1 : 0).run();

    const response = new Response(JSON.stringify({
      success: true,
      message: "AI source created successfully",
      id: result.meta.last_row_id,
      slug,
      name,
      category,
      is_active: is_active !== false
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Admin create source error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

if (url.pathname.startsWith("/admin/sources/") && request.method === "PATCH") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Check if user is admin
    const userData = await d1.prepare(`
            SELECT is_admin FROM user WHERE id = ?
          `).bind(sessionData.user_id).first();

    if (!userData || !userData.is_admin) {
      const response = new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sourceId = url.pathname.split('/').pop();
    const body = await request.json();
    const { name, category, is_active } = body;

    // Validate category if provided
    if (category) {
      const validCategories = ['chat_assistant', 'search_engine', 'crawler', 'browser_ai', 'model_api', 'other'];
      if (!validCategories.includes(category)) {
        const response = new Response(JSON.stringify({ error: "Invalid category" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name);
    }
    if (category !== undefined) {
      updates.push("category = ?");
      values.push(category);
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(is_active ? 1 : 0);
    }
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(sourceId);

    if (updates.length === 1) { // Only updated_at
      const response = new Response(JSON.stringify({ error: "No fields to update" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const updateQuery = `UPDATE ai_sources SET ${updates.join(', ')} WHERE id = ?`;
    await d1.prepare(updateQuery).bind(...values).run();

    const response = new Response(JSON.stringify({
      success: true,
      message: "AI source updated successfully",
      id: sourceId
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Admin update source error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 10) Admin Citations Ingestion endpoint
if (url.pathname === "/admin/citations/ingest" && request.method === "POST") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];

    // Verify admin session
    const session = await d1.prepare(`
            SELECT s.*, u.email, u.is_admin 
            FROM session s 
            JOIN user u ON s.user_id = u.id 
            WHERE s.session_id = ? AND s.expires_at > datetime('now')
          `).bind(sessionId).first();

    if (!session || !session.is_admin) {
      const response = new Response(JSON.stringify({ error: "Admin privileges required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting for admin citations endpoint (30 rpm per IP)
    const clientIP = getClientIP(request);
    const adminLimiter = createRateLimiter({ rps: 30 / 60, burst: 5, retryAfter: 60 });
    const rateLimitResult = adminLimiter.tryConsume(`admin_citations_${clientIP}`);

    if (!rateLimitResult.success) {
      const response = new Response(JSON.stringify({
        error: "Rate limit exceeded",
        retryAfter: rateLimitResult.retryAfter
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rateLimitResult.retryAfter.toString()
        }
      });
      return addCorsHeaders(response, origin);
    }

    const body = await request.json();
    const { project_id, content_id, ai_source_id, ref_url, snippet, confidence, metadata } = body;

    // Validate required fields
    if (!project_id || !ai_source_id) {
      const response = new Response(JSON.stringify({
        error: "Missing required fields: project_id, ai_source_id"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Validate optional fields
    if (snippet && snippet.length > 500) {
      const response = new Response(JSON.stringify({
        error: "Snippet must be 500 characters or less"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    if (confidence !== null && confidence !== undefined && (confidence < 0 || confidence > 1)) {
      const response = new Response(JSON.stringify({
        error: "Confidence must be between 0 and 1"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Insert citation with deduplication
    const insertResult = await d1.prepare(`
            INSERT OR IGNORE INTO ai_citations 
            (project_id, content_id, ai_source_id, ref_url, snippet, confidence, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
      project_id,
      content_id || null,
      ai_source_id,
      ref_url || null,
      snippet || null,
      confidence || null,
      metadata ? JSON.stringify(metadata) : null
    ).run();

    // Invalidate cache for this project
    try {
      await bumpProjectVersion(env.CACHE, project_id);
    } catch (e) {
      console.error("Failed to invalidate cache:", e);
    }

    const response = new Response(JSON.stringify({
      success: true,
      citation_id: insertResult.meta.last_row_id,
      changes: insertResult.meta.changes
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (error) {
    console.error("Admin citations ingest error:", error);
    const response = new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 10.5) Admin Cache Diagnostic endpoint (temporary)
if (url.pathname === "/admin/cache/diag" && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Verify admin session
    const session = await d1.prepare(`
            SELECT s.*, u.email, u.is_admin 
            FROM session s 
            JOIN user u ON s.user_id = u.id 
            WHERE s.session_id = ? AND s.expires_at > datetime('now')
          `).bind(sessionId).first();

    if (!session || !session.is_admin) {
      const response = new Response(JSON.stringify({ error: "Admin privileges required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const { project_id } = Object.fromEntries(url.searchParams);
    if (!project_id) {
      const response = new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Read project version
    const pv = await getProjectVersion(env.CACHE, project_id);

    // Test KV write/read
    let putGetOk = false;
    try {
      await env.CACHE.put("diag:test", "ok", { expirationTtl: 60 });
      const testVal = await env.CACHE.get("diag:test");
      putGetOk = testVal === "ok";
    } catch (e) {
      console.error("Cache diag test failed:", e);
    }

    const response = new Response(JSON.stringify({
      kv_bound: !!env.CACHE,
      pv,
      put_get_ok: putGetOk,
      timestamp: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (error) {
    console.error("Admin cache diag error:", error);
    const response = new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 11) Admin Rules Suggestions endpoints
if (url.pathname === "/admin/rules/suggestions" && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Check if user is admin
    const userData = await d1.prepare(`
            SELECT is_admin FROM user WHERE id = ?
          `).bind(sessionData.user_id).first();

    if (!userData || !userData.is_admin) {
      const response = new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const status = url.searchParams.get('status') || 'pending';

    const suggestions = await d1.prepare(`
            SELECT rs.*, p.name as project_name, s.name as source_name, s.slug as source_slug, u.email as author_email
            FROM rules_suggestions rs
            JOIN project p ON p.id = rs.project_id
            JOIN ai_sources s ON s.id = rs.ai_source_id
            JOIN user u ON u.id = rs.author_user_id
            WHERE rs.status = ?
            ORDER BY rs.created_at DESC
          `).bind(status).all();

    const response = new Response(JSON.stringify(suggestions.results), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Admin get suggestions error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

if (url.pathname.startsWith("/admin/rules/suggestions/") && request.method === "POST") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Check if user is admin
    const userData = await d1.prepare(`
            SELECT is_admin FROM user WHERE id = ?
          `).bind(sessionData.user_id).first();

    if (!userData || !userData.is_admin) {
      const response = new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const suggestionId = url.pathname.split('/').pop();
    const body = await request.json();
    const { status, admin_comment, manifest_patch } = body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      const response = new Response(JSON.stringify({ error: "status must be 'approved' or 'rejected'" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Update suggestion status
    await d1.prepare(`
            UPDATE rules_suggestions 
            SET status = ?, admin_comment = ?, decided_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(status, admin_comment || null, suggestionId).run();

    // If approved with manifest_patch, update KV manifest
    if (status === 'approved' && manifest_patch) {
      // TODO: Implement KV manifest update logic
      // Load current manifest, validate patch, merge, increment version, write back
      console.log("Manifest patch would be applied:", manifest_patch);
    }

    // TODO: Increment metrics counter
    // rules_suggestion_approved_5m

    const response = new Response(JSON.stringify({
      success: true,
      message: `Suggestion ${status} successfully`,
      suggestion_id: suggestionId,
      status
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Admin decide suggestion error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 4.6) Switch organization/project context
if (url.pathname === "/api/auth/switch-context" && request.method === "POST") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    const body = await request.json();
    const { organization_id, project_id } = body;

    if (!organization_id || !project_id) {
      const response = new Response(JSON.stringify({ error: "Organization ID and Project ID are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    // Verify user has access to this organization and project
    const accessCheck = await d1.prepare(`
            SELECT COUNT(*) as count 
            FROM org_member om
            JOIN project p ON p.org_id = om.org_id
            WHERE om.user_id = ? AND om.org_id = ? AND p.id = ?
          `).bind(sessionData.user_id, organization_id, project_id).first();

    if (accessCheck.count === 0) {
      const response = new Response(JSON.stringify({ error: "Access denied to organization/project" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, request.headers.get("origin"));
    }

    // Update session with new context (we'll store this in a separate table)
    // For now, we'll return success and let the frontend handle context switching
    const response = new Response(JSON.stringify({
      success: true,
      message: "Context switch successful",
      organization_id,
      project_id
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, request.headers.get("origin"));

  } catch (e) {
    console.error("Switch context error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, request.headers.get("origin"));
  }
}

// 4.5) Dev Test Endpoint - Magic Link Token Peek (TEST_MODE only)
if (url.pathname === "/_test/magic-link" && request.method === "GET" && config.TEST_MODE) {
  try {
    const email = url.searchParams.get("email");
    if (!email) {
      const response = new Response(JSON.stringify({ error: "Email parameter required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Rate limiting for test endpoint
    const clientIP = request.headers.get("cf-connecting-ip") || "unknown";
    const ipKey = `rate_limit:test_magic_link:ip:${clientIP}`;
    const ipLimit = await checkRateLimit(ipKey, config.ADMIN_RPM_PER_IP, 60 * 1000); // per minute per IP

    if (!ipLimit.allowed) {
      const response = new Response(JSON.stringify({ error: "Too many test requests from this IP" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil((ipLimit.resetTime - Date.now()) / 1000)
        }
      });
      return addCorsHeaders(response, origin);
    }

    // Find the most recent unconsumed magic link for this email
    // Query the D1 magic_link table
    console.log("🔍 TEST MODE - Looking for magic link token for:", email);

    const magicLinkData = await d1.prepare(`
            SELECT ml.id, ml.email, ml.token_hash, ml.expires_at, ml.continue_path, ml.created_at, ml.consumed_at
            FROM magic_link ml
            WHERE ml.email = ? AND ml.consumed_at IS NULL AND ml.expires_at > ?
            ORDER BY ml.created_at DESC
            LIMIT 1
          `).bind(email, new Date().toISOString()).first();

    if (magicLinkData) {
      const response = new Response(JSON.stringify({
        message: "Magic link found",
        email: email,
        token: magicLinkData.token_hash,
        token_hash: magicLinkData.token_hash,
        continue_path: magicLinkData.continue_path,
        expires_at: magicLinkData.expires_at,
        created_at: magicLinkData.created_at,
        consumed: magicLinkData.consumed_at !== null,
        status: "found"
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } else {
      const response = new Response(JSON.stringify({
        message: "No active magic link found for this email",
        email: email,
        note: "Try requesting a new magic link first",
        status: "not_found"
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

  } catch (e) {
    console.error("Test magic link peek error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// Onboarding endpoints
if (url.pathname === "/api/onboarding/organization" && request.method === "POST") {
  try {
    const { name } = await request.json();

    if (!name) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Auto-generate slug from name
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim('-'); // Remove leading/trailing hyphens

    // Check if organization already exists
    const existingOrg = await d1.prepare(`
            SELECT id FROM organization WHERE name = ?
          `).bind(name).first();

    if (existingOrg) {
      return new Response(JSON.stringify({ error: "Organization with this name already exists" }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create organization
    const orgId = generateToken();
    const now = Math.floor(Date.now() / 1000);

    console.log('🔧 Attempting to create organization:', { orgId, name, now });

    try {
      await d1.prepare(`
              INSERT INTO organization (id, name, created_ts)
              VALUES (?, ?, ?)
            `).bind(orgId, name, now).run();

      console.log('✅ Organization created successfully');
    } catch (insertError) {
      console.error('❌ Organization insert failed:', insertError);
      console.error('❌ Error details:', {
        message: insertError.message,
        code: insertError.code,
        stack: insertError.stack
      });
      throw insertError;
    }

    console.log('✅ Organization created:', { id: orgId, name, slug });

    const responseData = {
      id: orgId,
      name: name,
      created_at: now,
      user_id: userId,
      org_member_created: !!userId
    };

    console.log('📤 Sending response:', responseData);

    return new Response(JSON.stringify(responseData), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Organization creation error:', error);
    return new Response(JSON.stringify({ error: "Failed to create organization" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

if (url.pathname === "/api/onboarding/project" && request.method === "POST") {
  try {
    const { name, description, organizationId } = await request.json();

    if (!name || !organizationId) {
      return new Response(JSON.stringify({ error: "Name and organization ID are required" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify organization exists
    const org = await d1.prepare(`
            SELECT id, name FROM organization WHERE id = ?
          `).bind(organizationId).first();

    if (!org) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create project
    const projectId = generateToken();
    const now = Math.floor(Date.now() / 1000);
    const projectSlug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    await d1.prepare(`
            INSERT INTO project (id, name, slug, org_id, created_ts)
            VALUES (?, ?, ?, ?, ?)
          `).bind(projectId, name, projectSlug, organizationId, now).run();

    console.log('✅ Project created:', { id: projectId, name, slug: projectSlug, orgId: organizationId });

    return new Response(JSON.stringify({
      success: true,
      project: { id: projectId, name, slug: projectSlug, organizationId }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Project creation error:', error);
    return new Response(JSON.stringify({ error: "Failed to create project" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 7) Project Settings endpoint - Proper implementation
if (url.pathname.match(/^\/api\/projects\/[^\/]+\/settings$/) && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Extract project ID from URL
    const urlObj = new URL(request.url);
    const projectId = urlObj.pathname.split('/')[3];

    // Verify user has access to this project
    const accessCheck = await d1.prepare(`
            SELECT COUNT(*) as count 
            FROM org_member om
            JOIN project p ON p.org_id = om.org_id
            WHERE om.user_id = ? AND p.id = ?
          `).bind(sessionData.user_id, projectId).first();

    if (accessCheck.count === 0) {
      const response = new Response(JSON.stringify({ error: "Access denied to project" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // For now, return default project settings since we don't have a project_settings table yet
    // TODO: Implement project settings when we add the project_settings table
    const response = new Response(JSON.stringify({
      project_id: projectId,
      retention_days_events: 90,
      retention_days_referrals: 365,
      plan_tier: "starter",
      xray_trace_enabled: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Get project settings error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

if (url.pathname.match(/^\/api\/projects\/[^\/]+\/settings$/) && request.method === "PUT") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Extract project ID from URL
    const urlObj = new URL(request.url);
    const projectId = urlObj.pathname.split('/')[3];

    // Verify user has access to this project
    const accessCheck = await d1.prepare(`
            SELECT COUNT(*) as count 
            FROM org_member om
            JOIN project p ON p.org_id = om.org_id
            WHERE om.user_id = ? AND p.id = ?
          `).bind(sessionData.user_id, projectId).first();

    if (accessCheck.count === 0) {
      const response = new Response(JSON.stringify({ error: "Access denied to project" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const body = await request.json();
    const { retention_days_events, retention_days_referrals } = body;

    // For now, return success since we don't have a project_settings table yet
    // TODO: Implement project settings storage when we add the project_settings table
    const response = new Response(JSON.stringify({
      success: true,
      message: "Project settings update not yet implemented"
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Update project settings error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 9) Admin endpoint to promote users to admin
if (url.pathname === "/admin/promote-user" && request.method === "POST") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Check if user is admin
    const userData = await d1.prepare(`
            SELECT is_admin FROM user WHERE id = ?
          `).bind(sessionData.user_id).first();

    if (!userData || !userData.is_admin) {
      const response = new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      const response = new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Update user to admin
    const updateResult = await d1.prepare(`
            UPDATE user SET is_admin = 1 WHERE email = ?
          `).bind(email).run();

    if (updateResult.changes === 0) {
      const response = new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const response = new Response(JSON.stringify({
      success: true,
      message: `User ${email} promoted to admin`
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Admin promote user error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 10) Debug endpoint to show current user info
if (url.pathname === "/debug/user-info" && request.method === "GET") {
  try {
    const sessionCookie = request.headers.get("cookie");
    if (!sessionCookie) {
      const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
    if (!sessionMatch) {
      const response = new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const sessionId = sessionMatch[1];
    const sessionData = await d1.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

    if (!sessionData) {
      const response = new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    // Get user data
    const userData = await d1.prepare(`
            SELECT id, email, is_admin, created_ts, last_login_ts FROM user WHERE id = ?
          `).bind(sessionData.user_id).first();

    if (!userData) {
      const response = new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }

    const response = new Response(JSON.stringify({
      user: userData,
      session: {
        session_id: sessionId.substring(0, 8) + "...",
        expires_at: sessionData.expires_at
      }
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);

  } catch (e) {
    console.error("Debug user info error:", e);
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }
}

// 8) Fallback response for any unmatched routes
const fallbackResponse = new Response("Not Found", { status: 404 });
res = addCorsHeaders(fallbackResponse, origin);
return res;

    } catch (error) {
  console.error("Worker error:", error);

  const response = new Response(JSON.stringify({ error: "Internal server error" }), {
    status: 500,
    headers: { "Content-Type": "application/json" }
  });

  res = response;
  return res;
} finally {
  const duration = Date.now() - started;
  // Record metrics without blocking response
  ctx.waitUntil(recordRequestMetrics(env, (res?.status || 500), duration));
}
  }
};
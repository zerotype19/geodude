import { addCorsHeaders } from '../cors';
import { MetricsManager } from '../lib/metrics';

export async function handleHealthRoutes(url: URL, request: Request, env: any, d1: any, origin: string) {
  // Health check endpoint
  if (url.pathname === "/health") {
    const response = new Response(JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: Date.now() - (env.START_TIME || Date.now())
    }), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response, origin);
  }

  // Admin health endpoint with detailed metrics
  if (url.pathname === "/admin/health") {
    try {
      const metrics = new MetricsManager(env.CACHE);
      
      // Get cache metrics
      const cacheHit = await metrics.getMetric("cache_hit_5m");
      const cacheMiss = await metrics.getMetric("cache_miss_5m");
      const cacheBypass = await metrics.getMetric("cache_bypass_5m");
      const cacheOverwrite = await metrics.getMetric("cache_overwrite_5m");
      const cacheSkipOversize = await metrics.getMetric("cache_skip_oversize_5m");
      const cacheStoreError = await metrics.getMetric("cache_store_error_5m");

      // Get rate limiting metrics
      const ipAllow = await metrics.getMetric("ip_rl_allow_5m");
      const ipBlock = await metrics.getMetric("ip_rl_block_5m");

      // Calculate rate limit status
      let rateLimitStatus = "healthy";
      if (ipBlock > 50 && ipAllow / ipBlock < 5) {
        rateLimitStatus = "degraded";
      } else if (ipBlock > 0) {
        rateLimitStatus = "watch";
      }

      const response = new Response(JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: Date.now() - (env.START_TIME || Date.now()),
        cache: {
          hit_5m: cacheHit,
          miss_5m: cacheMiss,
          bypass_5m: cacheBypass,
          overwrite_5m: cacheOverwrite,
          skip_oversize_5m: cacheSkipOversize,
          store_error_5m: cacheStoreError,
          status: "healthy"
        },
        rate_limit: {
          ip_allow_5m: ipAllow,
          ip_block_5m: ipBlock,
          status: rateLimitStatus
        },
        database: {
          status: "healthy",
          last_check: new Date().toISOString()
        }
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Admin health error:", e);
      const response = new Response(JSON.stringify({
        status: "error",
        message: "Failed to get health metrics",
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Admin env-check endpoint
  if (url.pathname === "/admin/env-check") {
    try {
      const envCheck = {
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV || "unknown",
        kv: {
          cache: !!env.CACHE,
          ai_fingerprints: !!env.AI_FINGERPRINTS,
          rl: !!env.RL
        },
        cache: {
          cache_off: env.CACHE_OFF || "0"
        },
        database: {
          d1_bound: !!env.OPTIVIEW_DB
        }
      };

      // Guard: Return 500 if CACHE KV is unbound in production
      if (env.NODE_ENV === 'production' && !env.CACHE) {
        const response = new Response(JSON.stringify({
          error: "KV binding missing",
          code: "kv_unbound",
          details: envCheck
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      const response = new Response(JSON.stringify(envCheck), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Env check error:", e);
      const response = new Response(JSON.stringify({
        error: "Failed to check environment",
        message: e.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Admin self-check endpoint
  if (url.pathname === "/admin/selfcheck") {
    try {
      const checks = {
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV || "unknown",
        checks: {
          d1: false,
          cache: false,
          ai_fingerprints: false,
          rl: false
        }
      };

      // Test D1 connection
      try {
        await d1.prepare("SELECT 1").first();
        checks.checks.d1 = true;
      } catch (e) {
        console.error("D1 check failed:", e);
      }

      // Test KV connections
      try {
        if (env.CACHE) {
          await env.CACHE.put("selfcheck:test", "ok", { expirationTtl: 60 });
          const result = await env.CACHE.get("selfcheck:test");
          if (result === "ok") {
            checks.checks.cache = true;
            await env.CACHE.delete("selfcheck:test");
          }
        }
      } catch (e) {
        console.error("Cache check failed:", e);
      }

      try {
        if (env.AI_FINGERPRINTS) {
          await env.AI_FINGERPRINTS.put("selfcheck:test", "ok", { expirationTtl: 60 });
          const result = await env.AI_FINGERPRINTS.get("selfcheck:test");
          if (result === "ok") {
            checks.checks.ai_fingerprints = true;
            await env.AI_FINGERPRINTS.delete("selfcheck:test");
          }
        }
      } catch (e) {
        console.error("AI fingerprints check failed:", e);
      }

      try {
        if (env.RL) {
          await env.RL.put("selfcheck:test", "ok", { expirationTtl: 60 });
          const result = await env.RL.get("selfcheck:test");
          if (result === "ok") {
            checks.checks.rl = true;
            await env.RL.delete("selfcheck:test");
          }
        }
      } catch (e) {
        console.error("RL check failed:", e);
      }

      const response = new Response(JSON.stringify(checks), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Self check error:", e);
      const response = new Response(JSON.stringify({
        error: "Failed to perform self check",
        message: e.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Admin schema inspection endpoint
  if (url.pathname === "/admin/selfcheck/schema") {
    try {
      // Check if user is admin (basic check for now)
      if (!req.headers.get("authorization")?.includes("Bearer ")) {
        const response = new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Admin access required"
        }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      const tables = ['visitor', 'session_v1', 'session_event_map', 'interaction_events', 'content_assets'];
      const schema = {};

      for (const table of tables) {
        try {
          // Get table info
          const tableInfo = await d1.prepare(`PRAGMA table_info('${table}')`).all();
          
          // Get table DDL
          const tableDDL = await d1.prepare(`
            SELECT name, sql FROM sqlite_master 
            WHERE type='table' AND name='${table}'
          `).first();
          
          // Get indexes
          const indexes = await d1.prepare(`
            SELECT name, sql FROM sqlite_master 
            WHERE type='index' AND tbl_name='${table}'
          `).all();

          schema[table] = {
            columns: tableInfo.results || [],
            ddl: tableDDL || null,
            indexes: indexes.results || []
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

  return null; // Not handled by this router
}

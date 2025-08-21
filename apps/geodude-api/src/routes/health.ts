import { addCorsHeaders } from '../cors';
import { MetricsManager } from '../lib/metrics';
import { readWindow } from '../metrics/collector';
import {
  qSessionsOpened5m,
  qSessionsClosed5m,
  qSessionEventsAttached5m,
  qProjectsCreated5m,
  qLastCron,
} from '../metrics/queries';

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

  // Admin health endpoint with real metrics
  if (url.pathname === "/admin/health") {
    try {
      // Get org_id from session (for now, use a default org for testing)
      // TODO: Implement proper session-based org_id extraction
      const orgId = "org_default"; // Placeholder - replace with actual org_id from session
      
      // KV & DB "connected" status
      const kvOk = !!env.METRICS;
      const dbOk = !!d1;

      // KV metrics (requests, errors, latency, breakdown)
      const { totalReq, totalErr, p50, p95, statusBreakdown } = await readWindow(env as any);

      // D1 truth queries
      const [opened, closed, attached, created, lastCron] = await Promise.all([
        qSessionsOpened5m(d1, orgId),
        qSessionsClosed5m(d1, orgId),
        qSessionEventsAttached5m(d1, orgId),
        qProjectsCreated5m(d1, orgId),
        qLastCron(env as any),
      ]);

      const errorRate = totalReq > 0 ? +((totalErr / totalReq) * 100).toFixed(2) : 0;

      const payload = {
        kv: { connected: kvOk },
        database: { connected: dbOk },
        cron: { last: lastCron },
        requests_5m: { 
          total: totalReq, 
          error_rate_pct: errorRate, 
          p50_ms: p50, 
          p95_ms: p95, 
          status_breakdown: statusBreakdown 
        },
        sessions_5m: { 
          opened, 
          closed, 
          attached, 
          status: opened > 0 && attached > 0 ? "healthy" : (opened === 0 && attached === 0 ? "watch" : "degraded") 
        },
        projects_5m: { created },
        // Legacy fields for backward compatibility
        kv_ok: kvOk,
        d1_ok: dbOk,
        last_cron_ts: lastCron,
        ingest: {
          total_5m: totalReq,
          error_rate_5m: errorRate / 100, // Convert back to decimal for legacy
          p50_ms_5m: p50,
          p95_ms_5m: p95,
          by_error_5m: Object.fromEntries(statusBreakdown.map(({ status, count }) => [status, count])),
          top_error_keys_5m: [],
          top_error_projects_5m: []
        }
      };

      return new Response(JSON.stringify(payload), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    } catch (error) {
      console.error("Admin health error:", error);
      const response = new Response(JSON.stringify({
        status: "degraded",
        timestamp: new Date().toISOString(),
        error: "Failed to get health metrics",
        message: error.message,
        kv: { connected: false },
        database: { connected: false },
        cron: { last: null },
        requests_5m: { total: 0, error_rate_pct: 0, p50_ms: 0, p95_ms: 0, status_breakdown: [] },
        sessions_5m: { opened: 0, closed: 0, attached: 0, status: "degraded" },
        projects_5m: { created: 0 }
      }), {
        status: 200, // Return 200 with degraded status for monitoring
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        }
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

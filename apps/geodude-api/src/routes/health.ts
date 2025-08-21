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

      // AI-Lite: Get rollup-based metrics for last 5 minutes
      let aiLiteMetrics = null;
      try {
        const { getLast5MinuteRollups } = await import('../ai-lite/rollups');

        // Get metrics for the actual project (prj_UHoetismrowc)
        const projectId = "prj_UHoetismrowc";

        const rollupMetrics = await getLast5MinuteRollups(d1, projectId);

        aiLiteMetrics = {
          ai_events_5m: rollupMetrics['human_via_ai'] || 0,
          ai_crawls_5m: rollupMetrics['ai_agent_crawl'] || 0,
          citations_5m: rollupMetrics['citation'] || 0,
          baseline_sampled_rows_5m: (rollupMetrics['direct_human'] || 0) + (rollupMetrics['search'] || 0),
          sample_pct: parseInt(env.AI_LITE_SAMPLE_PCT || '2'),
          tracking_mode: env.ENFORCE_AI_LITE === 'true' ? 'ai-lite (enforced)' : 'configurable',
          rollups_available: Object.keys(rollupMetrics).length > 0
        };
      } catch (error) {
        console.error('Failed to get AI-Lite metrics:', error);
        aiLiteMetrics = {
          ai_events_5m: 0,
          ai_crawls_5m: 0,
          citations_5m: 0,
          baseline_sampled_rows_5m: 0,
          sample_pct: parseInt(env.AI_LITE_SAMPLE_PCT || '2'),
          tracking_mode: 'unknown',
          rollups_available: false,
          error: error.message
        };
      }

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
        ai_lite: aiLiteMetrics, // AI-Lite specific metrics
        
        // Hardened Classification System Health Tiles
        hardened_classification: await getHardenedClassificationHealth(d1, orgId),
        
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

      const response = new Response(JSON.stringify(payload), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
      return addCorsHeaders(response, origin);
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
        projects_5m: { created: 0 },
        ai_lite: {
          ai_events_5m: 0,
          ai_crawls_5m: 0,
          citations_5m: 0,
          baseline_sampled_rows_5m: 0,
          sample_pct: parseInt(env.AI_LITE_SAMPLE_PCT || '2'),
          tracking_mode: 'unknown',
          rollups_available: false,
          error: 'Health check failed'
        },
        hardened_classification: {
          error: 'Health check failed',
          status: "error"
        }
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

  // Admin rollup debug endpoint
  if (url.pathname === "/admin/rollup/peek") {
    try {
      const projectId = url.searchParams.get('project_id') || 'prj_UHoetismrowc';
      const window = url.searchParams.get('window') || '1h';
      const trafficClass = url.searchParams.get('class') || 'ai_agent_crawl';

      // Get window duration in hours
      const hours = window.endsWith('h') ? parseInt(window.slice(0, -1)) : 1;
      const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Get recent events for this class
      const recentEvents = await d1.prepare(`
        SELECT 
          ie.id,
          ie.event_type,
          ie.occurred_at,
          ie.content_id,
          ie.ai_source_id,
          ai.name as ai_source_name,
          ai.category as ai_source_category
        FROM interaction_events ie
        LEFT JOIN ai_sources ai ON ai.id = ie.ai_source_id
        WHERE ie.project_id = ?
          AND ie.occurred_at >= ?
          AND ai.category = 'crawler'
        ORDER BY ie.occurred_at DESC
        LIMIT 10
      `).bind(projectId, hoursAgo.toISOString()).all();

      // Get rollup data for this window
      const rollupData = await d1.prepare(`
        SELECT 
          ts_hour,
          class,
          events_count,
          sampled_count
        FROM traffic_rollup_hourly
        WHERE project_id = ?
          AND ts_hour >= ?
          AND class = ?
        ORDER BY ts_hour DESC
      `).bind(projectId, Math.floor(hoursAgo.getTime() / 1000 / 3600) * 3600, trafficClass).all();

      // Calculate expected vs actual counts
      const eventCount = recentEvents.results?.length || 0;
      const rollupCount = rollupData.results?.reduce((sum, r) => sum + r.events_count, 0) || 0;

      const response = new Response(JSON.stringify({
        window,
        traffic_class: trafficClass,
        project_id: projectId,
        counts: {
          events_in_db: eventCount,
          rollup_total: rollupCount,
          drift: rollupCount - eventCount
        },
        recent_events: recentEvents.results || [],
        rollup_entries: rollupData.results || [],
        debug_info: {
          hours_ago: hoursAgo.toISOString(),
          ts_hour_threshold: Math.floor(hoursAgo.getTime() / 1000 / 3600) * 3600
        }
      }, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      });

      return addCorsHeaders(response, origin);
    } catch (error) {
      console.error('Rollup debug endpoint error:', error);
      const response = new Response(JSON.stringify({
        error: "Failed to fetch rollup debug data",
        details: error.message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Admin backfill endpoint for crawler rollups
  if (url.pathname === "/admin/rollup/backfill-crawlers") {
    try {
      const projectId = url.searchParams.get('project_id') || 'prj_UHoetismrowc';
      const hours = parseInt(url.searchParams.get('hours') || '6');
      const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Get all crawler events from the last N hours
      const crawlerEvents = await d1.prepare(`
        SELECT 
          ie.project_id,
          ie.property_id,
          ie.occurred_at,
          ie.ai_source_id,
          ai.category
        FROM interaction_events ie
        JOIN ai_sources ai ON ai.id = ie.ai_source_id
        WHERE ie.project_id = ?
          AND ie.occurred_at >= ?
          AND ai.category = 'crawler'
        ORDER BY ie.occurred_at
      `).bind(projectId, hoursAgo.toISOString()).all();

      const events = crawlerEvents.results || [];
      let backfilled = 0;
      let errors = 0;

      // Group events by hour and property
      const hourlyGroups: Record<string, { propertyId: number; count: number }> = {};

      for (const event of events) {
        const eventTime = new Date(event.occurred_at);
        const hourBucket = Math.floor(eventTime.getTime() / 1000 / 3600) * 3600;
        const key = `${hourBucket}-${event.property_id}`;

        if (!hourlyGroups[key]) {
          hourlyGroups[key] = { propertyId: event.property_id, count: 0 };
        }
        hourlyGroups[key].count++;
      }

      // Backfill rollups for each hour/property group
      for (const [key, group] of Object.entries(hourlyGroups)) {
        const [hourBucket, propertyId] = key.split('-');

        try {
          await d1.prepare(`
            INSERT INTO traffic_rollup_hourly 
            (project_id, property_id, ts_hour, class, events_count, sampled_count)
            VALUES (?, ?, ?, 'ai_agent_crawl', ?, 0)
            ON CONFLICT(project_id, property_id, ts_hour, class) 
            DO UPDATE SET events_count = events_count + ?
          `).bind(
            projectId,
            parseInt(propertyId),
            parseInt(hourBucket),
            group.count,
            group.count
          ).run();

          backfilled += group.count;
        } catch (error) {
          console.error('Backfill error for', key, error);
          errors++;
        }
      }

      const response = new Response(JSON.stringify({
        success: true,
        backfill_summary: {
          project_id: projectId,
          hours_processed: hours,
          events_found: events.length,
          events_backfilled: backfilled,
          hour_groups: Object.keys(hourlyGroups).length,
          errors
        },
        hourly_breakdown: Object.entries(hourlyGroups).map(([key, group]) => {
          const [hourBucket, propertyId] = key.split('-');
          return {
            hour_bucket: parseInt(hourBucket),
            property_id: parseInt(propertyId),
            events_count: group.count
          };
        })
      }, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      });

      return addCorsHeaders(response, origin);
    } catch (error) {
      console.error('Backfill endpoint error:', error);
      const response = new Response(JSON.stringify({
        error: "Failed to backfill crawler rollups",
        details: error.message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Admin endpoint to backfill session AI classification
  if (url.pathname === "/admin/backfill-sessions" && request.method === "POST") {
    try {
      // Basic admin check (you may want to enhance this)
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const response = new Response(JSON.stringify({
          error: "Unauthorized - Admin access required"
        }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      const { project_id, limit = "100" } = await request.json();
      if (!project_id) {
        const response = new Response(JSON.stringify({
          error: "Missing project_id parameter"
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Get sessions without proper AI classification
      const sessionsToUpdate = await d1.prepare(`
        SELECT id, started_at, ended_at, events_count
        FROM session_v1 
        WHERE project_id = ? AND (ai_influenced IS NULL OR ai_influenced = 0)
        ORDER BY started_at DESC LIMIT ?
      `).bind(project_id, parseInt(limit)).all<any>();

      let updated = 0;
      let errors = 0;

      for (const session of sessionsToUpdate.results || []) {
        try {
          // Check if this session has any AI-influenced events
          const aiEventsResult = await d1.prepare(`
            SELECT 
              COUNT(*) as ai_count,
              MAX(ai_source_id) as primary_ai_source_id
            FROM interaction_events 
            WHERE project_id = ? 
              AND occurred_at >= ? 
              AND occurred_at <= COALESCE(?, datetime('now'))
              AND class IN ('human_via_ai', 'ai_agent_crawl')
          `).bind(
            project_id,
            session.started_at,
            session.ended_at
          ).first<any>();

          const aiCount = aiEventsResult?.ai_count || 0;
          const primaryAiSourceId = aiEventsResult?.primary_ai_source_id || null;
          const isAIInfluenced = aiCount > 0 ? 1 : 0;

          // Update the session
          await d1.prepare(`
            UPDATE session_v1 
            SET ai_influenced = ?, primary_ai_source_id = ?
            WHERE id = ?
          `).bind(isAIInfluenced, primaryAiSourceId, session.id).run();

          updated++;
        } catch (error) {
          console.error('Error updating session', session.id, error);
          errors++;
        }
      }

      const response = new Response(JSON.stringify({
        success: true,
        backfill_summary: {
          project_id,
          sessions_found: (sessionsToUpdate.results || []).length,
          sessions_updated: updated,
          errors
        }
      }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      });

      return addCorsHeaders(response, origin);
    } catch (error) {
      console.error('Session backfill endpoint error:', error);
      const response = new Response(JSON.stringify({
        error: "Failed to backfill session AI classification",
        details: error.message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  return null; // Not handled by this router
}

/**
 * Get health metrics for the hardened classification system
 */
async function getHardenedClassificationHealth(d1: any, orgId: string) {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get last 24h metrics from rollups
    const last24hRollups = await d1.prepare(`
      SELECT class, SUM(events_count) as total_events
      FROM traffic_rollup_hourly 
      WHERE ts_hour >= ? 
      GROUP BY class
    `).bind(Math.floor(last24h.getTime() / 1000)).all();
    
    // Get previous 24h for comparison
    const prev24h = new Date(last24h.getTime() - 24 * 60 * 60 * 1000);
    const prev24hRollups = await d1.prepare(`
      SELECT class, SUM(events_count) as total_events
      FROM traffic_rollup_hourly 
      WHERE ts_hour >= ? AND ts_hour < ?
      GROUP BY class
    `).bind(Math.floor(prev24h.getTime() / 1000), Math.floor(last24h.getTime() / 1000)).all();
    
    // Get 7-day median for baseline
    const weekRollups = await d1.prepare(`
      SELECT class, AVG(daily_total) as median_daily
      FROM (
        SELECT class, DATE(ts_hour, 'unixepoch') as day, SUM(events_count) as daily_total
        FROM traffic_rollup_hourly 
        WHERE ts_hour >= ? 
        GROUP BY class, DATE(ts_hour, 'unixepoch')
      ) daily_totals
      GROUP BY class
    `).bind(Math.floor(last7d.getTime() / 1000)).all();
    
    // Process current 24h data
    const currentData = new Map();
    (last24hRollups.results || []).forEach(row => {
      currentData.set(row.class, row.total_events);
    });
    
    // Process previous 24h data
    const previousData = new Map();
    (prev24hRollups.results || []).forEach(row => {
      previousData.set(row.class, row.total_events);
    });
    
    // Process 7-day median data
    const medianData = new Map();
    (weekRollups.results || []).forEach(row => {
      medianData.set(row.class, row.median_daily);
    });
    
    // Calculate metrics
    const aiHumanClicks = currentData.get('human_via_ai') || 0;
    const crawlerHits = currentData.get('ai_agent_crawl') || 0;
    const searchClicks = currentData.get('search') || 0;
    const directHuman = currentData.get('direct_human') || 0;
    
    // Calculate trends (vs previous 24h)
    const aiHumanTrend = getTrend(aiHumanClicks, previousData.get('human_via_ai') || 0);
    const crawlerTrend = getTrend(crawlerHits, previousData.get('ai_agent_crawl') || 0);
    
    // Calculate search vs AI split
    const totalHumanTraffic = aiHumanClicks + searchClicks;
    const aiPercentage = totalHumanTraffic > 0 ? Math.round((aiHumanClicks / totalHumanTraffic) * 100) : 0;
    
    // Calculate referrer visibility (placeholder - would need actual referrer data)
    const referrerVisibility = aiHumanClicks > 0 ? 95 : 0; // Placeholder
    
    return {
      last_24h: {
        ai_human_clicks: aiHumanClicks,
        crawler_hits: crawlerHits,
        search_vs_ai_split: `${aiPercentage}% AI-influenced`,
        referrer_visibility: `${referrerVisibility}%`
      },
      trends: {
        ai_human: aiHumanTrend,
        crawlers: crawlerTrend
      },
      baseline: {
        ai_human_median: Math.round(medianData.get('human_via_ai') || 0),
        crawler_median: Math.round(medianData.get('ai_agent_crawl') || 0)
      },
      status: aiHumanClicks > 0 || crawlerHits > 0 ? "healthy" : "no_data"
    };
    
  } catch (error) {
    console.error('Error getting hardened classification health:', error);
    return {
      error: error.message,
      status: "error"
    };
  }
}

/**
 * Calculate trend arrow based on current vs previous values
 */
function getTrend(current: number, previous: number): string {
  if (current === 0 && previous === 0) return "→";
  if (current === 0) return "↓";
  if (previous === 0) return "↑";
  
  const change = ((current - previous) / previous) * 100;
  if (change > 10) return "↑";
  if (change < -10) return "↓";
  return "→";
}

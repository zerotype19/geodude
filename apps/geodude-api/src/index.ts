import { addCorsHeaders } from "./cors";
import { log } from "./logging";
import { getOrSetSession, insertClick } from "./session";
import { ensureUTMs } from "./utm";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const headers = new Headers();
    
    // Add CORS headers to all responses
    const attach = (resp: Response) => {
      // Add any additional headers here if needed
      return resp;
    };

    // 1) Health check
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    // 2) Basic request logging
    log("request_start", {
      rid: crypto.randomUUID(),
      method: req.method,
      path: req.url,
      userAgent: req.headers.get("user-agent")
    });

    // 3) Event ingest: POST /v1/events (direct-to-D1 MVP)
    if (url.pathname === "/v1/events" && req.method === "POST") {
      if (req.headers.get("authorization") !== `Bearer ${env.INGEST_API_KEY}`) {
        const response = new Response("unauthorized", { status: 401 });
        return addCorsHeaders(response);
      }
      const batch = await req.json().catch(() => null);
      if (!Array.isArray(batch)) {
        const response = new Response("expected array", { status: 400 });
        return addCorsHeaders(response);
      }

      let inserted = 0;
      try {
        for (const ev of batch) {
          if (!ev?.type || !ev?.payload) continue;
          switch (ev.type) {
            case "conversion":
              await env.GEO_DB
                .prepare(
                  `INSERT INTO conversion_event (ts, session_id, type, value_cents, meta)
                   VALUES (?1, ?2, ?3, ?4, ?5)`
                )
                .bind(
                  ev.payload.ts ?? Date.now(),
                  ev.payload.session_id ?? null,
                  ev.payload.type ?? "custom",
                  ev.payload.value_cents ?? null,
                  ev.payload.meta ? JSON.stringify(ev.payload.meta) : null
                )
                .run();
              inserted++;
              break;
            case "crawler":
              await env.GEO_DB
                .prepare(
                  `INSERT INTO crawler_visit (ts, ua, ip, asn, family, hit_type, path, status)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
                )
                .bind(
                  ev.payload.ts ?? Date.now(),
                  ev.payload.ua ?? null,
                  ev.payload.ip ?? null,
                  ev.payload.asn ?? null,
                  ev.payload.family ?? null,
                  ev.payload.hit_type ?? null,
                  ev.payload.path ?? null,
                  ev.payload.status ?? null
                )
                .run();
              inserted++;
              break;
            default:
              // Unknown event type, skip
              break;
          }
        }
        const response = new Response(JSON.stringify({ inserted }), {
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
      } catch (e: any) {
        log("event_ingest_error", { error: e.message, stack: e.stack });
        const response = new Response(`ingest error: ${e?.message ?? ""}`, { status: 500 });
        return addCorsHeaders(response);
      }
    }

    // 4) Metrics endpoints
    if (url.pathname.startsWith("/metrics/")) {
      const sid = getOrSetSession(req, headers);
      if (!sid) {
        const response = new Response("unauthorized", { status: 401 });
        return attach(addCorsHeaders(response));
      }

      // Get user's current context
      const sessionData = await env.GEO_DB.prepare(
        "SELECT current_org_id, current_project_id FROM session WHERE id = ? LIMIT 1"
      ).bind(sid).first<any>();

      if (!sessionData?.current_org_id || !sessionData?.current_project_id) {
        const response = new Response("no project context", { status: 400 });
        return attach(addCorsHeaders(response));
      }

      const { current_org_id, current_project_id } = sessionData;

      // 4.1) GET /metrics/clicks_by_src
      if (url.pathname === "/metrics/clicks_by_src") {
        try {
          const { from, to } = Object.fromEntries(url.searchParams);
          const rows = await env.GEO_DB.prepare(`
            SELECT src, COUNT(*) as cnt
            FROM click
            WHERE org_id = ? AND project_id = ? AND ts BETWEEN ? AND ?
            GROUP BY src
            ORDER BY cnt DESC
          `).bind(current_org_id, current_project_id, from, to).all<any>();
          
          const response = new Response(JSON.stringify({ rows: rows.results || [] }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("metrics_clicks_by_src_error", { error: e.message, stack: e.stack });
          const response = new Response(`metrics error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }

      // 4.2) GET /metrics/top_pids
      if (url.pathname === "/metrics/top_pids") {
        try {
          const { from, to, limit = "10" } = Object.fromEntries(url.searchParams);
          const rows = await env.GEO_DB.prepare(`
            SELECT pid, COUNT(*) as cnt
            FROM click
            WHERE org_id = ? AND project_id = ? AND ts BETWEEN ? AND ?
            GROUP BY pid
            ORDER BY cnt DESC
            LIMIT ?
          `).bind(current_org_id, current_project_id, from, to, parseInt(limit)).all<any>();
          
          const response = new Response(JSON.stringify({ rows: rows.results || [] }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("metrics_top_pids_error", { error: e.message, stack: e.stack });
          const response = new Response(`metrics error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }

      // 4.3) GET /metrics/clicks_timeseries
      if (url.pathname === "/metrics/clicks_timeseries") {
        try {
          const { from, to } = Object.fromEntries(url.searchParams);
          const rows = await env.GEO_DB.prepare(`
            SELECT 
              CAST(ts / 86400000) * 86400000 as ts,
              COUNT(*) as cnt
            FROM click
            WHERE org_id = ? AND project_id = ? AND ts BETWEEN ? AND ?
            GROUP BY CAST(ts / 86400000)
            ORDER BY ts
          `).bind(current_org_id, current_project_id, from, to).all<any>();
          
          const response = new Response(JSON.stringify({ rows: rows.results || [] }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("metrics_clicks_timeseries_error", { error: e.message, stack: e.stack });
          const response = new Response(`metrics error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }

      // 4.4) GET /metrics/overview
      if (url.pathname === "/metrics/overview") {
        try {
          const { from, to } = Object.fromEntries(url.searchParams);
          
          // Get clicks count
          const clicksResult = await env.GEO_DB.prepare(`
            SELECT COUNT(*) as cnt
            FROM click
            WHERE org_id = ? AND project_id = ? AND ts BETWEEN ? AND ?
          `).bind(current_org_id, current_project_id, from, to).first<any>();
          
          // Get conversions count
          const conversionsResult = await env.GEO_DB.prepare(`
            SELECT COUNT(*) as cnt
            FROM conversion_event
            WHERE org_id = ? AND project_id = ? AND ts BETWEEN ? AND ?
          `).bind(current_org_id, current_project_id, from, to).first<any>();
          
          // Get crawler visits count
          const crawlerResult = await env.GEO_DB.prepare(`
            SELECT COUNT(*) as cnt
            FROM crawler_visit
            WHERE org_id = ? AND project_id = ? AND ts BETWEEN ? AND ?
          `).bind(current_org_id, current_project_id, from, to).first<any>();
          
          // Get citations count
          const citationsResult = await env.GEO_DB.prepare(`
            SELECT COUNT(*) as cnt
            FROM citation
            WHERE org_id = ? AND project_id = ? AND ts BETWEEN ? AND ?
          `).bind(current_org_id, current_project_id, from, to).first<any>();
          
          const overview = {
            clicks: clicksResult?.cnt || 0,
            conversions: conversionsResult?.cnt || 0,
            crawler_visits: crawlerResult?.cnt || 0,
            citations: citationsResult?.cnt || 0
          };
          
          const response = new Response(JSON.stringify(overview), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("metrics_overview_error", { error: e.message, stack: e.stack });
          const response = new Response(`metrics error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }
    }

    // 5) Citations endpoints
    if (url.pathname.startsWith("/citations/")) {
      const sid = getOrSetSession(req, headers);
      if (!sid) {
        const response = new Response("unauthorized", { status: 401 });
        return attach(addCorsHeaders(response));
      }

      // Get user's current context
      const sessionData = await env.GEO_DB.prepare(
        "SELECT current_org_id, current_project_id FROM session WHERE id = ? LIMIT 1"
      ).bind(sid).first<any>();

      if (!sessionData?.current_org_id || !sessionData?.current_project_id) {
        const response = new Response("no project context", { status: 400 });
        return attach(addCorsHeaders(response));
      }

      const { current_org_id, current_project_id } = sessionData;

      // 5.1) GET /citations/recent
      if (url.pathname === "/citations/recent") {
        try {
          const { limit = "100" } = Object.fromEntries(url.searchParams);
          const rows = await env.GEO_DB.prepare(`
            SELECT id, ts, surface, query, url, rank, confidence, model_variant, persona
            FROM citation
            WHERE org_id = ? AND project_id = ?
            ORDER BY ts DESC
            LIMIT ?
          `).bind(current_org_id, current_project_id, parseInt(limit)).all<any>();
          
          const response = new Response(JSON.stringify({ items: rows.results || [] }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("citations_recent_error", { error: e.message, stack: e.stack });
          const response = new Response(`citations error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }
    }

    // 6) Session management endpoints
    if (url.pathname === "/session/current") {
      const sid = getOrSetSession(req, headers);
      if (!sid) {
        const response = new Response("unauthorized", { status: 401 });
        return attach(addCorsHeaders(response));
      }

      try {
        // Get session data with user and org info
        const sessionData = await env.GEO_DB.prepare(`
          SELECT 
            s.id as session_id,
            s.user_id,
            s.current_org_id,
            s.current_project_id,
            u.email,
            u.name as user_name,
            o.name as org_name,
            p.name as project_name,
            p.slug as project_slug,
            p.domain as project_domain
          FROM session s
          LEFT JOIN user u ON s.user_id = u.id
          LEFT JOIN org o ON s.current_org_id = o.id
          LEFT JOIN project p ON s.current_project_id = p.id
          WHERE s.id = ?
        `).bind(sid).first<any>();

        if (!sessionData) {
          const response = new Response("session not found", { status: 404 });
          return attach(addCorsHeaders(response));
        }

        const response = new Response(JSON.stringify({
          user: {
            id: sessionData.user_id,
            email: sessionData.user_name,
            name: sessionData.user_name
          },
          current: {
            org_id: sessionData.current_org_id,
            org_name: sessionData.org_name,
            project_id: sessionData.current_project_id,
            project_name: sessionData.project_name,
            project_slug: sessionData.project_slug,
            project_domain: sessionData.project_domain
          }
        }), {
          headers: { 
            "Content-Type": "application/json",
            ...Object.fromEntries(headers.entries())
          }
        });
        return attach(addCorsHeaders(response));
      } catch (e: any) {
        log("session_current_error", { error: e.message, stack: e.stack });
        const response = new Response(`session error: ${e?.message ?? ""}`, { status: 500 });
        return attach(addCorsHeaders(response));
      }
    }

    // 7) Auth endpoints
    if (url.pathname === "/auth/login") {
      if (req.method !== "POST") {
        const response = new Response("method not allowed", { status: 405 });
        return addCorsHeaders(response);
      }

      try {
        const { email, password } = await req.json();
        if (!email || !password) {
          const response = new Response("missing email or password", { status: 400 });
          return addCorsHeaders(response);
        }

        // Simple email validation (you can enhance this)
        const user = await env.GEO_DB.prepare(
          "SELECT id, email, name FROM user WHERE email = ? LIMIT 1"
        ).bind(email).first<any>();

        if (!user) {
          const response = new Response("invalid credentials", { status: 401 });
          return addCorsHeaders(response);
        }

        // For now, accept any password (you should implement proper auth)
        const sid = crypto.randomUUID();
        
        // Create session
        await env.GEO_DB.prepare(`
          INSERT INTO session (id, user_id, created_ts)
          VALUES (?, ?, ?)
        `).bind(sid, user.id, Date.now()).run();

        // Set session cookie
        headers.append("Set-Cookie", `geodude_ses=${sid}; Path=/; Max-Age=${14 * 86400}; SameSite=Lax`);

        const response = new Response(JSON.stringify({ 
          user: { id: user.id, email: user.email, name: user.name }
        }), {
          headers: { 
            "Content-Type": "application/json",
            ...Object.fromEntries(headers.entries())
          }
        });
        return addCorsHeaders(response);
      } catch (e: any) {
        log("auth_login_error", { error: e.message, stack: e.stack });
        const response = new Response(`login error: ${e?.message ?? ""}`, { status: 500 });
        return addCorsHeaders(response);
      }
    }

    // 8) Onboarding endpoints
    if (url.pathname === "/onboard") {
      if (req.method !== "POST") {
        const response = new Response("method not allowed", { status: 405 });
        return addCorsHeaders(response);
      }

      const sid = getOrSetSession(req, headers);
      if (!sid) {
        const response = new Response("unauthorized", { status: 401 });
        return attach(addCorsHeaders(response));
      }

      try {
        const { org_name, project_name, project_slug } = await req.json();
        if (!org_name || !project_name || !project_slug) {
          const response = new Response("missing required fields", { status: 400 });
          return attach(addCorsHeaders(response));
        }

        // Get user from session
        const userData = await env.GEO_DB.prepare(
          "SELECT user_id FROM session WHERE id = ? LIMIT 1"
        ).bind(sid).first<any>();

        if (!userData) {
          const response = new Response("session not found", { status: 404 });
          return attach(addCorsHeaders(response));
        }

        // Create org
        const org_id = crypto.randomUUID();
        await env.GEO_DB.prepare(`
          INSERT INTO org (id, name, created_ts)
          VALUES (?, ?, ?)
        `).bind(org_id, org_name, Date.now()).run();

        // Add user to org
        await env.GEO_DB.prepare(`
          INSERT INTO org_member (org_id, user_id, role, created_ts)
          VALUES (?, ?, ?, ?)
        `).bind(org_id, userData.user_id, "owner", Date.now()).run();

        // Create project
        const project_id = crypto.randomUUID();
        await env.GEO_DB.prepare(`
          INSERT INTO project (id, org_id, name, slug, created_ts)
          VALUES (?, ?, ?, ?, ?)
        `).bind(project_id, org_id, project_name, project_slug, Date.now()).run();

        // Update session with current org/project
        await env.GEO_DB.prepare(`
          UPDATE session 
          SET current_org_id = ?, current_project_id = ?
          WHERE id = ?
        `).bind(org_id, project_id, sid).run();

        const response = new Response(JSON.stringify({ 
          org_id, project_id, org_name, project_name, project_slug
        }), {
          headers: { "Content-Type": "application/json" }
        });
        return attach(addCorsHeaders(response));
      } catch (e: any) {
        log("onboard_error", { error: e.message, stack: e.stack });
        const response = new Response(`onboard error: ${e?.message ?? ""}`, { status: 500 });
        return attach(addCorsHeaders(response));
      }
    }

    // 9) Organization/Project switching
    if (url.pathname === "/switch") {
      if (req.method !== "POST") {
        const response = new Response("method not allowed", { status: 405 });
        return addCorsHeaders(response);
      }

      const sid = getOrSetSession(req, headers);
      if (!sid) {
        const response = new Response("unauthorized", { status: 401 });
        return attach(addCorsHeaders(response));
      }

      try {
        const { org_id, project_id } = await req.json();
        if (!org_id || !project_id) {
          const response = new Response("missing org_id or project_id", { status: 400 });
          return attach(addCorsHeaders(response));
        }

        // Verify user has access to this org/project
        const accessCheck = await env.GEO_DB.prepare(`
          SELECT 1 FROM org_member om
          JOIN project p ON p.org_id = om.org_id
          WHERE om.user_id = (SELECT user_id FROM session WHERE id = ?)
          AND om.org_id = ? AND p.id = ?
        `).bind(sid, org_id, project_id).first<any>();

        if (!accessCheck) {
          const response = new Response("access denied", { status: 403 });
          return attach(addCorsHeaders(response));
        }

        // Update session
        await env.GEO_DB.prepare(`
          UPDATE session 
          SET current_org_id = ?, current_project_id = ?
          WHERE id = ?
        `).bind(org_id, project_id, sid).run();

        const response = new Response("switched", { status: 200 });
        return attach(addCorsHeaders(response));
      } catch (e: any) {
        log("switch_error", { error: e.message, stack: e.stack });
        const response = new Response(`switch error: ${e?.message ?? ""}`, { status: 500 });
        return attach(addCorsHeaders(response));
      }
    }

    // 10) User's organizations and projects
    if (url.pathname === "/user/contexts") {
      const sid = getOrSetSession(req, headers);
      if (!sid) {
        const response = new Response("unauthorized", { status: 401 });
        return attach(addCorsHeaders(response));
      }

      try {
        // Get user's orgs and projects
        const contexts = await env.GEO_DB.prepare(`
          SELECT 
            o.id as org_id,
            o.name as org_name,
            p.id as project_id,
            p.name as project_name,
            p.slug as project_slug
          FROM org_member om
          JOIN org o ON om.org_id = o.id
          JOIN project p ON p.org_id = o.id
          WHERE om.user_id = (SELECT user_id FROM session WHERE id = ?)
          ORDER BY o.name, p.name
        `).bind(sid).all<any>();

        const response = new Response(JSON.stringify({ 
          contexts: contexts.results || []
        }), {
          headers: { "Content-Type": "application/json" }
        });
        return attach(addCorsHeaders(response));
      } catch (e: any) {
        log("user_contexts_error", { error: e.message, stack: e.stack });
        const response = new Response(`contexts error: ${e?.message ?? ""}`, { status: 500 });
        return attach(addCorsHeaders(response));
      }
    }

    // Default response
    const response = new Response("not found", { status: 404 });
    return addCorsHeaders(response);
  }
};

// Types
type Env = {
  HMAC_KEY: string;
  INGEST_API_KEY: string;
  GEO_DB: D1Database;
  AI_CAPTURES: R2Bucket;
};

import { addCorsHeaders } from "./cors";
import { log } from "./logging";

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

    // 3) AI Sources Management
    if (url.pathname.startsWith("/api/sources")) {
      // GET /api/sources - List AI sources
      if (url.pathname === "/api/sources" && req.method === "GET") {
        try {
          const sources = await env.OPTIVIEW_DB.prepare(`
            SELECT id, name, category, fingerprint, created_at
            FROM ai_sources
            ORDER BY name
          `).all<any>();
          
          const response = new Response(JSON.stringify({ sources: sources.results || [] }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("sources_list_error", { error: e.message, stack: e.stack });
          const response = new Response(`sources error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }

      // POST /api/sources - Create new AI source
      if (url.pathname === "/api/sources" && req.method === "POST") {
        try {
          const { name, category, fingerprint } = await req.json();
          if (!name || !category) {
            const response = new Response("missing name or category", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          const result = await env.OPTIVIEW_DB.prepare(`
            INSERT INTO ai_sources (name, category, fingerprint)
            VALUES (?, ?, ?)
          `).bind(name, category, fingerprint || null).run();

          const response = new Response(JSON.stringify({ 
            id: result.meta.last_row_id,
            name, 
            category, 
            fingerprint 
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("sources_create_error", { error: e.message, stack: e.stack });
          const response = new Response(`create error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }
    }

    // 4) Content Assets Management
    if (url.pathname.startsWith("/api/content")) {
      // GET /api/content - List content assets for a project
      if (url.pathname === "/api/content" && req.method === "GET") {
        try {
          const { project_id } = Object.fromEntries(url.searchParams);
          if (!project_id) {
            const response = new Response("missing project_id", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          const content = await env.OPTIVIEW_DB.prepare(`
            SELECT ca.id, ca.url, ca.type, ca.metadata, ca.created_at,
                   p.domain
            FROM content_assets ca
            JOIN properties p ON ca.property_id = p.id
            WHERE p.project_id = ?
            ORDER BY ca.created_at DESC
          `).bind(project_id).all<any>();
          
          const response = new Response(JSON.stringify({ content: content.results || [] }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("content_list_error", { error: e.message, stack: e.stack });
          const response = new Response(`content error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }

      // POST /api/content - Add new content asset
      if (url.pathname === "/api/content" && req.method === "POST") {
        try {
          const { project_id, domain, url: contentUrl, type, metadata } = await req.json();
          if (!project_id || !domain || !contentUrl) {
            const response = new Response("missing required fields", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          // Get or create property
          let property = await env.OPTIVIEW_DB.prepare(`
            SELECT id FROM properties WHERE project_id = ? AND domain = ?
          `).bind(project_id, domain).first<any>();

          if (!property) {
            const propResult = await env.OPTIVIEW_DB.prepare(`
              INSERT INTO properties (project_id, domain)
              VALUES (?, ?)
            `).bind(project_id, domain).run();
            property = { id: propResult.meta.last_row_id };
          }

          // Add content asset
          const result = await env.OPTIVIEW_DB.prepare(`
            INSERT INTO content_assets (property_id, url, type, metadata)
            VALUES (?, ?, ?, ?)
          `).bind(property.id, contentUrl, type || null, metadata || null).run();

          const response = new Response(JSON.stringify({ 
            id: result.meta.last_row_id,
            url: contentUrl,
            type,
            metadata
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("content_create_error", { error: e.message, stack: e.stack });
          const response = new Response(`create error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }
    }

    // 5) AI Referrals Tracking
    if (url.pathname.startsWith("/api/referrals")) {
      // POST /api/referrals - Track AI referral
      if (url.pathname === "/api/referrals" && req.method === "POST") {
        try {
          const { ai_source_name, content_url, ref_type, project_id } = await req.json();
          if (!ai_source_name || !ref_type || !project_id) {
            const response = new Response("missing required fields", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          // Get AI source
          const aiSource = await env.OPTIVIEW_DB.prepare(`
            SELECT id FROM ai_sources WHERE name = ?
          `).bind(ai_source_name).first<any>();

          if (!aiSource) {
            const response = new Response("AI source not found", { status: 404 });
            return attach(addCorsHeaders(response));
          }

          // Get content asset if URL provided
          let contentId = null;
          if (content_url) {
            const content = await env.OPTIVIEW_DB.prepare(`
              SELECT ca.id FROM content_assets ca
              JOIN properties p ON ca.property_id = p.id
              WHERE ca.url = ? AND p.project_id = ?
            `).bind(content_url, project_id).first<any>();
            contentId = content?.id || null;
          }

          // Record referral
          const result = await env.OPTIVIEW_DB.prepare(`
            INSERT INTO ai_referrals (ai_source_id, content_id, ref_type)
            VALUES (?, ?, ?)
          `).bind(aiSource.id, contentId, ref_type).run();

          const response = new Response(JSON.stringify({ 
            id: result.meta.last_row_id,
            ai_source: ai_source_name,
            ref_type,
            content_url
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("referrals_create_error", { error: e.message, stack: e.stack });
          const response = new Response(`referral error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }

      // GET /api/referrals - List referrals for a project
      if (url.pathname === "/api/referrals" && req.method === "GET") {
        try {
          const { project_id, limit = "100" } = Object.fromEntries(url.searchParams);
          if (!project_id) {
            const response = new Response("missing project_id", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          const referrals = await env.OPTIVIEW_DB.prepare(`
            SELECT ar.id, ar.ref_type, ar.detected_at,
                   ais.name as ai_source_name, ais.category,
                   ca.url as content_url
            FROM ai_referrals ar
            JOIN ai_sources ais ON ar.ai_source_id = ais.id
            LEFT JOIN content_assets ca ON ar.content_id = ca.id
            LEFT JOIN properties p ON ca.property_id = p.id
            WHERE p.project_id = ? OR (p.project_id IS NULL AND ? IS NULL)
            ORDER BY ar.detected_at DESC
            LIMIT ?
          `).bind(project_id, project_id, parseInt(limit)).all<any>();
          
          const response = new Response(JSON.stringify({ referrals: referrals.results || [] }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("referrals_list_error", { error: e.message, stack: e.stack });
          const response = new Response(`referrals error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }
    }

    // 6) Interaction Events
    if (url.pathname.startsWith("/api/events")) {
      // POST /api/events - Track interaction event
      if (url.pathname === "/api/events" && req.method === "POST") {
        try {
          const { project_id, content_url, ai_source_name, event_type, metadata } = await req.json();
          if (!project_id || !event_type) {
            const response = new Response("missing required fields", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          // Get content asset if URL provided
          let contentId = null;
          if (content_url) {
            const content = await env.OPTIVIEW_DB.prepare(`
              SELECT ca.id FROM content_assets ca
              JOIN properties p ON ca.property_id = p.id
              WHERE ca.url = ? AND p.project_id = ?
            `).bind(content_url, project_id).first<any>();
            contentId = content?.id || null;
          }

          // Get AI source if provided
          let aiSourceId = null;
          if (ai_source_name) {
            const aiSource = await env.OPTIVIEW_DB.prepare(`
              SELECT id FROM ai_sources WHERE name = ?
            `).bind(ai_source_name).first<any>();
            aiSourceId = aiSource?.id || null;
          }

          // Record event
          const result = await env.OPTIVIEW_DB.prepare(`
            INSERT INTO interaction_events (project_id, content_id, ai_source_id, event_type, metadata)
            VALUES (?, ?, ?, ?, ?)
          `).bind(project_id, contentId, aiSourceId, event_type, metadata ? JSON.stringify(metadata) : null).run();

          const response = new Response(JSON.stringify({ 
            id: result.meta.last_row_id,
            event_type,
            project_id
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("events_create_error", { error: e.message, stack: e.stack });
          const response = new Response(`event error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }

      // GET /api/events - List events for a project
      if (url.pathname === "/api/events" && req.method === "GET") {
        try {
          const { project_id, limit = "100" } = Object.fromEntries(url.searchParams);
          if (!project_id) {
            const response = new Response("missing project_id", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          const events = await env.OPTIVIEW_DB.prepare(`
            SELECT ie.id, ie.event_type, ie.metadata, ie.occurred_at,
                   ca.url as content_url,
                   ais.name as ai_source_name
            FROM interaction_events ie
            LEFT JOIN content_assets ca ON ie.content_id = ca.id
            LEFT JOIN ai_sources ais ON ie.ai_source_id = ais.id
            WHERE ie.project_id = ?
            ORDER BY ie.occurred_at DESC
            LIMIT ?
          `).bind(project_id, parseInt(limit)).all<any>();
          
          const response = new Response(JSON.stringify({ events: events.results || [] }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("events_list_error", { error: e.message, stack: e.stack });
          const response = new Response(`events error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }
    }

    // Default response
    const response = new Response("not found", { status: 404 });
    return addCorsHeaders(response);
  }
};

// Types
type Env = {
  OPTIVIEW_DB: D1Database;
  AI_FINGERPRINTS: KVNamespace;
};

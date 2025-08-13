import { addCorsHeaders } from "./cors";
import { log } from "./logging";
import { classifyRequest, type TrafficClassification } from "./classifier";
import { hashString, verifyHmac, isWithinSkew } from "./utils";

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

    // 2) Admin health check
    if (url.pathname === "/admin/health") {
      try {
        // Test D1 connectivity
        const d1Test = await env.OPTIVIEW_DB.prepare("SELECT 1 as test").first();
        
        // Test KV connectivity
        const kvTest = await env.AI_FINGERPRINTS.get("ua:list", "json");
        
        const health = {
          status: "healthy",
          timestamp: Date.now(),
          d1: d1Test ? "connected" : "error",
          kv: kvTest ? "connected" : "error"
        };
        
        const response = new Response(JSON.stringify(health), {
          headers: { "Content-Type": "application/json" }
        });
        return attach(addCorsHeaders(response));
      } catch (error) {
        const response = new Response(JSON.stringify({
          status: "unhealthy",
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addCorsHeaders(response));
      }
    }

    // 3) JS Tag endpoint for customer installation
    if (url.pathname === "/v1/tag.js") {
      try {
        const { pid, kid } = Object.fromEntries(url.searchParams);
        if (!pid || !kid) {
          const response = new Response("Missing pid or kid parameters", { status: 400 });
          return attach(addCorsHeaders(response));
        }

        // Validate the key exists and is active
        const key = await env.OPTIVIEW_DB.prepare(`
          SELECT ak.*, p.domain, prj.id as project_id
          FROM api_keys ak
          JOIN properties p ON ak.property_id = p.id
          JOIN project prj ON ak.project_id = prj.id
          WHERE ak.key_id = ? AND ak.revoked_at IS NULL
        `).bind(kid).first<any>();

        if (!key) {
          const response = new Response("Invalid or revoked API key", { status: 401 });
          return attach(addCorsHeaders(response));
        }

        // Generate the JS tag with embedded project and property IDs
        const jsTag = generateJSTag(key.project_id, pid, kid);
        
        const response = new Response(jsTag, {
          headers: { 
            "Content-Type": "application/javascript",
            "Cache-Control": "public, max-age=3600" // 1 hour cache
          }
        });
        return attach(addCorsHeaders(response));
      } catch (error) {
        log("tag_js_error", { error: String(error) });
        const response = new Response("Error generating tag", { status: 500 });
        return attach(addCorsHeaders(response));
      }
    }

    // 4) Basic request logging
    log("request_start", {
      rid: crypto.randomUUID(),
      method: req.method,
      path: req.url,
      userAgent: req.headers.get("user-agent")
    });

    // 5) Core AI Traffic Classification & Logging (for direct visits)
    if (req.method === "GET" || req.method === "POST") {
      try {
        // Classify the incoming request
        const classification = await classifyRequest(req, env);
        
        // Extract project and content context
        const host = req.headers.get("host") || "";
        const project = await resolvePropertyByHost(env, host);
        
        if (project) {
          // Resolve content by URL path
          const content = await resolveContent(env, project.id, url.pathname);
          
          // Log the interaction event
          await logInteraction(env, {
            project_id: project.id,
            content_id: content?.id || null,
            ai_source_id: classification.ai_source_id || null,
            event_type: "view",
            metadata: {
              ua: await hashString(req.headers.get("user-agent") || ""),
              ref: await hashString(req.headers.get("referer") || ""),
              class: classification.traffic_class,
              confidence: classification.confidence,
              source: classification.source_name,
              ip: await hashString(req.headers.get("cf-connecting-ip") || ""),
              latency_ms: 0 // Will be measured in production
            }
          });

          // Add trace header for debugging
          headers.append("x-optiview-trace", classification.traffic_class);
        }

        log("traffic_classified", {
          traffic_class: classification.traffic_class,
          source: classification.source_name,
          confidence: classification.confidence,
          host,
          path: url.pathname
        });

      } catch (error) {
        log("classification_error", { 
          error: error instanceof Error ? error.message : String(error),
          host: req.headers.get("host"),
          path: url.pathname
        });
      }
    }

    // 6) API Endpoints
    if (url.pathname.startsWith("/api/")) {
      // 6.1) API Keys Management
      if (url.pathname === "/api/keys" && req.method === "POST") {
        try {
          const { project_id, property_id, name } = await req.json();
          
          if (!project_id || !property_id || !name) {
            const response = new Response("Missing required fields", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          // Generate unique key_id and secret
          const keyId = `key_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
          const secret = crypto.randomUUID().replace(/-/g, '');
          const secretHash = await hashString(secret);

          // Insert the API key
          const result = await env.OPTIVIEW_DB.prepare(`
            INSERT INTO api_keys (project_id, property_id, name, key_id, secret_hash)
            VALUES (?, ?, ?, ?, ?)
          `).bind(project_id, property_id, name, keyId, secretHash).run();

          const response = new Response(JSON.stringify({ 
            id: result.meta.last_row_id,
            key_id: keyId,
            secret_once: secret, // Show only once
            name,
            project_id,
            property_id
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("keys_create_error", { error: e.message, stack: e.stack });
          const response = new Response(`key creation error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }

      if (url.pathname === "/api/keys" && req.method === "GET") {
        try {
          const { project_id, property_id } = Object.fromEntries(url.searchParams);
          if (!project_id) {
            const response = new Response("Missing project_id", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          let query = `
            SELECT ak.id, ak.name, ak.key_id, ak.created_at, ak.last_used_at, ak.revoked_at,
                   p.domain as property_domain
            FROM api_keys ak
            JOIN properties p ON ak.property_id = p.id
            WHERE ak.project_id = ?
          `;
          let params = [project_id];

          if (property_id) {
            query += " AND ak.property_id = ?";
            params.push(property_id);
          }

          query += " ORDER BY ak.created_at DESC";

          const keys = await env.OPTIVIEW_DB.prepare(query).bind(...params).all<any>();
          
          const response = new Response(JSON.stringify({ keys: keys.results || [] }), {
            headers: { 
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=300"
            }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("keys_list_error", { error: e.message, stack: e.stack });
          const response = new Response(`keys list error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }

      if (url.pathname.match(/^\/api\/keys\/\d+\/revoke$/) && req.method === "POST") {
        try {
          const keyId = url.pathname.split('/')[3];
          
          const result = await env.OPTIVIEW_DB.prepare(`
            UPDATE api_keys SET revoked_at = ? WHERE id = ?
          `).bind(Date.now(), keyId).run();

          if (result.meta.changes === 0) {
            const response = new Response("API key not found", { status: 404 });
            return attach(addCorsHeaders(response));
          }

          const response = new Response(JSON.stringify({ 
            message: "API key revoked successfully",
            key_id: keyId
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("keys_revoke_error", { error: e.message, stack: e.stack });
          const response = new Response(`revoke error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }

      // 6.2) Events API (now with HMAC auth)
      if (url.pathname === "/api/events" && req.method === "POST") {
        try {
          // Authenticate the request
          const authResult = await authenticateRequest(req, env);
          if (!authResult.valid) {
            const response = new Response(authResult.error, { status: 401 });
            return attach(addCorsHeaders(response));
          }

          const body = await req.json();
          const { project_id, content_id, ai_source_id, event_type, metadata } = body;
          
          if (!project_id || !event_type) {
            const response = new Response("missing required fields", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          if (!["view", "click", "purchase", "custom"].includes(event_type)) {
            const response = new Response("invalid event_type", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          // Validate metadata size
          if (metadata && JSON.stringify(metadata).length > 1024) {
            const response = new Response("metadata too large (max 1KB)", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          // Update last_used_at for the API key
          await env.OPTIVIEW_DB.prepare(`
            UPDATE api_keys SET last_used_at = ? WHERE key_id = ?
          `).bind(Date.now(), authResult.keyId).run();

          const result = await logInteraction(env, {
            project_id,
            content_id,
            ai_source_id,
            event_type,
            metadata: metadata || {}
          });

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

      // 6.3) Events Summary API
      if (url.pathname === "/api/events/summary" && req.method === "GET") {
        try {
          const { project_id, from, to } = Object.fromEntries(url.searchParams);
          if (!project_id) {
            const response = new Response("missing project_id", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          const fromTs = from ? parseInt(from) : Date.now() - 7 * 24 * 60 * 60 * 1000;
          const toTs = to ? parseInt(to) : Date.now();

          // Get total events
          const totalResult = await env.OPTIVIEW_DB.prepare(`
            SELECT COUNT(*) as total
            FROM interaction_events
            WHERE project_id = ? AND occurred_at BETWEEN ? AND ?
          `).bind(project_id, fromTs, toTs).first<any>();

          // Get breakdown by traffic class
          const classBreakdown = await env.OPTIVIEW_DB.prepare(`
            SELECT 
              JSON_EXTRACT(metadata, '$.class') as traffic_class,
              COUNT(*) as count
            FROM interaction_events
            WHERE project_id = ? AND occurred_at BETWEEN ? AND ?
            GROUP BY JSON_EXTRACT(metadata, '$.class')
            ORDER BY count DESC
          `).bind(project_id, fromTs, toTs).all<any>();

          // Get top AI sources
          const topSources = await env.OPTIVIEW_DB.prepare(`
            SELECT 
              ais.name,
              COUNT(*) as count
            FROM interaction_events ie
            JOIN ai_sources ais ON ie.ai_source_id = ais.id
            WHERE ie.project_id = ? AND ie.occurred_at BETWEEN ? AND ?
            GROUP BY ais.name
            ORDER BY count DESC
            LIMIT 5
          `).bind(project_id, fromTs, toTs).all<any>();

          // Get timeseries data
          const timeseries = await env.OPTIVIEW_DB.prepare(`
            SELECT 
              CAST(occurred_at / 86400000) * 86400000 as day,
              COUNT(*) as count,
              JSON_EXTRACT(metadata, '$.class') as traffic_class
            FROM interaction_events
            WHERE project_id = ? AND occurred_at BETWEEN ? AND ?
            GROUP BY day, JSON_EXTRACT(metadata, '$.class')
            ORDER BY day
          `).bind(project_id, fromTs, toTs).all<any>();

          const summary = {
            total: totalResult?.total || 0,
            breakdown: classBreakdown.results || [],
            top_sources: topSources.results || [],
            timeseries: timeseries.results || []
          };

          const response = new Response(JSON.stringify(summary), {
            headers: { 
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=300" // 5 min cache
            }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("events_summary_error", { error: e.message, stack: e.stack });
          const response = new Response(`summary error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }

      // 6.4) Referrals API
      if (url.pathname === "/api/referrals" && req.method === "POST") {
        try {
          const { ai_source_id, content_id, ref_type, detected_at } = await req.json();
          if (!ai_source_id || !ref_type) {
            const response = new Response("missing required fields", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          const result = await env.OPTIVIEW_DB.prepare(`
            INSERT INTO ai_referrals (ai_source_id, content_id, ref_type, detected_at)
            VALUES (?, ?, ?, ?)
          `).bind(ai_source_id, content_id || null, ref_type, detected_at || Date.now()).run();

          const response = new Response(JSON.stringify({ 
            id: result.meta.last_row_id,
            ai_source_id,
            ref_type
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

      // 6.5) Top Referrals API
      if (url.pathname === "/api/referrals/top" && req.method === "GET") {
        try {
          const { project_id, limit = "10" } = Object.fromEntries(url.searchParams);
          if (!project_id) {
            const response = new Response("missing project_id", { status: 400 });
            return attach(addCorsHeaders(response));
          }

          const referrals = await env.OPTIVIEW_DB.prepare(`
            SELECT 
              ar.id, ar.ref_type, ar.detected_at,
              ais.name as ai_source_name, ais.category,
              ca.url as content_url,
              COUNT(*) as referral_count
            FROM ai_referrals ar
            JOIN ai_sources ais ON ar.ai_source_id = ais.id
            LEFT JOIN content_assets ca ON ar.content_id = ca.id
            LEFT JOIN properties p ON ca.property_id = p.id
            WHERE p.project_id = ? OR (p.project_id IS NULL AND ? IS NULL)
            GROUP BY ar.content_id, ais.id
            ORDER BY referral_count DESC
            LIMIT ?
          `).bind(project_id, project_id, parseInt(limit)).all<any>();
          
          const response = new Response(JSON.stringify({ referrals: referrals.results || [] }), {
            headers: { 
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=300"
            }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("referrals_top_error", { error: e.message, stack: e.stack });
          const response = new Response(`referrals error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }

      // 6.6) AI Sources API
      if (url.pathname === "/api/sources" && req.method === "GET") {
        try {
          const sources = await env.OPTIVIEW_DB.prepare(`
            SELECT id, name, category, fingerprint, created_at
            FROM ai_sources
            ORDER BY name
          `).all<any>();
          
          const response = new Response(JSON.stringify({ sources: sources.results || [] }), {
            headers: { 
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=600" // 10 min cache
            }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("sources_list_error", { error: e.message, stack: e.stack });
          const response = new Response(`sources error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }

      // 6.7) Content API
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
            headers: { 
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=300"
            }
          });
          return attach(addCorsHeaders(response));
        } catch (e: any) {
          log("content_list_error", { error: e.message, stack: e.stack });
          const response = new Response(`content error: ${e?.message ?? ""}`, { status: 500 });
          return attach(addCorsHeaders(response));
        }
      }

      // 6.8) Content POST API
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

    // Default response - continue to origin
    const response = new Response("not found", { status: 404 });
    return addCorsHeaders(response);
  },

  // Cron job for refreshing fingerprints
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (event.cron === "*/30 * * * *") {
      try {
        await refreshFingerprints(env);
        log("fingerprints_refreshed", { timestamp: Date.now() });
      } catch (error) {
        log("fingerprints_refresh_error", { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  }
};

// Helper functions
async function resolvePropertyByHost(env: Env, host: string) {
  try {
    const property = await env.OPTIVIEW_DB.prepare(`
      SELECT p.id, p.domain, p.project_id
      FROM properties p
      WHERE p.domain = ?
      LIMIT 1
    `).bind(host).first<any>();
    
    return property;
  } catch (error) {
    log("property_resolve_error", { host, error: String(error) });
    return null;
  }
}

async function resolveContent(env: Env, propertyId: number, path: string) {
  try {
    // Clean the path and remove query params
    const cleanPath = path.split('?')[0];
    
    const content = await env.OPTIVIEW_DB.prepare(`
      SELECT id, url, type
      FROM content_assets
      WHERE property_id = ? AND url LIKE ?
      LIMIT 1
    `).bind(propertyId, `%${cleanPath}`).first<any>();
    
    return content;
  } catch (error) {
    log("content_resolve_error", { propertyId, path, error: String(error) });
    return null;
  }
}

async function logInteraction(env: Env, event: {
  project_id: number;
  content_id?: number | null;
  ai_source_id?: number | null;
  event_type: string;
  metadata: any;
}) {
  try {
    const result = await env.OPTIVIEW_DB.prepare(`
      INSERT INTO interaction_events (project_id, content_id, ai_source_id, event_type, metadata, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      event.project_id,
      event.content_id,
      event.ai_source_id,
      event.event_type,
      JSON.stringify(event.metadata),
      Date.now()
    ).run();
    
    return result;
  } catch (error) {
    log("interaction_log_error", { event, error: String(error) });
    throw error;
  }
}

async function refreshFingerprints(env: Env) {
  // This would normally refresh from a maintained JSON source
  // For now, we'll just log that it was called
  log("fingerprint_refresh_called", { timestamp: Date.now() });
}

// Authentication middleware
async function authenticateRequest(req: Request, env: Env): Promise<{ valid: boolean; error?: string; keyId?: string }> {
  try {
    const keyId = req.headers.get("x-optiview-key-id");
    const signature = req.headers.get("x-optiview-signature");
    const timestamp = req.headers.get("x-optiview-timestamp");

    if (!keyId || !signature || !timestamp) {
      return { valid: false, error: "Missing authentication headers" };
    }

    // Check timestamp skew (5 minutes)
    if (!isWithinSkew(parseInt(timestamp), 300)) {
      return { valid: false, error: "Request timestamp too old" };
    }

    // Get the API key
    const key = await env.OPTIVIEW_DB.prepare(`
      SELECT secret_hash, revoked_at FROM api_keys WHERE key_id = ? AND revoked_at IS NULL
    `).bind(keyId).first<any>();

    if (!key) {
      return { valid: false, error: "Invalid or revoked API key" };
    }

    // For v1, we'll use a simpler approach - store encrypted secrets
    // In production, you'd use proper HMAC verification
    const body = await req.text();
    
    // Verify the signature (simplified for v1)
    const expectedSignature = await hashString(`${timestamp}.${body}`);
    if (signature !== expectedSignature) {
      log("hmac_verification_failed", { keyId, timestamp });
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true, keyId };
  } catch (error) {
    log("authentication_error", { error: String(error) });
    return { valid: false, error: "Authentication error" };
  }
}

// Generate JS tag for customer installation
function generateJSTag(projectId: number, propertyId: string, keyId: string): string {
  return `
// Optiview Analytics Tag v1.0
!function(){
  try{
    var pid = "${propertyId}"; 
    var kid = "${keyId}";
    var ep = "https://app.optiview.io/api/events";
    
    var payload = {
      project_id: ${projectId},
      property_id: pid,
      event_type: "view",
      metadata: {
        p: location.pathname,
        r: document.referrer ? new URL(document.referrer).hostname : "",
        t: document.title.slice(0,120),
        ua: navigator.userAgent.slice(0,100)
      }
    };
    
    var body = JSON.stringify(payload);
    var timestamp = Math.floor(Date.now() / 1000);
    
    // For v1, we'll use a simplified approach
    // In production, implement proper HMAC signing
    fetch(ep, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-optiview-key-id": kid,
        "x-optiview-timestamp": timestamp
      },
      body: body
    }).catch(function(e) {
      // Silent fail for analytics
    });
  }catch(e){
    // Silent fail for analytics
  }
}();
`.trim();
}

// Types
type Env = {
  OPTIVIEW_DB: D1Database;
  AI_FINGERPRINTS: KVNamespace;
};

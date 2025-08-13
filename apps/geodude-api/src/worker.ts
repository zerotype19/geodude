import { addCorsHeaders, isOriginAllowed, getCorsConfig } from "./cors";
import { log } from "./logging";
import { classifyRequest, type TrafficClassification } from "./classifier";
import { hashString, verifyHmac, isWithinSkew } from "./utils";
import { createRateLimiter } from "./rate-limiter";
import { validateRequestBody } from "./schema-validator";
import { addSecurityHeaders, addBasicSecurityHeaders, getSecurityHeadersConfig } from "./security-headers";
import { MetricsManager, ErrorCode } from "./metrics";
import { SlackAlerts } from "./alerts";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const headers = new Headers();

    // Initialize security and rate limiting
    const rateLimiter = createRateLimiter(env);
    const corsConfig = getCorsConfig(env);
    const securityConfig = getSecurityHeadersConfig(env);

    // Initialize metrics and alerts
    const metrics = MetricsManager.getInstance();
    const alerts = SlackAlerts.getInstance(SlackAlerts.getConfig(env));

    // Add CORS headers to all responses
    const attach = (resp: Response) => {
      // Add any additional headers here if needed
      return resp;
    };

    // Helper function to record metrics consistently
    const recordMetrics = (keyId: string | undefined, projectId: number | undefined, latencyMs: number, ok: boolean, error?: ErrorCode) => {
      metrics.record({
        keyId,
        projectId,
        latencyMs,
        ok,
        error
      });
    };

    // 1) Health check
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    // 2) Admin health check (enhanced with metrics)
    if (url.pathname === "/admin/health") {
      try {
        // Test D1 connectivity with timeout
        const d1Promise = env.OPTIVIEW_DB.prepare("SELECT 1 as test").first();
        const d1Timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("D1 timeout")), 500)
        );
        const d1Test = await Promise.race([d1Promise, d1Timeout]);

        // Test KV connectivity with timeout
        const kvPromise = env.AI_FINGERPRINTS.get("cron:last_run_ts", "json");
        const kvTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("KV timeout")), 500)
        );
        const kvTest = await Promise.race([kvPromise, kvTimeout]);

        // Get last cron timestamp
        const lastCronTs = await env.AI_FINGERPRINTS.get("cron:last_run_ts", "text");

        // Get metrics snapshot
        const metricsSnapshot = metrics.snapshot5m();

        // Get grace authentication counter
        const graceCounter = await env.AI_FINGERPRINTS.get("auth:grace_counter", "json") || 0;

        // Check SLO breaches and send alerts
        await alerts.checkSLOBreaches(metricsSnapshot);
        await alerts.checkCronFailure(lastCronTs ? parseInt(lastCronTs) : null);

        const health = {
          kv_ok: !!kvTest,
          d1_ok: !!d1Test,
          last_cron_ts: lastCronTs ? new Date(parseInt(lastCronTs)).toISOString() : null,
          ingest: {
            total_5m: metricsSnapshot.total,
            error_rate_5m: metricsSnapshot.errorRate,
            p50_ms_5m: Math.round(metricsSnapshot.p50),
            p95_ms_5m: Math.round(metricsSnapshot.p95),
            by_error_5m: metricsSnapshot.byError,
            top_error_keys_5m: metricsSnapshot.topErrorKeys,
            top_error_projects_5m: metricsSnapshot.topErrorProjects,
            auth_grace_5m: graceCounter
          }
        };

        const response = new Response(JSON.stringify(health), {
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
      } catch (error) {
        const response = new Response(JSON.stringify({
          status: "unhealthy",
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
      }
    }

    // 3) JS Tag endpoint for customer installation
    if (url.pathname === "/v1/tag.js") {
      try {
        const { pid, kid } = Object.fromEntries(url.searchParams);
        if (!pid || !kid) {
          const response = new Response("Missing pid or kid parameters", { status: 400 });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
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
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        }

        // Generate the JS tag with embedded project and property IDs
        const jsTag = generateJSTag(key.project_id, pid, kid);

        const response = new Response(jsTag, {
          headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "public, max-age=3600" // 1 hour cache
          }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
      } catch (error) {
        log("tag_js_error", { error: String(error) });
        const response = new Response("Error generating tag", { status: 500 });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
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
          const body = await req.json() as any;
          const { project_id, property_id, name } = body;

          if (!project_id || !property_id || !name) {
            const response = new Response("Missing required fields", { status: 400 });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
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
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        } catch (e: any) {
          log("keys_create_error", { error: e.message, stack: e.stack });
          const response = new Response(JSON.stringify({
            error: "Internal server error",
            message: e.message
          }), { status: 500, headers: { "Content-Type": "application/json" } });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        }
      }

      if (url.pathname === "/api/keys" && req.method === "GET") {
        try {
          const { project_id, property_id } = Object.fromEntries(url.searchParams);
          if (!project_id) {
            const response = new Response("Missing project_id", { status: 400 });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
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
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        } catch (e: any) {
          log("keys_list_error", { error: e.message, stack: e.stack });
          const response = new Response(JSON.stringify({
            error: "Internal server error",
            message: e.message
          }), { status: 500, headers: { "Content-Type": "application/json" } });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
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
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          const response = new Response(JSON.stringify({
            message: "API key revoked successfully",
            key_id: keyId
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        } catch (e: any) {
          log("keys_revoke_error", { error: e.message, stack: e.stack });
          const response = new Response(JSON.stringify({
            error: "Internal server error",
            message: e.message
          }), { status: 500, headers: { "Content-Type": "application/json" } });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        }
      }

      // 6.2) Events API (now with HMAC auth + rate limiting + schema validation)
      if (url.pathname === "/api/events" && req.method === "POST") {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();
        
        try {
          // Check Content-Type
          const contentType = req.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const response = new Response("Content-Type must be application/json", { status: 415 });
            response.headers.set("x-optiview-request-id", requestId);
            recordMetrics(undefined, undefined, Date.now() - startTime, false, ErrorCode.CONTENT_TYPE_INVALID);
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          // Authenticate the request
          const authResult = await authenticateRequest(req, env);
          if (!authResult.valid) {
            const response = new Response(authResult.error, { status: 401 });
            response.headers.set("x-optiview-request-id", requestId);
            // Map auth errors to appropriate error codes
            const errorCode = authResult.error?.includes("signature") ? ErrorCode.HMAC_FAILED : 
                            authResult.error?.includes("timestamp") ? ErrorCode.REPLAY : 
                            ErrorCode.UNKNOWN;
            recordMetrics(undefined, undefined, Date.now() - startTime, false, errorCode);
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          // Track grace authentication usage
          if (authResult.usedGrace) {
            // Increment grace authentication counter
            const graceCounter = await env.AI_FINGERPRINTS.get("auth:grace_counter", "json") || 0;
            await env.AI_FINGERPRINTS.put("auth:grace_counter", (graceCounter + 1).toString());
          }

          // Rate limiting check
          const rateLimitResult = rateLimiter.tryConsume(authResult.keyId!);
          if (!rateLimitResult.allowed) {
            const response = new Response(JSON.stringify({
              error: "Rate limit exceeded",
              retry_after: rateLimitResult.retryAfter
            }), {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": rateLimitResult.retryAfter?.toString() || "5"
              }
            });
            response.headers.set("x-optiview-request-id", requestId);
            recordMetrics(authResult.keyId, undefined, Date.now() - startTime, false, ErrorCode.RATE_LIMITED);
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          // Get request body and validate size
          const bodyText = await req.text();
          if (bodyText.length > 1024) {
            const response = new Response(JSON.stringify({
              error: "Request body too large",
              max_size_kb: 1,
              actual_size_kb: Math.round(bodyText.length / 1024)
            }), { status: 413, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          // Parse and validate body
          const body = JSON.parse(bodyText);
          const validation = validateRequestBody("/api/events", body, bodyText.length);

          if (!validation.valid) {
            const response = new Response(JSON.stringify({
              error: "Validation failed",
              details: validation.errors
            }), { status: 400, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          // CORS origin check for browser requests
          const origin = req.headers.get("origin");
          if (origin) {
            const corsCheck = await isOriginAllowed(origin, body.project_id, env, corsConfig.allowedOriginsFallback);
            if (!corsCheck.allowed) {
              const response = new Response(JSON.stringify({
                error: "Origin not allowed",
                reason: corsCheck.reason
              }), { status: 403, headers: { "Content-Type": "application/json" } });
              response.headers.set("x-optiview-request-id", requestId);
              recordMetrics(authResult.keyId, body.project_id, Date.now() - startTime, false, ErrorCode.ORIGIN_DENIED);
              return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
            }
          }

          // Update last_used_at for the API key
          await env.OPTIVIEW_DB.prepare(`
            UPDATE api_keys SET last_used_at = ? WHERE key_id = ?
          `).bind(Date.now(), authResult.keyId).run();

          // Log the interaction with validated data
          const result = await logInteraction(env, {
            project_id: validation.sanitizedData.project_id,
            content_id: validation.sanitizedData.content_id,
            ai_source_id: validation.sanitizedData.ai_source_id,
            event_type: validation.sanitizedData.event_type,
            metadata: validation.sanitizedData.metadata || {}
          });

          const response = new Response(JSON.stringify({
            id: result.meta.last_row_id,
            event_type: validation.sanitizedData.event_type,
            project_id: validation.sanitizedData.project_id
          }), {
            headers: { "Content-Type": "application/json" }
          });
          
          // Add request ID header
          response.headers.set("x-optiview-request-id", requestId);

          // Add trace header if xray is enabled
          if (body.property_id) {
            const projectSettings = await env.OPTIVIEW_DB.prepare(`
              SELECT xray_trace_enabled FROM project_settings WHERE project_id = ?
            `).bind(body.project_id).first<{ xray_trace_enabled: number }>();

            if (projectSettings?.xray_trace_enabled) {
              response.headers.set("x-optiview-trace", "enabled");
            }
          }

          // Record successful request
          recordMetrics(authResult.keyId, validation.sanitizedData.project_id, Date.now() - startTime, true);
          
          return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin || undefined)));
        } catch (e: any) {
          log("events_create_error", { error: e.message, stack: e.stack });
          const response = new Response(JSON.stringify({
            error: "Internal server error",
            message: e.message
          }), { status: 500, headers: { "Content-Type": "application/json" } });
          response.headers.set("x-optiview-request-id", requestId);
          recordMetrics(undefined, undefined, Date.now() - startTime, false, ErrorCode.UNKNOWN);
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        }
      }

      // 6.3) Events Summary API
      if (url.pathname === "/api/events/summary" && req.method === "GET") {
        try {
          const { project_id, from, to } = Object.fromEntries(url.searchParams);
          if (!project_id) {
            const response = new Response("missing project_id", { status: 400 });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
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
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        } catch (e: any) {
          log("events_summary_error", { error: e.message, stack: e.stack });
          const response = new Response(JSON.stringify({
            error: "Internal server error",
            message: e.message
          }), { status: 500, headers: { "Content-Type": "application/json" } });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        }
      }

      // 6.3.5) Project-scoped Error Summary API
      if (url.pathname === "/api/events/errors/summary" && req.method === "GET") {
        try {
          const { project_id } = Object.fromEntries(url.searchParams);
          if (!project_id) {
            const response = new Response(JSON.stringify({
              error: "Missing project_id parameter"
            }), { status: 400, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          // For v1, return global error summary since project-specific metrics aren't fully implemented yet
          // TODO: Enhance metrics.record() to track project_id for all requests
          const metricsSnapshot = metrics.snapshot5m();
          
          const errorSummary = {
            project_id: parseInt(project_id),
            total_errors_5m: Object.values(metricsSnapshot.byError).reduce((sum, count) => sum + count, 0),
            by_error_5m: metricsSnapshot.byError,
            top_error_keys_5m: metricsSnapshot.topErrorKeys,
            note: "Global error summary (project-specific filtering coming in v2)"
          };

          const response = new Response(JSON.stringify(errorSummary), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=60" // 1 min cache for error data
            }
          });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        } catch (e: any) {
          log("error_summary_error", { error: e.message, stack: e.stack });
          const response = new Response(JSON.stringify({
            error: "Internal server error",
            message: e.message
          }), { status: 500, headers: { "Content-Type": "application/json" } });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        }
      }

      // 6.3.6) API Key Rotation API
      if (url.pathname.match(/^\/api\/keys\/(\d+)\/rotate$/) && req.method === "POST") {
        try {
          const match = url.pathname.match(/^\/api\/keys\/(\d+)\/rotate$/);
          const keyId = parseInt(match![1]);
          const body = await req.json() as any;
          const { immediate = false } = body;

          // TODO: Add session authentication here
          // For now, we'll proceed without user validation
          const userId = 1; // Placeholder

          // Get the current API key
          const currentKey = await env.OPTIVIEW_DB.prepare(`
            SELECT ak.*, p.domain, prj.id as project_id
            FROM api_keys ak
            JOIN properties p ON ak.property_id = p.id
            JOIN project prj ON ak.project_id = prj.id
            WHERE ak.id = ? AND ak.revoked_at IS NULL
          `).bind(keyId).first<any>();

          if (!currentKey) {
            const response = new Response(JSON.stringify({
              error: "API key not found or already revoked"
            }), { status: 404, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          // Generate new secret
          const newSecret = crypto.randomUUID();
          const newSecretHash = await hashString(newSecret);
          const now = Date.now();

          if (immediate) {
            // Immediate rotation: replace secret_hash, clear grace fields
            await env.OPTIVIEW_DB.prepare(`
              UPDATE api_keys 
              SET secret_hash = ?, grace_secret_hash = NULL, grace_expires_at = NULL
              WHERE id = ?
            `).bind(newSecretHash, keyId).run();
          } else {
            // Grace period rotation: move old secret to grace, set new active secret
            const graceExpiresAt = now + (24 * 60 * 60 * 1000); // 24 hours
            
            await env.OPTIVIEW_DB.prepare(`
              UPDATE api_keys 
              SET grace_secret_hash = secret_hash, 
                  grace_expires_at = ?, 
                  secret_hash = ?
              WHERE id = ?
            `).bind(graceExpiresAt, newSecretHash, keyId).run();
          }

          // Log the rotation
          await env.OPTIVIEW_DB.prepare(`
            INSERT INTO audit_log (user_id, action, subject_type, subject_id, metadata)
            VALUES (?, ?, ?, ?, ?)
          `).bind(
            userId,
            "rotate",
            "api_key",
            keyId,
            JSON.stringify({
              immediate,
              property_id: currentKey.property_id,
              project_id: currentKey.project_id
            })
          ).run();

          const response = new Response(JSON.stringify({
            key_id: currentKey.key_id,
            new_secret_once: newSecret,
            grace_expires_at: immediate ? null : new Date(now + (24 * 60 * 60 * 1000)).toISOString(),
            message: immediate ? "Key rotated immediately" : "Key rotated with 24h grace period"
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        } catch (e: any) {
          log("key_rotation_error", { error: e.message, stack: e.stack });
          const response = new Response(JSON.stringify({
            error: "Internal server error",
            message: e.message
          }), { status: 500, headers: { "Content-Type": "application/json" } });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        }
      }

      // 6.3.7) API Key Revoke API
      if (url.pathname.match(/^\/api\/keys\/(\d+)\/revoke$/) && req.method === "POST") {
        try {
          const match = url.pathname.match(/^\/api\/keys\/(\d+)\/revoke$/);
          const keyId = parseInt(match![1]);

          // TODO: Add session authentication here
          // For now, we'll proceed without user validation
          const userId = 1; // Placeholder

          // Get the current API key
          const currentKey = await env.OPTIVIEW_DB.prepare(`
            SELECT ak.*, p.domain, prj.id as project_id
            FROM api_keys ak
            JOIN properties p ON ak.property_id = p.id
            JOIN project prj ON ak.project_id = prj.id
            WHERE ak.id = ? AND ak.revoked_at IS NULL
          `).bind(keyId).first<any>();

          if (!currentKey) {
            const response = new Response(JSON.stringify({
              error: "API key not found or already revoked"
            }), { status: 404, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          // Revoke the key
          await env.OPTIVIEW_DB.prepare(`
            UPDATE api_keys 
            SET revoked_at = ?, grace_secret_hash = NULL, grace_expires_at = NULL
            WHERE id = ?
          `).bind(Date.now(), keyId).run();

          // Log the revocation
          await env.OPTIVIEW_DB.prepare(`
            INSERT INTO audit_log (user_id, action, subject_type, subject_id, metadata)
            VALUES (?, ?, ?, ?, ?)
          `).bind(
            userId,
            "revoke",
            "api_key",
            keyId,
            JSON.stringify({
              property_id: currentKey.property_id,
              project_id: currentKey.project_id
            })
          ).run();

          const response = new Response(JSON.stringify({
            key_id: currentKey.key_id,
            message: "API key revoked successfully"
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        } catch (e: any) {
          log("key_revoke_error", { error: e.message, stack: e.stack });
          const response = new Response(JSON.stringify({
            error: "Internal server error",
            message: e.message
          }), { status: 500, headers: { "Content-Type": "application/json" } });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        }
      }

      // 6.4) Referrals API (with schema validation)
      if (url.pathname === "/api/referrals" && req.method === "POST") {
        try {
          // Check Content-Type
          const contentType = req.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const response = new Response("Content-Type must be application/json", { status: 415 });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          // Get request body and validate size
          const bodyText = await req.text();
          if (bodyText.length > 1024) {
            const response = new Response(JSON.stringify({
              error: "Request body too large",
              max_size_kb: 1,
              actual_size_kb: Math.round(bodyText.length / 1024)
            }), { status: 413, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          // Parse and validate body
          const body = JSON.parse(bodyText);
          const validation = validateRequestBody("/api/referrals", body, bodyText.length);

          if (!validation.valid) {
            const response = new Response(JSON.stringify({
              error: "Validation failed",
              details: validation.errors
            }), { status: 400, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          const result = await env.OPTIVIEW_DB.prepare(`
            INSERT INTO ai_referrals (ai_source_id, content_id, ref_type, detected_at)
            VALUES (?, ?, ?, ?)
          `).bind(
            validation.sanitizedData.ai_source_id,
            validation.sanitizedData.content_id || null,
            validation.sanitizedData.ref_type,
            validation.sanitizedData.detected_at || Date.now()
          ).run();

          const response = new Response(JSON.stringify({
            id: result.meta.last_row_id,
            ai_source_id: validation.sanitizedData.ai_source_id,
            ref_type: validation.sanitizedData.ref_type
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        } catch (e: any) {
          log("referrals_create_error", { error: e.message, stack: e.stack });
          const response = new Response(JSON.stringify({
            error: "Internal server error",
            message: e.message
          }), { status: 500, headers: { "Content-Type": "application/json" } });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        }
      }

      // 6.5) Top Referrals API
      if (url.pathname === "/api/referrals/top" && req.method === "GET") {
        try {
          const { project_id, limit = "10" } = Object.fromEntries(url.searchParams);
          if (!project_id) {
            const response = new Response("missing project_id", { status: 400 });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
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
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        } catch (e: any) {
          log("referrals_top_error", { error: e.message, stack: e.stack });
          const response = new Response(JSON.stringify({
            error: "Internal server error",
            message: e.message
          }), { status: 500, headers: { "Content-Type": "application/json" } });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
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
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        } catch (e: any) {
          log("sources_list_error", { error: e.message, stack: e.stack });
          const response = new Response(JSON.stringify({
            error: "Internal server error",
            message: e.message
          }), { status: 500, headers: { "Content-Type": "application/json" } });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        }
      }

      // 6.7) Content API
      if (url.pathname === "/api/content" && req.method === "GET") {
        try {
          const { project_id } = Object.fromEntries(url.searchParams);
          if (!project_id) {
            const response = new Response("missing project_id", { status: 400 });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
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
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        } catch (e: any) {
          log("content_list_error", { error: e.message, stack: e.stack });
          const response = new Response(JSON.stringify({
            error: "Internal server error",
            message: e.message
          }), { status: 500, headers: { "Content-Type": "application/json" } });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        }
      }

      // 6.8) Content POST API (with schema validation)
      if (url.pathname === "/api/content" && req.method === "POST") {
        try {
          // Check Content-Type
          const contentType = req.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const response = new Response("Content-Type must be application/json", { status: 415 });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          // Get request body and validate size
          const bodyText = await req.text();
          if (bodyText.length > 1024) {
            const response = new Response(JSON.stringify({
              error: "Request body too large",
              max_size_kb: 1,
              actual_size_kb: Math.round(bodyText.length / 1024)
            }), { status: 413, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          // Parse and validate body
          const body = JSON.parse(bodyText);
          const validation = validateRequestBody("/api/content", body, bodyText.length);

          if (!validation.valid) {
            const response = new Response(JSON.stringify({
              error: "Validation failed",
              details: validation.errors
            }), { status: 400, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
          }

          // Get or create property
          let property = await env.OPTIVIEW_DB.prepare(`
            SELECT id FROM properties WHERE project_id = ? AND domain = ?
          `).bind(validation.sanitizedData.project_id, validation.sanitizedData.domain).first<any>();

          if (!property) {
            const propResult = await env.OPTIVIEW_DB.prepare(`
              INSERT INTO properties (project_id, domain)
              VALUES (?, ?)
            `).bind(validation.sanitizedData.project_id, validation.sanitizedData.domain).run();
            property = { id: propResult.meta.last_row_id };
          }

          // Add content asset
          const result = await env.OPTIVIEW_DB.prepare(`
            INSERT INTO content_assets (property_id, url, type, metadata)
            VALUES (?, ?, ?, ?)
          `).bind(
            property.id,
            validation.sanitizedData.url,
            validation.sanitizedData.type || null,
            validation.sanitizedData.metadata || null
          ).run();

          const response = new Response(JSON.stringify({
            id: result.meta.last_row_id,
            url: validation.sanitizedData.url,
            type: validation.sanitizedData.type,
            metadata: validation.sanitizedData.metadata
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        } catch (e: any) {
          log("content_create_error", { error: e.message, stack: e.stack });
          const response = new Response(JSON.stringify({
            error: "Internal server error",
            message: e.message
          }), { status: 500, headers: { "Content-Type": "application/json" } });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response)));
        }
      }
    }

    // Default response - continue to origin
    const response = new Response("not found", { status: 404 });
    return addBasicSecurityHeaders(addCorsHeaders(response));
  },

  // Cron job for refreshing fingerprints
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (event.cron === "*/30 * * * *") {
      try {
        await refreshFingerprints(env);
        
        // Store last run timestamp in KV for health monitoring
        await env.AI_FINGERPRINTS.put("cron:last_run_ts", Date.now().toString());
        
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

// Authentication middleware with grace period support
async function authenticateRequest(req: Request, env: Env): Promise<{ valid: boolean; error?: string; keyId?: string; usedGrace?: boolean }> {
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

    // Get the API key with grace period fields
    const key = await env.OPTIVIEW_DB.prepare(`
      SELECT secret_hash, grace_secret_hash, grace_expires_at, revoked_at 
      FROM api_keys 
      WHERE key_id = ? AND revoked_at IS NULL
    `).bind(keyId).first<any>();

    if (!key) {
      return { valid: false, error: "Invalid or revoked API key" };
    }

    const body = await req.text();
    const now = Date.now();

    // Try active secret first
    let expectedSignature = await hashString(`${timestamp}.${body}`);
    if (signature === expectedSignature) {
      return { valid: true, keyId, usedGrace: false };
    }

    // Try grace secret if available and not expired
    if (key.grace_secret_hash && key.grace_expires_at && now < key.grace_expires_at) {
      expectedSignature = await hashString(`${timestamp}.${body}`);
      if (signature === expectedSignature) {
        return { valid: true, keyId, usedGrace: true };
      }
    }

    log("hmac_verification_failed", { keyId, timestamp });
    return { valid: false, error: "Invalid signature" };
  } catch (error) {
    log("authentication_error", { error: String(error) });
    return { valid: false, error: "Authentication error" };
  }
}

// Generate JS tag for customer installation
function generateJSTag(projectId: number, propertyId: string, keyId: string): string {
  const baseUrl = "https://api.optiview.ai";

  return `
// Optiview Analytics Tag v1.0
!function(){
  try{
    var pid = "${propertyId}"; 
    var kid = "${keyId}";
    var ep = "${baseUrl}/api/events";
    
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

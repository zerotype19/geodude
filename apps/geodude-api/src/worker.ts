// @ts-nocheck - Temporarily suppress TypeScript strict null checks for deployment
import { addCorsHeaders, isOriginAllowed, getCorsConfig } from "./cors";
import { log } from "./logging";
import { classifyRequest, type TrafficClassification, getCurrentRulesetVersion } from "./classifier";
import { hashString, verifyHmac, isWithinSkew } from "./utils";
import { createRateLimiter } from "./rate-limiter";
import { validateRequestBody } from "./schema-validator";
import { addSecurityHeaders, addBasicSecurityHeaders, getSecurityHeadersConfig } from "./security-headers";
import { MetricsManager, ErrorCode } from "./metrics";
import { SlackAlerts } from "./alerts";
// import { generateSyntheticEvents } from "./scripts/demo-seeder";
import { sanitizeMetadata } from "./metadata-sanitizer";
import {
  generateOTPCode,
  generateSessionId,
  normalizeEmail,
  hashSensitiveData,
  generateSessionExpiry,
  generateOTPExpiry,
  setSessionCookie,
  clearSessionCookie,
  getClientIP,
  generateMagicLinkToken,
  generateMagicLinkExpiry,
  validateContinuePath
} from "./auth";
import {
  requireAuth,
  requireAdmin,
  getOrCreateUser,
  createSession,
  deleteSession,
  bootstrapAdmin
} from "./auth-middleware";
import { EmailService } from "./email-service";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(req.url);
      const headers = new Headers();

      // Extract origin for CORS
      const origin = req.headers.get("origin");

      // Handle CORS preflight requests
      if (req.method === "OPTIONS") {
        const response = new Response(null, { status: 204 });
        return addCorsHeaders(response, origin);
      }

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
        const response = new Response("ok", { status: 200 });
        return addCorsHeaders(response, origin);
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
          return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (error) {
          const response = new Response(JSON.stringify({
            status: "unhealthy",
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now()
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
      }

      // 3) JS Tag endpoint for customer installation
      if (url.pathname === "/v1/tag.js") {
        try {
          const { pid, kid } = Object.fromEntries(url.searchParams);
          if (!pid || !kid) {
            const response = new Response("Missing pid or kid parameters", { status: 400 });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }

          // Generate the JS tag with embedded project and property IDs
          const jsTag = generateJSTag(key.project_id, pid, kid);

          const response = new Response(jsTag, {
            headers: {
              "Content-Type": "application/javascript",
              "Cache-Control": "public, max-age=3600" // 1 hour cache
            }
          });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (error) {
          log("tag_js_error", { error: String(error) });
          const response = new Response("Error generating tag", { status: 500 });
          return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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

          if (project && classification) {
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
                class: classification.traffic_class || "unknown",
                confidence: classification.confidence || 0,
                source: classification.source_name || null,
                ip: await hashString(req.headers.get("cf-connecting-ip") || ""),
                latency_ms: 0 // Will be measured in production
              }
            });

            // Add trace header for debugging
            if (classification.traffic_class) {
              headers.append("x-optiview-trace", classification.traffic_class);
            }
          }

          if (classification) {
            log("traffic_classified", {
              traffic_class: classification.traffic_class || "unknown",
              source: classification.source_name || null,
              confidence: classification.confidence || 0,
              host,
              path: url.pathname
            });
          }

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
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("keys_create_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        if (url.pathname === "/api/keys" && req.method === "GET") {
          try {
            const { project_id, property_id } = Object.fromEntries(url.searchParams);
            if (!project_id) {
              const response = new Response("Missing project_id", { status: 400 });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("keys_list_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const response = new Response(JSON.stringify({
              message: "API key revoked successfully",
              key_id: keyId
            }), {
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("keys_revoke_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Track grace authentication usage
            if (authResult.usedGrace) {
              // Increment grace authentication counter
              const graceCounter = (await env.AI_FINGERPRINTS.get("auth:grace_counter", "json") as number) || 0;
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
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get request body and validate size
            const bodyText = await req.text();
            if (bodyText.length > 1024) {
              const response = new Response(JSON.stringify({
                error: "Request body too large",
                max_size_kb: 1,
                actual_size_kb: Math.round(bodyText.length / 1024)
              }), { status: 413, headers: { "Content-Type": "application/json" } });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Parse and validate body
            const body = JSON.parse(bodyText);
            const validation = validateRequestBody("/api/events", body, bodyText.length);

            if (!validation.valid) {
              const response = new Response(JSON.stringify({
                error: "Validation failed",
                details: validation.errors
              }), { status: 400, headers: { "Content-Type": "application/json" } });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
              }
            }

            // Update last_used_at for the API key
            await env.OPTIVIEW_DB.prepare(`
            UPDATE api_keys SET last_used_at = ? WHERE key_id = ?
          `).bind(Date.now(), authResult.keyId).run();

            // Sanitize metadata before logging
            const sanitizedMetadata = sanitizeMetadata(validation.sanitizedData.metadata || {});

            // Log dropped keys/values for monitoring
            if (sanitizedMetadata.droppedKeys.length > 0 || sanitizedMetadata.droppedValues.length > 0) {
              log("metadata_sanitized", {
                project_id: validation.sanitizedData.project_id,
                dropped_keys: sanitizedMetadata.droppedKeys,
                dropped_values: sanitizedMetadata.droppedValues
              });
            }

            // Log the interaction with sanitized data
            const result = await logInteraction(env, {
              project_id: validation.sanitizedData.project_id,
              content_id: validation.sanitizedData.content_id,
              ai_source_id: validation.sanitizedData.ai_source_id,
              event_type: validation.sanitizedData.event_type,
              metadata: sanitizedMetadata.metadata
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
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 6.2.5) Events List API
        if (url.pathname === "/api/events" && req.method === "GET") {
          try {
            const { project_id, limit = "100", offset = "0" } = Object.fromEntries(url.searchParams);
            if (!project_id) {
              const response = new Response("Missing project_id", { status: 400 });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const limitNum = Math.min(parseInt(limit), 1000); // Cap at 1000
            const offsetNum = parseInt(offset);

            const events = await env.OPTIVIEW_DB.prepare(`
              SELECT 
                id, event_type, occurred_at, metadata,
                content_id, ai_source_id
              FROM interaction_events
              WHERE project_id = ?
              ORDER BY occurred_at DESC
              LIMIT ? OFFSET ?
            `).bind(project_id, limitNum, offsetNum).all<any>();

            const response = new Response(JSON.stringify({
              events: events.results || [],
              total: events.results?.length || 0
            }), {
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=60" // 1 min cache
              }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("events_list_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 6.3) Events Summary API
        if (url.pathname === "/api/events/summary" && req.method === "GET") {
          try {
            const { project_id, from, to } = Object.fromEntries(url.searchParams);
            if (!project_id) {
              const response = new Response("missing project_id", { status: 400 });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
              metadata as traffic_class,
              COUNT(*) as count
            FROM interaction_events
            WHERE project_id = ? AND occurred_at BETWEEN ? AND ?
            GROUP BY metadata
            ORDER BY count DESC
          `).bind(project_id, fromTs, toTs).all<any>();

            // Get top AI sources - simplified to avoid JOIN issues
            const topSources = await env.OPTIVIEW_DB.prepare(`
            SELECT 
              ai_source_id,
              COUNT(*) as count
            FROM interaction_events
            WHERE project_id = ? AND occurred_at BETWEEN ? AND ? AND ai_source_id IS NOT NULL
            GROUP BY ai_source_id
            ORDER BY count DESC
            LIMIT 5
          `).bind(project_id, fromTs, toTs).all<any>();

            // Get timeseries data - simplified for D1 compatibility
            const timeseries = await env.OPTIVIEW_DB.prepare(`
            SELECT 
              occurred_at as day,
              COUNT(*) as count,
              metadata as traffic_class
            FROM interaction_events
            WHERE project_id = ? AND occurred_at BETWEEN ? AND ?
            GROUP BY metadata
            ORDER BY occurred_at
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
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("events_summary_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("error_summary_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 6.3.6) API Key Rotation API
        if (url.pathname.match(/^\/api\/keys\/(\d+)\/rotate$/) && req.method === "POST") {
          try {
            const match = url.pathname.match(/^\/api\/keys\/(\d+)\/rotate$/);
            const keyId = parseInt(match![1]);
            const body = await req.json() as any;
            const { immediate = false } = body;

            // Require authentication
            const { user } = await requireAuth(req, env);

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
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
              user.id,
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
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("key_rotation_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 6.3.7) API Key Revoke API
        if (url.pathname.match(/^\/api\/keys\/(\d+)\/revoke$/) && req.method === "POST") {
          try {
            const match = url.pathname.match(/^\/api\/keys\/(\d+)\/revoke$/);
            const keyId = parseInt(match![1]);

            // Require authentication
            const { user } = await requireAuth(req, env);

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
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
              user.id,
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
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("key_revoke_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 6.3.8) Manual Data Purge API (Admin Only)
        if (url.pathname === "/admin/purge" && req.method === "POST") {
          try {
            // Require admin authentication
            const { user } = await requireAdmin(req, env);

            const body = await req.json() as any;
            const { project_id, type, confirm, dry_run = false } = body;

            if (!project_id || !type || confirm !== "DELETE") {
              const response = new Response(JSON.stringify({
                error: "Missing required parameters or invalid confirmation"
              }), { status: 400, headers: { "Content-Type": "application/json" } });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get project settings to determine retention
            const projectSettings = await env.OPTIVIEW_DB.prepare(`
            SELECT retention_days_events, retention_days_referrals, plan_tier
            FROM project_settings 
            WHERE project_id = ?
          `).bind(project_id).first<any>();

            if (!projectSettings) {
              const response = new Response(JSON.stringify({
                error: "Project not found or no settings configured"
              }), { status: 404, headers: { "Content-Type": "application/json" } });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const now = Date.now();
            let deletedEvents = 0;
            let deletedReferrals = 0;

            if (type === "events" || type === "both") {
              const cutoffEvents = now - (projectSettings.retention_days_events * 24 * 60 * 60 * 1000);

              if (dry_run) {
                // Count rows that would be deleted
                const countResult = await env.OPTIVIEW_DB.prepare(`
                SELECT COUNT(*) as count FROM interaction_events 
                WHERE project_id = ? AND occurred_at < ?
              `).bind(project_id, cutoffEvents).first<any>();
                deletedEvents = countResult?.count || 0;
              } else {
                // Actually delete rows
                const deleteResult = await env.OPTIVIEW_DB.prepare(`
                DELETE FROM interaction_events 
                WHERE project_id = ? AND occurred_at < ?
              `).bind(project_id, cutoffEvents).run();
                deletedEvents = deleteResult.meta.changes || 0;
              }
            }

            if (type === "referrals" || type === "both") {
              const cutoffReferrals = now - (projectSettings.retention_days_referrals * 24 * 60 * 60 * 1000);

              if (dry_run) {
                // Count rows that would be deleted
                const countResult = await env.OPTIVIEW_DB.prepare(`
                SELECT COUNT(*) as count FROM ai_referrals ar
                JOIN content_assets ca ON ar.content_id = ca.id
                JOIN properties p ON ca.property_id = p.id
                WHERE p.project_id = ? AND ar.detected_at < ?
              `).bind(project_id, cutoffReferrals).first<any>();
                deletedReferrals = countResult?.count || 0;
              } else {
                // Actually delete rows
                const deleteResult = await env.OPTIVIEW_DB.prepare(`
                DELETE FROM ai_referrals 
                WHERE content_id IN (
                  SELECT ca.id FROM content_assets ca
                  JOIN properties p ON ca.property_id = p.id
                  WHERE p.project_id = ?
                ) AND detected_at < ?
              `).bind(project_id, cutoffReferrals).run();
                deletedReferrals = deleteResult.meta.changes || 0;
              }
            }

            // Log the purge operation
            await env.OPTIVIEW_DB.prepare(`
            INSERT INTO audit_log (user_id, action, subject_type, subject_id, metadata)
            VALUES (?, ?, ?, ?, ?)
          `).bind(
              user.id,
              "purge",
              "project",
              project_id,
              JSON.stringify({
                type,
                dry_run,
                deleted_events: deletedEvents,
                deleted_referrals: deletedReferrals,
                retention_days_events: projectSettings.retention_days_events,
                retention_days_referrals: projectSettings.retention_days_referrals
              })
            ).run();

            const response = new Response(JSON.stringify({
              project_id,
              type,
              dry_run,
              deleted_events: deletedEvents,
              deleted_referrals: deletedReferrals,
              message: dry_run ? "Dry run completed" : "Purge completed successfully"
            }), {
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("manual_purge_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 6.3.9) Install Verification API
        if (url.pathname === "/api/events/last-seen" && req.method === "GET") {
          try {
            const { property_id } = Object.fromEntries(url.searchParams);
            if (!property_id) {
              const response = new Response(JSON.stringify({
                error: "Missing property_id parameter"
              }), { status: 400, headers: { "Content-Type": "application/json" } });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Require authentication
            const { user } = await requireAuth(req, env);

            // Get the most recent event timestamp and counts for this property within last 15 minutes
            const cutoffTime = Date.now() - (15 * 60 * 1000); // 15 minutes ago

            const lastSeenResult = await env.OPTIVIEW_DB.prepare(`
            SELECT 
              ie.occurred_at,
              ie.metadata,
              COUNT(*) as events_15m,
              SUM(CASE WHEN ie.metadata->>'$.ai_class' = 'direct_human' THEN 1 ELSE 0 END) as direct_human,
              SUM(CASE WHEN ie.metadata->>'$.ai_class' = 'human_via_ai' THEN 1 ELSE 0 END) as human_via_ai,
              SUM(CASE WHEN ie.metadata->>'$.ai_class' = 'ai_agent_crawl' THEN 1 ELSE 0 END) as ai_agent_crawl,
              SUM(CASE WHEN ie.metadata->>'$.ai_class' = 'unknown_ai_like' THEN 1 ELSE 0 END) as unknown_ai_like
            FROM interaction_events ie
            JOIN properties p ON ie.content_id IN (
              SELECT id FROM content_assets WHERE property_id = p.id
            )
            WHERE p.id = ? AND ie.occurred_at >= ?
            GROUP BY ie.metadata->>'$.ai_class'
          `).bind(property_id, cutoffTime).all<any>();

            // Get the most recent event timestamp
            const lastEventResult = await env.OPTIVIEW_DB.prepare(`
            SELECT MAX(ie.occurred_at) as last_event_ts
            FROM interaction_events ie
            JOIN properties p ON ie.content_id IN (
              SELECT id FROM content_assets WHERE property_id = p.id
            )
            WHERE p.id = ?
          `).bind(property_id).first<any>();

            // Aggregate the counts
            let totalEvents = 0;
            const byClass: Record<string, number> = {
              direct_human: 0,
              human_via_ai: 0,
              ai_agent_crawl: 0,
              unknown_ai_like: 0
            };

            if (lastSeenResult.results.length > 0) {
              lastSeenResult.results.forEach((row: any) => {
                totalEvents += row.events_15m || 0;
                if (row.direct_human) byClass.direct_human = row.direct_human;
                if (row.human_via_ai) byClass.human_via_ai = row.human_via_ai;
                if (row.ai_agent_crawl) byClass.ai_agent_crawl = row.ai_agent_crawl;
                if (row.unknown_ai_like) byClass.unknown_ai_like = row.unknown_ai_like;
              });
            }

            const lastEventTs = lastEventResult?.last_event_ts || null;

            const verificationData = {
              property_id: parseInt(property_id),
              events_15m: totalEvents,
              by_class_15m: byClass,
              last_event_ts: lastEventTs ? new Date(lastEventTs).toISOString() : null
            };

            const response = new Response(JSON.stringify(verificationData), {
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=10" // 10 second cache for real-time data
              }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("install_verification_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 6.4) Referrals API (with schema validation)
        if (url.pathname === "/api/referrals" && req.method === "POST") {
          try {
            // Check Content-Type
            const contentType = req.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              const response = new Response("Content-Type must be application/json", { status: 415 });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get request body and validate size
            const bodyText = await req.text();
            if (bodyText.length > 1024) {
              const response = new Response(JSON.stringify({
                error: "Request body too large",
                max_size_kb: 1,
                actual_size_kb: Math.round(bodyText.length / 1024)
              }), { status: 413, headers: { "Content-Type": "application/json" } });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Parse and validate body
            const body = JSON.parse(bodyText);
            const validation = validateRequestBody("/api/referrals", body, bodyText.length);

            if (!validation.valid) {
              const response = new Response(JSON.stringify({
                error: "Validation failed",
                details: validation.errors
              }), { status: 400, headers: { "Content-Type": "application/json" } });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("referrals_create_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 6.5) Top Referrals API
        if (url.pathname === "/api/referrals/top" && req.method === "GET") {
          try {
            const { project_id, limit = "10" } = Object.fromEntries(url.searchParams);
            if (!project_id) {
              const response = new Response("missing project_id", { status: 400 });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("referrals_top_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("sources_list_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 6.7) Content API
        if (url.pathname === "/api/content" && req.method === "GET") {
          try {
            const { project_id } = Object.fromEntries(url.searchParams);
            if (!project_id) {
              const response = new Response("missing project_id", { status: 400 });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("content_list_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 6.8) Content POST API (with schema validation)
        if (url.pathname === "/api/content" && req.method === "POST") {
          try {
            // Check Content-Type
            const contentType = req.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              const response = new Response("Content-Type must be application/json", { status: 415 });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get request body and validate size
            const bodyText = await req.text();
            if (bodyText.length > 1024) {
              const response = new Response(JSON.stringify({
                error: "Request body too large",
                max_size_kb: 1,
                actual_size_kb: Math.round(bodyText.length / 1024)
              }), { status: 413, headers: { "Content-Type": "application/json" } });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Parse and validate body
            const body = JSON.parse(bodyText);
            const validation = validateRequestBody("/api/content", body, bodyText.length);

            if (!validation.valid) {
              const response = new Response(JSON.stringify({
                error: "Validation failed",
                details: validation.errors
              }), { status: 400, headers: { "Content-Type": "application/json" } });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
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
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("content_create_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 6.9) Events CSV Export API
        if (url.pathname === "/api/events/export.csv" && req.method === "GET") {
          try {
            // Require authentication
            const { user } = await requireAuth(req, env);

            // Rate limiting for CSV exports (1 req/sec per user)
            const csvRateLimiter = createRateLimiter({ rps: 1, burst: 1, retryAfter: 5 });
            const rateLimitResult = csvRateLimiter.tryConsume(`csv_export_${user.id}`);

            if (!rateLimitResult.allowed) {
              const response = new Response(JSON.stringify({
                error: "Rate limit exceeded for CSV exports",
                retry_after: rateLimitResult.retryAfter
              }), {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": rateLimitResult.retryAfter?.toString() || "5"
                }
              });
              response.headers.set("x-optiview-request-id", crypto.randomUUID());
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const { project_id, from, to, cursor, limit = "10000" } = Object.fromEntries(url.searchParams);
            if (!project_id) {
              const response = new Response("Missing project_id parameter", { status: 400 });
              response.headers.set("x-optiview-request-id", crypto.randomUUID());
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Validate project access
            const project = await env.OPTIVIEW_DB.prepare(`
            SELECT p.id, p.name, ps.xray_trace_enabled
            FROM project p
            LEFT JOIN project_settings ps ON p.id = ps.project_id
            WHERE p.id = ?
          `).bind(project_id).first<any>();

            if (!project) {
              const response = new Response("Project not found", { status: 404 });
              response.headers.set("x-optiview-request-id", crypto.randomUUID());
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Parse date range
            const fromTs = from ? new Date(from).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;
            const toTs = to ? new Date(to).getTime() : Date.now();
            const limitNum = Math.min(parseInt(limit), 10000);

            // Parse cursor for pagination
            let cursorData: { t: number; id: number } | null = null;
            if (cursor) {
              try {
                const decoded = atob(cursor.replace(/-/g, '+').replace(/_/g, '/'));
                cursorData = JSON.parse(decoded);
              } catch (e) {
                const response = new Response("Invalid cursor format", { status: 400 });
                response.headers.set("x-optiview-request-id", crypto.randomUUID());
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
              }
            }

            // Build query with cursor-based pagination
            let query = `
            SELECT 
              ie.occurred_at,
              JSON_EXTRACT(ie.metadata, '$.class') as traffic_class,
              ais.name as ai_source,
              p.domain as property,
              ca.url as content_url,
              ie.event_type
            FROM interaction_events ie
            LEFT JOIN ai_sources ais ON ie.ai_source_id = ais.id
            LEFT JOIN content_assets ca ON ie.content_id = ca.id
            LEFT JOIN properties p ON ca.property_id = p.id
            WHERE ie.project_id = ? AND ie.occurred_at BETWEEN ? AND ?
          `;
            let params = [project_id, fromTs, toTs];

            if (cursorData) {
              query += ` AND (ie.occurred_at > ? OR (ie.occurred_at = ? AND ie.id > ?))`;
              params.push(cursorData.t, cursorData.t, cursorData.id);
            }

            query += ` ORDER BY ie.occurred_at ASC, ie.id ASC LIMIT ?`;
            params.push(limitNum);

            const events = await env.OPTIVIEW_DB.prepare(query).bind(...params).all<any>();

            if (events.results.length === 0) {
              // Return empty CSV with headers
              const csvHeaders = "occurred_at,traffic_class,ai_source,property,content_url,event_type\n";
              const response = new Response(csvHeaders, {
                headers: {
                  "Content-Type": "text/csv; charset=utf-8",
                  "Content-Disposition": `attachment; filename="optiview_events_${new Date(fromTs).toISOString().split('T')[0]}-${new Date(toTs).toISOString().split('T')[0]}.csv"`
                }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Generate next cursor
            const lastEvent = events.results[events.results.length - 1];
            const nextCursor = btoa(JSON.stringify({
              t: lastEvent.occurred_at,
              id: lastEvent.id
            })).replace(/\+/g, '-').replace(/\//g, '_');

            // Convert to CSV
            const csvRows = events.results.map((event: any) => {
              const row = [
                new Date(event.occurred_at).toISOString(),
                event.traffic_class || '',
                event.ai_source || '',
                event.property || '',
                event.content_url || '',
                event.event_type || ''
              ];
              return row.map(field => `"${field.replace(/"/g, '""')}"`).join(',');
            });

            const csvContent = "occurred_at,traffic_class,ai_source,property,content_url,event_type\n" + csvRows.join('\n');

            const response = new Response(csvContent, {
              headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="optiview_events_${new Date(fromTs).toISOString().split('T')[0]}-${new Date(toTs).toISOString().split('T')[0]}.csv"`,
                "x-optiview-next-cursor": nextCursor,
                "x-optiview-total-rows": events.results.length.toString()
              }
            });

            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("events_export_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            response.headers.set("x-optiview-request-id", crypto.randomUUID());
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 6.10) Referrals CSV Export API
        if (url.pathname === "/api/referrals/export.csv" && req.method === "GET") {
          try {
            // Require authentication
            const { user } = await requireAuth(req, env);

            // Rate limiting for CSV exports (1 req/sec per user)
            const csvRateLimiter = createRateLimiter({ rps: 1, burst: 1, retryAfter: 5 });
            const rateLimitResult = csvRateLimiter.tryConsume(`csv_export_${user.id}`);

            if (!rateLimitResult.allowed) {
              const response = new Response(JSON.stringify({
                error: "Rate limit exceeded for CSV exports",
                retry_after: rateLimitResult.retryAfter
              }), {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": rateLimitResult.retryAfter?.toString() || "5"
                }
              });
              response.headers.set("x-optiview-request-id", crypto.randomUUID());
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const { project_id, from, to, cursor, limit = "10000" } = Object.fromEntries(url.searchParams);
            if (!project_id) {
              const response = new Response("Missing project_id parameter", { status: 400 });
              response.headers.set("x-optiview-request-id", crypto.randomUUID());
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Validate project access
            const project = await env.OPTIVIEW_DB.prepare(`
            SELECT p.id, p.name, ps.xray_trace_enabled
            FROM project p
            LEFT JOIN project_settings ps ON p.id = ps.project_id
            WHERE p.id = ?
          `).bind(project_id).first<any>();

            if (!project) {
              const response = new Response("Project not found", { status: 404 });
              response.headers.set("x-optiview-request-id", crypto.randomUUID());
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Parse date range
            const fromTs = from ? new Date(from).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;
            const toTs = to ? new Date(to).getTime() : Date.now();
            const limitNum = Math.min(parseInt(limit), 10000);

            // Parse cursor for pagination
            let cursorData: { t: number; id: number } | null = null;
            if (cursor) {
              try {
                const decoded = atob(cursor.replace(/-/g, '+').replace(/_/g, '/'));
                cursorData = JSON.parse(decoded);
              } catch (e) {
                const response = new Response("Invalid cursor format", { status: 400 });
                response.headers.set("x-optiview-request-id", crypto.randomUUID());
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
              }
            }

            // Build query with cursor-based pagination
            let query = `
            SELECT 
              ar.detected_at,
              ais.name as ai_source,
              ar.ref_type,
              p.domain as property,
              ca.url as content_url
            FROM ai_referrals ar
            LEFT JOIN ai_sources ais ON ar.ai_source_id = ais.id
            LEFT JOIN content_assets ca ON ar.content_id = ca.id
            LEFT JOIN properties p ON ca.property_id = p.id
            WHERE p.project_id = ? AND ar.detected_at BETWEEN ? AND ?
          `;
            let params = [project_id, fromTs, toTs];

            if (cursorData) {
              query += ` AND (ar.detected_at > ? OR (ar.detected_at = ? AND ar.id > ?))`;
              params.push(cursorData.t, cursorData.t, cursorData.id);
            }

            query += ` ORDER BY ar.detected_at ASC, ar.id ASC LIMIT ?`;
            params.push(limitNum);

            const referrals = await env.OPTIVIEW_DB.prepare(query).bind(...params).all<any>();

            if (referrals.results.length === 0) {
              // Return empty CSV with headers
              const csvHeaders = "detected_at,ai_source,ref_type,property,content_url\n";
              const response = new Response(csvHeaders, {
                headers: {
                  "Content-Type": "text/csv; charset=utf-8",
                  "Content-Disposition": `attachment; filename="optiview_referrals_${new Date(fromTs).toISOString().split('T')[0]}-${new Date(toTs).toISOString().split('T')[0]}.csv"`
                }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Generate next cursor
            const lastReferral = referrals.results[referrals.results.length - 1];
            const nextCursor = btoa(JSON.stringify({
              t: lastReferral.detected_at,
              id: lastReferral.id
            })).replace(/\+/g, '-').replace(/\//g, '_');

            // Convert to CSV
            const csvRows = referrals.results.map((referral: any) => {
              const row = [
                new Date(referral.detected_at).toISOString(),
                referral.ai_source || '',
                referral.ref_type || '',
                referral.property || '',
                referral.content_url || ''
              ];
              return row.map(field => `"${field.replace(/"/g, '""')}"`).join(',');
            });

            const csvContent = "detected_at,ai_source,ref_type,property,content_url\n" + csvRows.join('\n');

            const response = new Response(csvContent, {
              headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="optiview_referrals_${new Date(fromTs).toISOString().split('T')[0]}-${new Date(toTs).toISOString().split('T')[0]}.csv"`,
                "x-optiview-next-cursor": nextCursor,
                "x-optiview-total-rows": referrals.results.length.toString()
              }
            });

            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("referrals_export_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            response.headers.set("x-optiview-request-id", crypto.randomUUID());
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }
      }

      // 7) Authentication Routes
      if (url.pathname.startsWith("/auth/")) {
        // 7.1) Request OTP Code
        if (url.pathname === "/auth/request-code" && req.method === "POST") {
          try {
            // Check Content-Type
            const contentType = req.headers.get("content-type") as string;
            if (!contentType || !contentType.includes("application/json")) {
              const response = new Response("Content-Type must be application/json", { status: 415 });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const body = await req.json() as { email: string };
            const { email } = body;

            if (!email) {
              const response = new Response(JSON.stringify({ error: "Email is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Normalize and validate email
            const normalizedEmail = normalizeEmail(email);
            if (!normalizedEmail) {
              const response = new Response(JSON.stringify({ error: "Invalid email format" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Rate limiting by IP
            const clientIP = getClientIP(req);
            const loginRateLimiter = createRateLimiter({
              rps: parseInt(env.LOGIN_RPM_PER_IP || "10") / 60,
              burst: 1,
              retryAfter: 60
            });
            const rateLimitResult = loginRateLimiter.tryConsume(`login_ip_${clientIP}`);

            if (!rateLimitResult.allowed) {
              const response = new Response(JSON.stringify({
                error: "Rate limit exceeded",
                retry_after: rateLimitResult.retryAfter
              }), {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": rateLimitResult.retryAfter?.toString() || "60"
                }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Rate limiting by email per day
            const emailRateLimiter = createRateLimiter({
              rps: parseInt(env.LOGIN_RPD_PER_EMAIL || "50") / 86400,
              burst: 1,
              retryAfter: 86400
            });
            const emailRateLimitResult = emailRateLimiter.tryConsume(`login_email_${normalizedEmail}`);

            if (!emailRateLimitResult.allowed) {
              const response = new Response(JSON.stringify({
                error: "Too many requests for this email",
                retry_after: emailRateLimitResult.retryAfter
              }), {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": emailRateLimitResult.retryAfter?.toString() || "86400"
                }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get or create user
            if (!normalizedEmail) {
              const response = new Response(JSON.stringify({ error: "Invalid email format" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // @ts-ignore - normalizedEmail is checked above
            const user = await getOrCreateUser(env, normalizedEmail);

            // Generate OTP code
            const otpCode = generateOTPCode();
            const otpHash = await hashSensitiveData(otpCode);
            const expiresAt = generateOTPExpiry(parseInt(env.OTP_EXP_MIN || "10"));
            const ipHash = await hashSensitiveData(clientIP);

            // Store OTP code
            await env.OPTIVIEW_DB.prepare(`
            INSERT INTO login_code (email, code_hash, created_at, expires_at, requester_ip_hash)
            VALUES (?, ?, datetime('now'), ?, ?)
          `).bind(normalizedEmail, otpHash, expiresAt.toISOString(), ipHash).run();

            // Send email
            const emailService = EmailService.fromEnv(env);
            // @ts-ignore - normalizedEmail is checked above
            const htmlContent = emailService.generateOTPEmailHTML(normalizedEmail, otpCode, parseInt(env.OTP_EXP_MIN || "10"));
            // @ts-ignore - normalizedEmail is checked above
            const textContent = emailService.generateOTPEmailText(normalizedEmail, otpCode, parseInt(env.OTP_EXP_MIN || "10"));

            await emailService.sendEmail({
              // @ts-ignore - normalizedEmail is checked above
              to: normalizedEmail,
              subject: "Your Optiview Login Code",
              html: htmlContent,
              text: textContent
            });

            // Log the request (without the actual code)
            log("otp_requested", {
              email_hash: await hashSensitiveData(normalizedEmail),
              ip_hash: ipHash,
              user_id: user.id
            });

            // Always return success (no user enumeration)
            const response = new Response(JSON.stringify({ ok: true }), {
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

          } catch (e: any) {
            log("otp_request_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({ ok: true }), { // Still no user enumeration
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 7.2) Verify OTP Code
        if (url.pathname === "/auth/verify-code" && req.method === "POST") {
          try {
            // Check Content-Type
            const contentType = req.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              const response = new Response("Content-Type must be application/json", { status: 415 });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const body = await req.json() as { email: string; code: string };
            const { email, code } = body;

            if (!email || !code) {
              const response = new Response(JSON.stringify({ error: "Email and code are required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Normalize email
            const normalizedEmail = normalizeEmail(email);
            if (!normalizedEmail) {
              const response = new Response(JSON.stringify({ error: "Invalid email format" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Find the latest unconsumed code for this email
            const loginCode = await env.OPTIVIEW_DB.prepare(`
            SELECT * FROM login_code 
            WHERE email = ? AND consumed_at IS NULL
            ORDER BY created_at DESC 
            LIMIT 1
          `).bind(normalizedEmail).first<any>();

            if (!loginCode) {
              const response = new Response(JSON.stringify({ error: "Invalid or expired code" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check if code is expired
            if (new Date(loginCode.expires_at) < new Date()) {
              const response = new Response(JSON.stringify({ error: "Invalid or expired code" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check if code is locked
            if (loginCode.attempts >= 5) {
              const response = new Response(JSON.stringify({ error: "Code is locked due to too many attempts" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Verify code hash
            const codeHash = await hashSensitiveData(code);
            if (codeHash !== loginCode.code_hash) {
              // Increment attempts
              await env.OPTIVIEW_DB.prepare(`
              UPDATE login_code SET attempts = attempts + 1 WHERE id = ?
            `).bind(loginCode.id).run();

              // Log failed attempt
              log("otp_verification_failed", {
                email_hash: await hashSensitiveData(normalizedEmail),
                ip_hash: await hashSensitiveData(getClientIP(req)),
                attempts: loginCode.attempts + 1
              });

              const response = new Response(JSON.stringify({ error: "Invalid or expired code" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Code is valid - mark as consumed
            await env.OPTIVIEW_DB.prepare(`
            UPDATE login_code SET consumed_at = datetime('now') WHERE id = ?
          `).bind(loginCode.id).run();

            // Get or create user
            const user = await getOrCreateUser(env, normalizedEmail);

            // Create session
            const sessionId = await createSession(env, user.id, req, parseInt(env.SESSION_TTL_HOURS || "720"));

            // Set session cookie
            const response = new Response(JSON.stringify({ ok: true }), {
              headers: { "Content-Type": "application/json" }
            });

            setSessionCookie(response, sessionId, parseInt(env.SESSION_TTL_HOURS || "720") * 3600);

            // Log successful login
            log("otp_verification_success", {
              email_hash: await hashSensitiveData(normalizedEmail),
              ip_hash: await hashSensitiveData(getClientIP(req)),
              user_id: user.id
            });

            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

          } catch (e: any) {
            log("otp_verification_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({ error: "Internal server error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 7.3) Request Magic Link
        if (url.pathname === "/auth/request-link" && req.method === "POST") {
          try {
            // Check Content-Type
            const contentType = req.headers.get("content-type") as string;
            if (!contentType || !contentType.includes("application/json")) {
              const response = new Response("Content-Type must be application/json", { status: 415 });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const body = await req.json() as { email: string; continue_path?: string };
            const { email, continue_path } = body;

            if (!email) {
              const response = new Response(JSON.stringify({ error: "Email is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Normalize and validate email
            const normalizedEmail = normalizeEmail(email);
            if (!normalizedEmail) {
              const response = new Response(JSON.stringify({ error: "Invalid email format" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Validate continue path
            const validatedPath = validateContinuePath(continue_path || '/onboarding');

            // Rate limiting by IP
            const clientIP = getClientIP(req);
            const magicLinkRateLimiter = createRateLimiter({
              rps: parseInt(env.MAGIC_LINK_RPM_PER_IP || "10") / 60,
              burst: 1,
              retryAfter: 60
            });
            const rateLimitResult = magicLinkRateLimiter.tryConsume(`magic_link_ip_${clientIP}`);

            if (!rateLimitResult.allowed) {
              const response = new Response(JSON.stringify({
                error: "Rate limit exceeded",
                retry_after: rateLimitResult.retryAfter
              }), {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": rateLimitResult.retryAfter?.toString() || "60"
                }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Rate limiting by email per day
            const emailRateLimiter = createRateLimiter({
              rps: parseInt(env.MAGIC_LINK_RPD_PER_EMAIL || "50") / 86400,
              burst: 1,
              retryAfter: 86400
            });
            const emailRateLimitResult = emailRateLimiter.tryConsume(`magic_link_email_${normalizedEmail}`);

            if (!emailRateLimitResult.allowed) {
              const response = new Response(JSON.stringify({
                error: "Too many requests for this email",
                retry_after: emailRateLimitResult.retryAfter
              }), {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": emailRateLimitResult.retryAfter?.toString() || "86400"
                }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get or create user
            const user = await getOrCreateUser(env, normalizedEmail);

            // Generate magic link token
            const token = generateMagicLinkToken();
            const tokenHash = await hashSensitiveData(token);
            const expiresAt = generateMagicLinkExpiry(parseInt(env.MAGIC_LINK_EXP_MIN || "15"));
            const ipHash = await hashSensitiveData(clientIP);

            // Store magic link
            await env.OPTIVIEW_DB.prepare(`
              INSERT INTO magic_link (email, token_hash, created_at, expires_at, requester_ip_hash, continue_path)
              VALUES (?, ?, datetime('now'), ?, ?, ?)
            `).bind(normalizedEmail, tokenHash, expiresAt.toISOString(), ipHash, validatedPath).run();

            // Send email
            const emailService = EmailService.fromEnv(env);
            const magicLinkUrl = `${env.PUBLIC_APP_URL || 'http://localhost:3000'}/auth/magic?token=${token}&continue=${encodeURIComponent(validatedPath)}`;

            const htmlContent = emailService.generateMagicLinkEmailHTML(normalizedEmail, magicLinkUrl, parseInt(env.MAGIC_LINK_EXP_MIN || "15"));
            const textContent = emailService.generateMagicLinkEmailText(normalizedEmail, magicLinkUrl, parseInt(env.MAGIC_LINK_EXP_MIN || "15"));

            await emailService.sendEmail({
              to: normalizedEmail,
              subject: "Sign in to Optiview",
              html: htmlContent,
              text: textContent
            });

            // Log the request (without the actual token)
            log("magic_link_requested", {
              email_hash: await hashSensitiveData(normalizedEmail),
              ip_hash: ipHash,
              user_id: user.id
            });

            // Always return success (no user enumeration)
            const response = new Response(JSON.stringify({ ok: true }), {
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

          } catch (e: any) {
            log("magic_link_request_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({ ok: true }), { // Still no user enumeration
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 7.4) Consume Magic Link
        if (url.pathname === "/auth/magic" && req.method === "GET") {
          try {
            const urlObj = new URL(req.url);
            const token = urlObj.searchParams.get('token');
            const continuePath = urlObj.searchParams.get('continue') || '/onboarding';

            if (!token) {
              const response = new Response(JSON.stringify({ error: "Token is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Find the magic link
            const tokenHash = await hashSensitiveData(token);
            const magicLink = await env.OPTIVIEW_DB.prepare(`
              SELECT * FROM magic_link 
              WHERE token_hash = ? AND consumed_at IS NULL
              ORDER BY created_at DESC 
              LIMIT 1
            `).bind(tokenHash).first<any>();

            if (!magicLink) {
              const response = new Response(JSON.stringify({ error: "Invalid or expired link" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check if link is expired
            if (new Date(magicLink.expires_at) < new Date()) {
              const response = new Response(JSON.stringify({ error: "Link has expired" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Mark as consumed
            await env.OPTIVIEW_DB.prepare(`
              UPDATE magic_link SET consumed_at = datetime('now') WHERE id = ?
            `).bind(magicLink.id).run();

            // Get or create user
            const user = await getOrCreateUser(env, magicLink.email);

            // Create session
            const sessionId = await createSession(env, user.id, req, parseInt(env.SESSION_TTL_HOURS || "720"));

            // Set session cookie and redirect
            const response = new Response(JSON.stringify({
              ok: true,
              redirect_to: magicLink.continue_path || '/onboarding'
            }), {
              headers: { "Content-Type": "application/json" }
            });

            setSessionCookie(response, sessionId, parseInt(env.SESSION_TTL_HOURS || "720") * 3600);

            // Log successful magic link usage
            log("magic_link_consumed", {
              email_hash: await hashSensitiveData(magicLink.email),
              user_id: user.id
            });

            // Track metrics
            metrics.record({
              keyId: undefined,
              projectId: undefined,
              latencyMs: Date.now() - Date.now(), // Will be calculated properly
              ok: true,
              error: undefined
            });

            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

          } catch (e: any) {
            log("magic_link_consumption_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({ error: "Internal server error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 7.5) Logout
        if (url.pathname === "/auth/logout" && req.method === "POST") {
          try {
            const sessionId = req.headers.get('cookie')?.split(';')
              .find(c => c.trim().startsWith('ov_sess='))
              ?.split('=')[1];

            if (sessionId) {
              await deleteSession(env, sessionId);
            }

            const response = new Response(JSON.stringify({ ok: true }), {
              headers: { "Content-Type": "application/json" }
            });

            clearSessionCookie(response);
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

          } catch (e: any) {
            log("logout_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({ error: "Internal server error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 7.4) Get current user
        if (url.pathname === "/auth/me" && req.method === "GET") {
          try {
            const { user } = await requireAuth(req, env);

            const response = new Response(JSON.stringify({
              id: user.id,
              email: user.email,
              is_admin: user.is_admin === 1
            }), {
              headers: { "Content-Type": "application/json" }
            });

            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

          } catch (e: any) {
            const response = new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 7.6) Invite Routes
        if (url.pathname.startsWith("/onboarding/invites") && req.method === "POST") {
          try {
            // Require authentication
            const { user } = await requireAuth(req, env);

            // Check Content-Type
            const contentType = req.headers.get("content-type") as string;
            if (!contentType || !contentType.includes("application/json")) {
              const response = new Response("Content-Type must be application/json", { status: 415 });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const body = await req.json() as { email: string; role?: string; org_id: number };
            const { email, role = 'member', org_id } = body;

            if (!email || !org_id) {
              const response = new Response(JSON.stringify({ error: "Email and org_id are required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Normalize and validate email
            const normalizedEmail = normalizeEmail(email);
            if (!normalizedEmail) {
              const response = new Response(JSON.stringify({ error: "Invalid email format" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Validate role
            if (!['owner', 'member'].includes(role)) {
              const response = new Response(JSON.stringify({ error: "Invalid role" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check if user is member of the org
            const userMembership = await env.OPTIVIEW_DB.prepare(`
            SELECT role FROM org_members WHERE org_id = ? AND user_id = ?
          `).bind(org_id, user.id).first<any>();

            if (!userMembership) {
              const response = new Response(JSON.stringify({ error: "Not a member of this organization" }), {
                status: 403,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check permissions: owners can invite owners, members can only invite members
            if (role === 'owner' && userMembership.role !== 'owner') {
              const response = new Response(JSON.stringify({ error: "Only owners can invite other owners" }), {
                status: 403,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check for existing pending invite
            const existingInvite = await env.OPTIVIEW_DB.prepare(`
            SELECT * FROM invites WHERE org_id = ? AND email = ? AND accepted_at IS NULL
          `).bind(org_id, normalizedEmail).first<any>();

            if (existingInvite) {
              // Update existing invite instead of creating new one
              const token = generateMagicLinkToken(); // Reuse magic link token generation
              const tokenHash = await hashSensitiveData(token);
              const expiresAt = new Date(Date.now() + parseInt(env.INVITE_EXP_DAYS || "7") * 24 * 60 * 60 * 1000);

              await env.OPTIVIEW_DB.prepare(`
              UPDATE invites SET 
                token_hash = ?, 
                expires_at = ?, 
                role = ?,
                invited_by_user_id = ?
              WHERE id = ?
            `).bind(tokenHash, expiresAt.toISOString(), role, user.id, existingInvite.id).run();

              // Send email
              const emailService = EmailService.fromEnv(env);
              const inviteUrl = `${env.PUBLIC_APP_URL || 'http://localhost:3000'}/invite/accept?token=${token}`;

              const htmlContent = emailService.generateInviteEmailHTML(
                normalizedEmail,
                inviteUrl,
                user.email,
                'Your Organization', // TODO: Get actual org name
                role,
                parseInt(env.INVITE_EXP_DAYS || "7")
              );
              const textContent = emailService.generateInviteEmailText(
                normalizedEmail,
                inviteUrl,
                user.email,
                'Your Organization', // TODO: Get actual org name
                role,
                parseInt(env.INVITE_EXP_DAYS || "7")
              );

              await emailService.sendEmail({
                to: normalizedEmail,
                subject: "You're invited to join Optiview",
                html: htmlContent,
                text: textContent
              });

              const response = new Response(JSON.stringify({
                ok: true,
                message: "Invitation updated and sent"
              }), {
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Create new invite
            const token = generateMagicLinkToken();
            const tokenHash = await hashSensitiveData(token);
            const expiresAt = new Date(Date.now() + parseInt(env.INVITE_EXP_DAYS || "7") * 24 * 60 * 60 * 1000);

            await env.OPTIVIEW_DB.prepare(`
            INSERT INTO invites (org_id, email, token_hash, role, invited_by_user_id, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(org_id, normalizedEmail, tokenHash, role, user.id, expiresAt.toISOString()).run();

            // Send email
            const emailService = EmailService.fromEnv(env);
            const inviteUrl = `${env.PUBLIC_APP_URL || 'http://localhost:3000'}/invite/accept?token=${token}`;

            const htmlContent = emailService.generateInviteEmailHTML(
              normalizedEmail,
              inviteUrl,
              user.email,
              'Your Organization', // TODO: Get actual org name
              role,
              parseInt(env.INVITE_EXP_DAYS || "7")
            );
            const textContent = emailService.generateInviteEmailText(
              normalizedEmail,
              inviteUrl,
              user.email,
              'Your Organization', // TODO: Get actual org name
              role,
              parseInt(env.INVITE_EXP_DAYS || "7")
            );

            await emailService.sendEmail({
              to: normalizedEmail,
              subject: "You're invited to join Optiview",
              html: htmlContent,
              text: textContent
            });

            const response = new Response(JSON.stringify({
              ok: true,
              message: "Invitation sent successfully"
            }), {
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

          } catch (e: any) {
            log("invite_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({ error: "Internal server error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 7.7) Accept Invite
        if (url.pathname === "/invite/accept" && req.method === "GET") {
          try {
            const urlObj = new URL(req.url);
            const token = urlObj.searchParams.get('token');

            if (!token) {
              const response = new Response(JSON.stringify({ error: "Token is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Find the invite
            const tokenHash = await hashSensitiveData(token);
            const invite = await env.OPTIVIEW_DB.prepare(`
            SELECT * FROM invites 
            WHERE token_hash = ? AND accepted_at IS NULL
            ORDER BY created_at DESC 
            LIMIT 1
          `).bind(tokenHash).first<any>();

            if (!invite) {
              const response = new Response(JSON.stringify({ error: "Invalid or expired invitation" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check if invite is expired
            if (new Date(invite.expires_at) < new Date()) {
              const response = new Response(JSON.stringify({ error: "Invitation has expired" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Mark as accepted
            await env.OPTIVIEW_DB.prepare(`
            UPDATE invites SET accepted_at = datetime('now') WHERE id = ?
          `).bind(invite.id).run();

            // Get or create user
            const user = await getOrCreateUser(env, invite.email);

            // Add user to organization
            await env.OPTIVIEW_DB.prepare(`
            INSERT OR IGNORE INTO org_members (org_id, user_id, role)
            VALUES (?, ?, ?)
          `).bind(invite.org_id, user.id, invite.role).run();

            // Create session
            const sessionId = await createSession(env, user.id, req, parseInt(env.SESSION_TTL_HOURS || "720"));

            // Set session cookie and redirect
            const response = new Response(JSON.stringify({
              ok: true,
              redirect_to: '/onboarding' // Always redirect to onboarding for new users
            }), {
              headers: { "Content-Type": "application/json" }
            });

            setSessionCookie(response, sessionId, parseInt(env.SESSION_TTL_HOURS || "720") * 3600);

            // Log successful invite acceptance
            log("invite_accepted", {
              email_hash: await hashSensitiveData(invite.email),
              user_id: user.id,
              org_id: invite.org_id
            });

            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

          } catch (e: any) {
            log("invite_acceptance_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({ error: "Internal server error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }
      }

      // 8) Admin Routes
      if (url.pathname.startsWith("/admin/")) {
        // 8.1) Admin Bootstrap (only when no admin exists)
        if (url.pathname === "/admin/bootstrap" && req.method === "POST") {
          try {
            // Rate limiting for bootstrap (3 attempts/hour)
            const bootstrapRateLimiter = createRateLimiter({ rps: 3 / 3600, burst: 1, retryAfter: 3600 });
            const clientIP = getClientIP(req);
            const rateLimitResult = bootstrapRateLimiter.tryConsume(`bootstrap_${clientIP}`);

            if (!rateLimitResult.allowed) {
              const response = new Response(JSON.stringify({
                error: "Rate limit exceeded for bootstrap",
                retry_after: rateLimitResult.retryAfter
              }), {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": rateLimitResult.retryAfter?.toString() || "3600"
                }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check if ADMIN_BOOTSTRAP_EMAIL is configured
            const bootstrapEmail = env.ADMIN_BOOTSTRAP_EMAIL;
            if (!bootstrapEmail) {
              const response = new Response(JSON.stringify({
                error: "Bootstrap not configured"
              }), { status: 403, headers: { "Content-Type": "application/json" } });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Attempt to bootstrap admin
            const adminUser = await bootstrapAdmin(env, bootstrapEmail);
            if (!adminUser) {
              const response = new Response(JSON.stringify({
                error: "Admin already exists"
              }), { status: 409, headers: { "Content-Type": "application/json" } });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const response = new Response(JSON.stringify({
              message: "Admin user bootstrapped successfully",
              user: {
                id: adminUser.id,
                email: adminUser.email,
                is_admin: true
              }
            }), {
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

          } catch (e: any) {
            log("admin_bootstrap_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 8.2) Admin Rules Management API
        if (url.pathname === "/admin/rules" && req.method === "GET") {
          try {
            // Require admin authentication
            const { user } = await requireAdmin(req, env);

            // Get current rules manifest from KV
            const manifest = await env.AI_FINGERPRINTS.get("rules:manifest", "json");

            if (!manifest) {
              // Return default manifest if none exists
              const defaultManifest = {
                version: 1,
                ua_list: [],
                heuristics: {
                  referer_contains: [],
                  headers: []
                },
                updated_at: new Date().toISOString(),
                updated_by: "system"
              };

              // Store default manifest
              await env.AI_FINGERPRINTS.put("rules:manifest", JSON.stringify(defaultManifest));

              const response = new Response(JSON.stringify(defaultManifest), {
                headers: { "Content-Type": "application/json" }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const response = new Response(JSON.stringify(manifest), {
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("admin_rules_get_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        if (url.pathname === "/admin/rules" && req.method === "POST") {
          try {
            // Require admin authentication
            const { user } = await requireAdmin(req, env);

            // Rate limiting for admin routes (30 rpm per IP)
            const adminRateLimiter = createRateLimiter({ rps: 0.5, burst: 1, retryAfter: 60 });
            const clientIP = req.headers.get("cf-connecting-ip") || "unknown";
            const rateLimitResult = adminRateLimiter.tryConsume(`admin_${clientIP}`);

            if (!rateLimitResult.allowed) {
              const response = new Response(JSON.stringify({
                error: "Rate limit exceeded for admin routes",
                retry_after: rateLimitResult.retryAfter
              }), {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": rateLimitResult.retryAfter?.toString() || "60"
                }
              });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check Content-Type
            const contentType = req.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              const response = new Response("Content-Type must be application/json", { status: 415 });
              return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const body = await req.json() as any;

            // Get current manifest
            const currentManifest = (await env.AI_FINGERPRINTS.get("rules:manifest", "json") as {
              version: number;
              ua_list: any[];
              heuristics: {
                referer_contains: any[];
                headers: any[];
              };
              updated_at: string;
              updated_by: string;
            }) || {
              version: 0,
              ua_list: [],
              heuristics: {
                referer_contains: [],
                headers: []
              },
              updated_at: new Date(0).toISOString(),
              updated_by: "system"
            };

            // Merge new rules with current
            const mergedManifest = {
              ...currentManifest,
              ...body,
              version: currentManifest.version + 1,
              updated_at: new Date().toISOString(),
              updated_by: user.id
            };

            // Store updated manifest
            await env.AI_FINGERPRINTS.put("rules:manifest", JSON.stringify(mergedManifest));

            // Update in-memory cache (if we had one)
            // For now, the classifier will reload on next request

            const response = new Response(JSON.stringify(mergedManifest), {
              headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          } catch (e: any) {
            log("admin_rules_post_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
              error: "Internal server error",
              message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }

        // 8.3) Admin Environment Check
        if (url.pathname === "/admin/env-check" && req.method === "GET") {
          try {
            // Require admin authentication
            const { user } = await requireAdmin(req, env);

            // Check required environment variables
            const requiredEnvVars = [
              'SESSION_SECRET',
              'COOKIE_NAME',
              'SESSION_TTL_HOURS',
              'OTP_EXP_MIN',
              'LOGIN_RPM_PER_IP',
              'LOGIN_RPD_PER_EMAIL',
              'ADMIN_RPM_PER_IP',
              'PUBLIC_BASE_URL'
            ];

            const envStatus = requiredEnvVars.map(varName => ({
              name: varName,
              present: !!env[varName],
              value: env[varName] ? '***REDACTED***' : 'MISSING'
            }));

            const missingVars = envStatus.filter(status => !status.present);
            const status = missingVars.length === 0 ? 'healthy' : 'missing_vars';

            const response = new Response(JSON.stringify({
              status,
              timestamp: new Date().toISOString(),
              environment: env.ENVIRONMENT || 'production',
              variables: envStatus,
              missing_count: missingVars.length,
              total_required: requiredEnvVars.length
            }), {
              headers: { "Content-Type": "application/json" }
            });

            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

          } catch (e: any) {
            const response = new Response(JSON.stringify({
              error: "Unauthorized",
              message: e.message
            }), { status: 401, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
          }
        }
      }

      // Default response - continue to origin
      const response = new Response("not found", { status: 404 });
      return addBasicSecurityHeaders(addCorsHeaders(response, origin));
    }

    // Fallback response for any unmatched routes
    const fallbackResponse = new Response("Not Found", { status: 404 });
    return addBasicSecurityHeaders(addCorsHeaders(fallbackResponse, origin));
  } catch (error) {
    log("worker_fatal_error", { error: String(error), stack: error instanceof Error ? error.stack : undefined });
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
  }
},

  // Cron job for refreshing fingerprints and retention purging
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

  // Daily retention purge at 03:10 UTC
  if (event.cron === "10 3 * * *") {
    try {
      await runRetentionPurge(env);

      // Store last run timestamp in KV for health monitoring
      await env.AI_FINGERPRINTS.put("cron:last_run_ts", Date.now().toString());

      log("retention_purge_completed", { timestamp: Date.now() });
    } catch (error) {
      log("retention_purge_error", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Demo data generation every minute (for testing)
  if (event.cron === "* * * * *") {
    try {
      // Check if demo mode is enabled
      const demoMode = await env.AI_FINGERPRINTS.get("demo:enabled", "json");
      if (demoMode) {
        // await generateSyntheticEvents(env.OPTIVIEW_DB);
        log("demo_data_generated", { timestamp: Date.now() });
      }
    } catch (error) {
      log("demo_data_generation_error", {
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
    // Add ruleset version to metadata
    const metadataWithVersion = {
      ...event.metadata,
      ruleset_version: getCurrentRulesetVersion()
    };

    const result = await env.OPTIVIEW_DB.prepare(`
      INSERT INTO interaction_events (project_id, content_id, ai_source_id, event_type, metadata, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      event.project_id,
      event.content_id,
      event.ai_source_id,
      event.event_type,
      JSON.stringify(metadataWithVersion),
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

// Retention purge job for cleaning up old data
async function runRetentionPurge(env: Env) {
  const startTime = Date.now();
  let totalDeletedEvents = 0;
  let totalDeletedReferrals = 0;
  let projectsProcessed = 0;
  let projectsWithErrors = 0;

  try {
    // Get all project settings
    const projects = await env.OPTIVIEW_DB.prepare(`
      SELECT project_id, retention_days_events, retention_days_referrals, plan_tier
      FROM project_settings
    `).all<any>();

    for (const project of projects.results) {
      try {
        const now = Date.now();
        let projectDeletedEvents = 0;
        let projectDeletedReferrals = 0;

        // Purge old events
        const cutoffEvents = now - (project.retention_days_events * 24 * 60 * 60 * 1000);
        let affectedRows = 1;
        let maxLoops = 100; // Safety guard

        while (affectedRows > 0 && maxLoops > 0) {
          const result = await env.OPTIVIEW_DB.prepare(`
            DELETE FROM interaction_events 
            WHERE project_id = ? AND occurred_at < ? 
            LIMIT 1000
          `).bind(project.project_id, cutoffEvents).run();

          affectedRows = result.meta.changes || 0;
          projectDeletedEvents += affectedRows;
          maxLoops--;
        }

        // Purge old referrals
        const cutoffReferrals = now - (project.retention_days_referrals * 24 * 60 * 60 * 1000);
        affectedRows = 1;
        maxLoops = 100; // Safety guard

        while (affectedRows > 0 && maxLoops > 0) {
          const result = await env.OPTIVIEW_DB.prepare(`
            DELETE FROM ai_referrals 
            WHERE content_id IN (
              SELECT ca.id FROM content_assets ca
              JOIN properties p ON ca.property_id = p.id
              WHERE p.project_id = ?
            ) AND detected_at < ?
            LIMIT 1000
          `).bind(project.project_id, cutoffReferrals).run();

          affectedRows = result.meta.changes || 0;
          projectDeletedReferrals += affectedRows;
          maxLoops--;
        }

        totalDeletedEvents += projectDeletedEvents;
        totalDeletedReferrals += projectDeletedReferrals;
        projectsProcessed++;

        // Log per-project purge results
        if (projectDeletedEvents > 0 || projectDeletedReferrals > 0) {
          log("project_purge_completed", {
            project_id: project.project_id,
            deleted_events: projectDeletedEvents,
            deleted_referrals: projectDeletedReferrals,
            retention_days_events: project.retention_days_events,
            retention_days_referrals: project.retention_days_referrals,
            plan_tier: project.plan_tier
          });
        }

      } catch (error) {
        projectsWithErrors++;
        log("project_purge_error", {
          project_id: project.project_id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const duration = Date.now() - startTime;

    // Log summary
    log("retention_purge_summary", {
      projects_processed: projectsProcessed,
      projects_with_errors: projectsWithErrors,
      total_deleted_events: totalDeletedEvents,
      total_deleted_referrals: totalDeletedReferrals,
      duration_ms: duration
    });

    // Send Slack alert if deletions occurred and webhook is configured
    if ((totalDeletedEvents > 0 || totalDeletedReferrals > 0) && env.SLACK_WEBHOOK_URL) {
      try {
        const alerts = SlackAlerts.getInstance();
        await alerts.postAlert({
          dedupeKey: 'retention_purge_summary',
          message: `Retention purge completed: ${totalDeletedEvents} events, ${totalDeletedReferrals} referrals deleted across ${projectsProcessed} projects in ${duration}ms`
        });
      } catch (slackError) {
        log("slack_alert_error", { error: String(slackError) });
      }
    }

  } catch (error) {
    log("retention_purge_fatal_error", {
      error: error instanceof Error ? error.message : String(error),
      projects_processed: projectsProcessed,
      total_deleted_events: totalDeletedEvents,
      total_deleted_referrals: totalDeletedReferrals
    });
    throw error;
  }
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
  // Environment variables
  SESSION_SECRET?: string;
  COOKIE_NAME?: string;
  SESSION_TTL_HOURS?: string;
  OTP_EXP_MIN?: string;
  LOGIN_RPM_PER_IP?: string;
  LOGIN_RPD_PER_EMAIL?: string;
  ADMIN_RPM_PER_IP?: string;
  ADMIN_BOOTSTRAP_EMAIL?: string;
  PUBLIC_BASE_URL?: string;
  PUBLIC_APP_URL?: string;
  ENVIRONMENT?: string;
  SLACK_WEBHOOK_URL?: string;
  DEV_MAIL_ECHO?: string;
  EMAIL_FROM?: string;
  EMAIL_SENDER_NAME?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  MAGIC_LINK_EXP_MIN?: string;
  MAGIC_LINK_RPM_PER_IP?: string;
  MAGIC_LINK_RPD_PER_EMAIL?: string;
  INVITE_EXP_DAYS?: string;
  [key: string]: any; // Allow indexing with string keys
};

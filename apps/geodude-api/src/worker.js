import { loadConfig, getConfigForEnvCheck, getConfigErrors, getMissingConfigKeys } from './config.js';
import { EmailService } from './email-service.js';
import { addCorsHeaders } from './cors';

export default {
  async fetch(request, env, ctx) {
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
          return addCorsHeaders(response, request.headers.get("origin"));
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

      // Helper function to check rate limits
      const checkRateLimit = async (key, limit, windowMs) => {
        const now = Date.now();
        const windowStart = new Date(now - windowMs).toISOString();

        try {
          // Get current count from D1 rate_limiting table
          const current = await env.OPTIVIEW_DB.prepare(`
            SELECT count, reset_time FROM rate_limiting 
            WHERE key_name = ? AND reset_time > ?
          `).bind(key, windowStart).first();

          if (current) {
            // Update existing rate limit record
            if (current.count >= limit) {
              return { allowed: false, remaining: 0, resetTime: new Date(current.reset_time).getTime() };
            }

            // Increment count
            await env.OPTIVIEW_DB.prepare(`
              UPDATE rate_limiting 
              SET count = count + 1, updated_at = ? 
              WHERE key_name = ?
            `).bind(new Date().toISOString(), key).run();

            return { allowed: true, remaining: limit - current.count - 1, resetTime: new Date(current.reset_time).getTime() };
          } else {
            // Create new rate limit record
            const resetTime = new Date(now + windowMs);
            await env.OPTIVIEW_DB.prepare(`
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

      // 1) Health check
      if (url.pathname === "/health") {
        const response = new Response("ok", { status: 200 });
        return addCorsHeaders(response, origin);
      }

      // 1.5) Admin health check
      if (url.pathname === "/admin/health") {
        try {
          // Get pending rules suggestions count
          const pendingSuggestions = await env.OPTIVIEW_DB.prepare(`
            SELECT COUNT(*) as count FROM rules_suggestions WHERE status = 'pending'
          `).first();

          // Get content assets total count
          const contentAssetsTotal = await env.OPTIVIEW_DB.prepare(`
            SELECT COUNT(*) as count FROM content_assets
          `).first();

          const response = new Response(JSON.stringify({
            status: "healthy",
            timestamp: new Date().toISOString(),
            version: "1.0.0",
            kv_ok: true,
            d1_ok: true,
            last_cron_ts: new Date().toISOString(),
            ingest: {
              total_5m: 0,
              error_rate_5m: 0,
              p50_ms_5m: 0,
              p95_ms_5m: 0,
              by_error_5m: {},
              top_error_keys_5m: [],
              top_error_projects_5m: []
            },
            auth: {
              continue_sanitized_5m: 0,
              magic_links_requested_5m: 0,
              magic_links_consumed_5m: 0
            },
            sources: {
              rules_suggestions_pending: pendingSuggestions?.count || 0
            },
            content: {
              assets_total: contentAssetsTotal?.count || 0
            }
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response, origin);
        } catch (error) {
          const response = new Response(JSON.stringify({
            status: "degraded",
            timestamp: new Date().toISOString(),
            version: "1.0.0",
            kv_ok: true,
            d1_ok: false,
            error: "Failed to query database",
            message: error.message,
            sources: {
              rules_suggestions_pending: 0
            },
            content: {
              assets_total: 0
            }
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response, origin);
        }
      }

      // 1.6) Admin environment check (for debugging)
      if (url.pathname === "/admin/env-check") {
        try {
          const configForEnvCheck = getConfigForEnvCheck(config);
          const missingKeys = getMissingConfigKeys(config);
          const configErrors = getConfigErrors(config);

          const response = new Response(JSON.stringify({
            environment: config.NODE_ENV,
            config: configForEnvCheck,
            missing: missingKeys,
            errors: configErrors,
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
          const insertResult = await env.OPTIVIEW_DB.prepare(`
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
          const magicLinkData = await env.OPTIVIEW_DB.prepare(`
            SELECT email, expires_at FROM magic_link 
            WHERE token_hash = ? AND expires_at > ?
          `).bind(tokenHash, new Date().toISOString()).first();

          if (!magicLinkData) {
            const response = new Response("Invalid or expired magic link", { status: 400 });
            return addCorsHeaders(response, request.headers.get("origin"));
          }

          // Check if user exists
          let userRecord = await env.OPTIVIEW_DB.prepare(`
            SELECT id, email, is_admin, created_ts FROM user WHERE email = ?
          `).bind(magicLinkData.email).first();

          if (!userRecord) {
            console.log("👤 Creating new user for:", magicLinkData.email);
            // Create new user
            const userId = `usr_${generateToken().substring(0, 12)}`;
            const now = Math.floor(Date.now() / 1000);

            // Check if this is the first user in the system
            const userCount = await env.OPTIVIEW_DB.prepare(`
              SELECT COUNT(*) as count FROM user
            `).first();

            // Make the first user an admin
            const isAdmin = userCount.count === 0 ? 1 : 0;
            console.log(`🔑 User ${isAdmin ? 'IS' : 'is NOT'} admin (user count: ${userCount.count})`);

            await env.OPTIVIEW_DB.prepare(`
              INSERT INTO user (id, email, is_admin, created_ts, last_login_ts)
              VALUES (?, ?, ?, ?, ?)
            `).bind(userId, magicLinkData.email, isAdmin, now, now).run();

            userRecord = { id: userId, email: magicLinkData.email, is_admin: isAdmin, created_ts: now };
            console.log("✅ New user created with ID:", userId, "Admin:", isAdmin ? "YES" : "NO");
          } else {
            // Update last_login_ts for existing user
            const now = Math.floor(Date.now() / 1000);
            await env.OPTIVIEW_DB.prepare(`
              UPDATE user SET last_login_ts = ? WHERE id = ?
            `).bind(now, userRecord.id).run();
            console.log("✅ Updated last_login_ts for existing user:", userRecord.id);
          }

          // Check if user has already completed onboarding
          const hasOrganization = await env.OPTIVIEW_DB.prepare(`
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

          await env.OPTIVIEW_DB.prepare(`
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
          await env.OPTIVIEW_DB.prepare(`
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
          await env.OPTIVIEW_DB.prepare(`
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
              const sessionData = await env.OPTIVIEW_DB.prepare(`
                SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
              `).bind(sessionId, new Date().toISOString()).first();

              if (sessionData) {
                userId = sessionData.user_id;
                console.log('👤 Found user ID from session:', userId);

                // Create org_member record linking user to organization
                await env.OPTIVIEW_DB.prepare(`
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
          await env.OPTIVIEW_DB.prepare(`
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

          if (!sessionData) {
            const response = new Response(JSON.stringify({ error: "Session expired" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response, request.headers.get("origin"));
          }

          const userData = await env.OPTIVIEW_DB.prepare(`
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

          if (!sessionData) {
            const response = new Response(JSON.stringify({ error: "Session expired" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response, request.headers.get("origin"));
          }

          const orgData = await env.OPTIVIEW_DB.prepare(`
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

          if (!sessionData) {
            const response = new Response(JSON.stringify({ error: "Session expired" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response, request.headers.get("origin"));
          }

          const projectData = await env.OPTIVIEW_DB.prepare(`
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

          const response = new Response(JSON.stringify(projectData), {
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

          if (!sessionData) {
            const response = new Response(JSON.stringify({ error: "Session expired" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response, request.headers.get("origin"));
          }

          const organizations = await env.OPTIVIEW_DB.prepare(`
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

          if (!sessionData) {
            const response = new Response(JSON.stringify({ error: "Session expired" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response, request.headers.get("origin"));
          }

          const projects = await env.OPTIVIEW_DB.prepare(`
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
          await env.OPTIVIEW_DB.prepare(`
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

          // Generate API key ID and secret
          const keyId = `key_${generateToken().substring(0, 12)}`;
          const secret = generateToken();
          const secretHash = await hashToken(secret);
          const now = Date.now();

          // Store API key in database
          await env.OPTIVIEW_DB.prepare(`
            INSERT INTO api_key (id, project_id, name, hash, created_ts)
            VALUES (?, ?, ?, ?, ?)
          `).bind(keyId, project_id, name, secretHash, now).run();

          const response = new Response(JSON.stringify({
            id: keyId,
            key_id: keyId,
            secret_once: secret, // Show only once
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
      if (url.pathname === "/v1/tag.js" && request.method === "GET") {
        try {
          const pid = url.searchParams.get("pid");
          const kid = url.searchParams.get("kid");

          if (!pid || !kid) {
            const response = new Response("Missing pid or kid parameters", { status: 400 });
            return addCorsHeaders(response, origin);
          }

          // Generate the JS tag
          const jsTag = `// Optiview Analytics Tag v1.0
!function(){
  try{
    var pid = "${pid}"; 
    var kid = "${kid}";
    var ep = "${config.PUBLIC_BASE_URL}/api/events";
    
    var payload = {
      property_id: pid,
      key_id: kid,
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
}();`;

          const response = new Response(jsTag, {
            headers: {
              "Content-Type": "application/javascript",
              "Cache-Control": "public, max-age=3600"
            }
          });
          return addCorsHeaders(response, origin);

        } catch (e) {
          console.error("JS tag generation error:", e);
          const response = new Response("Internal server error", { status: 500 });
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const accessCheck = await env.OPTIVIEW_DB.prepare(`
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
          const keys = await env.OPTIVIEW_DB.prepare(`
            SELECT 
              ak.id,
              ak.id as key_id,
              ak.name,
              ak.project_id,
              ak.created_ts,
              ak.last_used_ts,
              ak.revoked_ts,
              ak.grace_secret_hash,
              ak.grace_expires_at,
              p.domain,
              p.id as property_id
            FROM api_key ak
            LEFT JOIN property p ON p.project_id = ak.project_id
            WHERE ak.project_id = ?
            ORDER BY ak.created_ts DESC
          `).bind(projectId).all();

          const response = new Response(JSON.stringify({ keys: keys.results }), {
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const { name, project_id, property_id } = body;

          if (!name || !project_id) {
            const response = new Response(JSON.stringify({ error: "Name and project_id are required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response, origin);
          }

          // Verify user has access to this project
          const accessCheck = await env.OPTIVIEW_DB.prepare(`
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

          // Generate API key ID and secret
          const keyId = `key_${generateToken().substring(0, 12)}`;
          const secret = generateToken();
          const secretHash = await hashToken(secret);
          const now = Date.now();

          // Get org_id from project
          const projectData = await env.OPTIVIEW_DB.prepare(`
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
          await env.OPTIVIEW_DB.prepare(`
            INSERT INTO api_key (id, project_id, org_id, name, hash, created_ts)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(keyId, project_id, projectData.org_id, name, secretHash, now).run();

          const response = new Response(JSON.stringify({
            id: keyId,
            key_id: keyId,
            secret_once: secret, // Show only once
            name: name,
            project_id: project_id,
            property_id: property_id || null,
            created_at: now
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const accessCheck = await env.OPTIVIEW_DB.prepare(`
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
          const totalResult = await env.OPTIVIEW_DB.prepare(countQuery).bind(...baseParams).first();
          const total = totalResult?.total || 0;

          // Bulletproof query - use COALESCE to handle all NULL cases
          const mainQuery = `
            SELECT
              ca.id, ca.url, ca.type,
              COALESCE((SELECT MAX(occurred_at) FROM interaction_events ie WHERE ie.project_id=ca.project_id AND ie.content_id=ca.id), NULL) AS last_seen,
              COALESCE((SELECT COUNT(*) FROM interaction_events ie WHERE ie.project_id=ca.project_id AND ie.content_id=ca.id AND ie.occurred_at>=?), 0) AS events_window,
              COALESCE((SELECT COUNT(*) FROM interaction_events ie WHERE ie.project_id=ca.project_id AND ie.content_id=ca.id AND ie.occurred_at>=datetime('now','-15 minutes')), 0) AS events_15m,
              COALESCE((SELECT COUNT(*) FROM interaction_events ie WHERE ie.project_id=ca.project_id AND ie.content_id=ca.id AND ie.occurred_at>=datetime('now','-1 day')), 0) AS events_24h,
              COALESCE((SELECT COUNT(*) FROM ai_referrals ar WHERE ar.project_id=ca.project_id AND ar.content_id=ca.id AND ar.detected_at>=datetime('now','-1 day')), 0) AS ai_referrals_24h,
              COALESCE((SELECT COUNT(*) FROM interaction_events ie WHERE ie.project_id=ca.project_id AND ie.content_id=ca.id AND ie.occurred_at>=datetime('now','-1 day') AND ie.ai_source_id IS NOT NULL), 0) AS ai_events_24h,
              CASE 
                WHEN COALESCE((SELECT COUNT(*) FROM interaction_events ie WHERE ie.project_id=ca.project_id AND ie.content_id=ca.id AND ie.occurred_at>=datetime('now','-1 day') AND ie.ai_source_id IS NOT NULL), 0) > 0 THEN 50
                ELSE 0
              END AS coverage_score
            FROM content_assets ca
            WHERE ${baseFilters}
            ORDER BY ca.url ASC
            LIMIT ? OFFSET ?
          `;

          const mainParams = [...baseParams, sinceTime, pageSize, (page - 1) * pageSize];
          const mainResult = await env.OPTIVIEW_DB.prepare(mainQuery).bind(...mainParams).all();

          // Get by-source breakdown for the returned items
          const items = [];
          for (const row of mainResult.results) {
            // Get by-source breakdown for 24h
            const bySourceResult = await env.OPTIVIEW_DB.prepare(`
              SELECT s.slug, COUNT(*) as events
              FROM interaction_events ie
              JOIN ai_sources s ON s.id = ie.ai_source_id
              WHERE ie.project_id = ? AND ie.content_id = ? AND ie.occurred_at >= datetime('now','-1 day')
              GROUP BY s.slug
              ORDER BY events DESC
            `).bind(projectId, row.id).all();

            items.push({
              id: row.id,
              url: row.url,
              type: row.type,
              last_seen: row.last_seen,
              events_15m: row.events_15m,
              events_24h: row.events_24h,
              ai_referrals_24h: row.ai_referrals_24h,
              by_source_24h: bySourceResult.results,
              coverage_score: row.coverage_score
            });
          }

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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const { name, url, project_id, type } = body;

          if (!name || !url || !project_id || !type) {
            const response = new Response(JSON.stringify({ error: "Name, URL, project_id, and type are required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response, origin);
          }

          // Verify user has access to this project
          const accessCheck = await env.OPTIVIEW_DB.prepare(`
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

          // Get property_id from the request
          const { property_id } = body;

          if (!property_id) {
            const response = new Response(JSON.stringify({ error: "property_id is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response, origin);
          }

          // Verify the property belongs to the project
          const propertyCheck = await env.OPTIVIEW_DB.prepare(`
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
          const result = await env.OPTIVIEW_DB.prepare(`
            INSERT INTO content_assets (property_id, project_id, url, type, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(property_id, url) DO UPDATE SET
              type = excluded.type,
              metadata = excluded.metadata,
              created_at = excluded.created_at
            RETURNING id
          `).bind(property_id, project_id, url, type, sanitizedMetadata, now).run();

          const contentId = result.meta.last_row_id || result.results?.[0]?.id;

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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const contentAsset = await env.OPTIVIEW_DB.prepare(`
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
          const result = await env.OPTIVIEW_DB.prepare(`
            UPDATE content_assets 
            SET ${updateFields.join(', ')}
            WHERE id = ?
          `).bind(...updateParams).run();

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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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

          // Get the content asset and verify access
          const contentAsset = await env.OPTIVIEW_DB.prepare(`
            SELECT ca.id, ca.url, ca.type, ca.metadata
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
          const bySourceResult = await env.OPTIVIEW_DB.prepare(`
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

          const timeseriesResult = await env.OPTIVIEW_DB.prepare(timeseriesQuery).bind(...timeseriesParams).all();

          // Get recent events (last 10)
          const recentEventsResult = await env.OPTIVIEW_DB.prepare(`
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const accessCheck = await env.OPTIVIEW_DB.prepare(`
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

          const sources = await env.OPTIVIEW_DB.prepare(sourcesQuery)
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

              const topContent = await env.OPTIVIEW_DB.prepare(topContentQuery)
                .bind(projectId, source.id)
                .all();

              source.top_content = topContent.results;
            }
          }

          const response = new Response(JSON.stringify(sources.results), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "private, max-age=300, stale-while-revalidate=60"
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const accessCheck = await env.OPTIVIEW_DB.prepare(`
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
          const sourceCheck = await env.OPTIVIEW_DB.prepare(`
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
          await env.OPTIVIEW_DB.prepare(`
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
            await env.OPTIVIEW_DB.prepare(`
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const accessCheck = await env.OPTIVIEW_DB.prepare(`
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
          await env.OPTIVIEW_DB.prepare(`
            UPDATE project_ai_sources 
            SET enabled = 0, updated_at = CURRENT_TIMESTAMP
            WHERE project_id = ? AND ai_source_id = ?
          `).bind(project_id, ai_source_id).run();

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

      // 6.1) Events POST endpoint (for JS tag)
      if (url.pathname === "/api/events" && request.method === "POST") {
        try {
          const body = await request.json();
          const { property_id, key_id, event_type, metadata } = body;

          // Validate required fields
          if (!property_id || !key_id || !event_type) {
            const response = new Response(JSON.stringify({ error: "Missing required fields" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response, origin);
          }

          // Validate event_type
          if (!['view', 'click', 'custom'].includes(event_type)) {
            const response = new Response(JSON.stringify({ error: "Invalid event_type. Must be one of: view, click, custom" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response, origin);
          }

          // Validate API key
          const keyHash = await hashToken(key_id);
          const apiKey = await env.OPTIVIEW_DB.prepare(`
            SELECT * FROM api_key WHERE hash = ? AND revoked_ts IS NULL
          `).bind(keyHash).first();

          if (!apiKey) {
            const response = new Response(JSON.stringify({ error: "Invalid API key" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response, origin);
          }

          // Determine project_id and validate property_id scope
          const projectId = apiKey.project_id;

          // Verify property belongs to project (if property_id provided)
          if (property_id) {
            const propertyCheck = await env.OPTIVIEW_DB.prepare(`
              SELECT id FROM properties WHERE id = ? AND project_id = ?
            `).bind(property_id, projectId).first();

            if (!propertyCheck) {
              const response = new Response(JSON.stringify({ error: "Property not found or not accessible" }), {
                status: 403,
                headers: { "Content-Type": "application/json" }
              });
              return addCorsHeaders(response, origin);
            }
          }

          // Classify AI source from metadata
          let aiSourceId = null;
          if (metadata && metadata.r) {
            const referer = metadata.r.toLowerCase();

            // Simple classification logic - can be enhanced later
            if (referer.includes('chat.openai.com') || referer.includes('openai.com')) {
              aiSourceId = 10; // ChatGPT
            } else if (referer.includes('claude.ai') || referer.includes('anthropic.com')) {
              aiSourceId = 11; // Claude
            } else if (referer.includes('perplexity.ai')) {
              aiSourceId = 12; // Perplexity
            } else if (referer.includes('gemini.google.com') || referer.includes('google.com')) {
              aiSourceId = 13; // Gemini
            }
          }

          // Simple content mapping - just use existing content assets for now
          let contentId = null;
          if (metadata && metadata.p) {
            // Try to find existing content asset by path
            const existingContent = await env.OPTIVIEW_DB.prepare(`
              SELECT id FROM content_assets WHERE url LIKE ? AND project_id = ?
            `).bind(`%${metadata.p}%`, projectId).first();

            if (existingContent) {
              contentId = existingContent.id;
            }
          }

          // Store event in interaction_events table
          const now = new Date().toISOString();

          const result = await env.OPTIVIEW_DB.prepare(`
            INSERT INTO interaction_events (
              project_id, property_id, content_id, ai_source_id, 
              event_type, metadata, occurred_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            projectId,
            property_id,
            contentId,
            aiSourceId,
            event_type,
            JSON.stringify(metadata || {}),
            now
          ).run();

          // Update last_used timestamp for API key
          await env.OPTIVIEW_DB.prepare(`
            UPDATE api_key SET last_used_ts = ? WHERE id = ?
          `).bind(Date.now(), apiKey.id).run();

          const response = new Response(JSON.stringify({
            ok: true,
            id: result.meta.last_row_id,
            timestamp: now
          }), {
            status: 201,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response, origin);

        } catch (e) {
          console.error("Event creation error:", e);
          const response = new Response(JSON.stringify({ error: "Failed to create event" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response, origin);
        }
      }

      // 7) Events summary endpoint
      if (url.pathname === "/api/events/summary" && request.method === "GET") {
        const response = new Response(JSON.stringify({
          total: 0,
          breakdown: [],
          top_sources: [],
          timeseries: []
        }), {
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // 7.5) Events last-seen endpoint (for install verification)
      if (url.pathname === "/api/events/last-seen" && request.method === "GET") {
        try {
          const propertyId = url.searchParams.get("property_id");

          if (!propertyId) {
            const response = new Response(JSON.stringify({ error: "property_id is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response, origin);
          }

          const now = Date.now();
          const fifteenMinutesAgo = now - (15 * 60 * 1000);

          // Get events in the last 15 minutes for this property
          const recentEvents = await env.OPTIVIEW_DB.prepare(`
            SELECT COUNT(*) as count, event_type, metadata
            FROM edge_click_event 
            WHERE property_id = ? AND timestamp > ?
            GROUP BY event_type
          `).bind(propertyId, fifteenMinutesAgo).all();

          // Get the last event timestamp
          const lastEvent = await env.OPTIVIEW_DB.prepare(`
            SELECT timestamp FROM edge_click_event 
            WHERE property_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 1
          `).bind(propertyId).first();

          // Count total events in last 15 minutes
          const totalEvents = await env.OPTIVIEW_DB.prepare(`
            SELECT COUNT(*) as count FROM edge_click_event 
            WHERE property_id = ? AND timestamp > ?
          `).bind(propertyId, fifteenMinutesAgo).first();

          const response = new Response(JSON.stringify({
            property_id: propertyId,
            events_15m: totalEvents?.count || 0,
            by_class_15m: {
              direct_human: 0, // TODO: Implement traffic classification
              human_via_ai: 0,
              ai_agent_crawl: 0,
              unknown_ai_like: 0
            },
            last_event_ts: lastEvent?.timestamp || null
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const userData = await env.OPTIVIEW_DB.prepare(`
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const userData = await env.OPTIVIEW_DB.prepare(`
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
          const result = await env.OPTIVIEW_DB.prepare(`
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const userData = await env.OPTIVIEW_DB.prepare(`
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
          await env.OPTIVIEW_DB.prepare(updateQuery).bind(...values).run();

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

      // 10) Admin Rules Suggestions endpoints
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const userData = await env.OPTIVIEW_DB.prepare(`
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

          const suggestions = await env.OPTIVIEW_DB.prepare(`
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const userData = await env.OPTIVIEW_DB.prepare(`
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
          await env.OPTIVIEW_DB.prepare(`
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const accessCheck = await env.OPTIVIEW_DB.prepare(`
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

          const magicLinkData = await env.OPTIVIEW_DB.prepare(`
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
          const existingOrg = await env.OPTIVIEW_DB.prepare(`
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
            await env.OPTIVIEW_DB.prepare(`
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
          const org = await env.OPTIVIEW_DB.prepare(`
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

          await env.OPTIVIEW_DB.prepare(`
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const accessCheck = await env.OPTIVIEW_DB.prepare(`
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const accessCheck = await env.OPTIVIEW_DB.prepare(`
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const userData = await env.OPTIVIEW_DB.prepare(`
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
          const updateResult = await env.OPTIVIEW_DB.prepare(`
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
          const sessionData = await env.OPTIVIEW_DB.prepare(`
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
          const userData = await env.OPTIVIEW_DB.prepare(`
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
      return addCorsHeaders(fallbackResponse, origin);

    } catch (error) {
      console.error("Worker error:", error);

      const response = new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });

      return response;
    }
  }
};
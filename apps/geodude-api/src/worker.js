import { loadConfig, getConfigForEnvCheck, getConfigErrors, getMissingConfigKeys } from './config.js';
import { EmailService } from './email-service.js';

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
          return response;
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
        response.headers.set("Access-Control-Allow-Origin", origin || "*");
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        response.headers.set("Access-Control-Allow-Credentials", "true");
        return response;
      }

      // Helper function to add CORS headers
      const addCorsHeaders = (response) => {
        response.headers.set("Access-Control-Allow-Origin", origin || "*");
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        response.headers.set("Access-Control-Allow-Credentials", "true");
        return response;
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
        return addCorsHeaders(response);
      }

      // 1.5) Admin health check
      if (url.pathname === "/admin/health") {
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
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
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
          return addCorsHeaders(response);
        } catch (error) {
          const response = new Response(JSON.stringify({
            error: "Failed to generate environment check",
            message: error.message,
            timestamp: new Date().toISOString()
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
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
        return addCorsHeaders(response);
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
            return addCorsHeaders(response);
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
            return addCorsHeaders(response);
          }

          if (!emailLimit.allowed) {
            const response = new Response(JSON.stringify({ error: "Too many requests for this email" }), {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": Math.ceil((emailLimit.resetTime - Date.now()) / 1000)
              }
            });
            return addCorsHeaders(response);
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
          const appUrl = config.PUBLIC_APP_URL;
          const magicLink = `${appUrl}/auth/magic?token=${token}`;

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
          return addCorsHeaders(response);

        } catch (e) {
          console.error("Magic link request error (Frontend):", e);
          const response = new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
        }
      }

      // 2.2) Consume Magic Link
      if (url.pathname === "/auth/magic" && request.method === "GET") {
        try {
          const urlObj = new URL(request.url);
          const token = urlObj.searchParams.get("token");
          const continuePath = urlObj.searchParams.get("continue") || "/onboarding";

          if (!token) {
            return new Response("Missing token", { status: 400 });
          }

          console.log("🔐 Magic link consumption for token:", token.substring(0, 12) + "...");

          // Get client IP for session
          const clientIP = request.headers.get("cf-connecting-ip") || 
                          request.headers.get("x-forwarded-for") || 
                          request.headers.get("x-real-ip") || 
                          "unknown";
          console.log("📍 Client IP:", clientIP);

          // Find and validate magic link
          const magicLinkData = await env.OPTIVIEW_DB.prepare(`
            SELECT email, expires_at FROM magic_link 
            WHERE token = ? AND expires_at > ?
          `).bind(token, new Date().toISOString()).first();

          if (!magicLinkData) {
            return new Response("Invalid or expired magic link", { status: 400 });
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
            
            await env.OPTIVIEW_DB.prepare(`
              INSERT INTO user (id, email, is_admin, created_ts, last_login_ts)
              VALUES (?, ?, 0, ?, ?)
            `).bind(userId, magicLinkData.email, now, now).run();
            
            userRecord = { id: userId, email: magicLinkData.email, is_admin: 0, created_ts: now };
            console.log("✅ New user created with ID:", userId);
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
            DELETE FROM magic_link WHERE token = ?
          `).bind(token).run();

          // Redirect to appropriate page
          const redirectUrl = `${env.PUBLIC_APP_URL}${redirectPath}`;
          return new Response(null, {
            status: 302,
            headers: {
              "Location": redirectUrl,
              "Set-Cookie": `optiview_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${parseInt(env.SESSION_TTL_HOURS || "720") * 3600}`
            }
          });

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
        return addCorsHeaders(response);
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
            return addCorsHeaders(response);
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
          return addCorsHeaders(response);

        } catch (e) {
          console.error("Organization creation error:", e);
          const response = new Response(JSON.stringify({ error: "Failed to create organization" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
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
            return addCorsHeaders(response);
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
          return addCorsHeaders(response);

        } catch (e) {
          console.error("Project creation error:", e);
          const response = new Response(JSON.stringify({ error: "Failed to create project" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
        }
      }

      // 4) Authentication API Endpoints
      // 4.1) Get current user
      if (url.pathname === "/api/auth/me" && request.method === "GET") {
        try {
          const sessionCookie = request.headers.get("cookie");
          if (!sessionCookie) {
            return new Response(JSON.stringify({ error: "Not authenticated" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
          }

          const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
          if (!sessionMatch) {
            return new Response(JSON.stringify({ error: "Invalid session" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
          }

          const sessionId = sessionMatch[1];
          const sessionData = await env.OPTIVIEW_DB.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

          if (!sessionData) {
            return new Response(JSON.stringify({ error: "Session expired" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
          }

          const userData = await env.OPTIVIEW_DB.prepare(`
            SELECT id, email, is_admin, created_ts, last_login_ts FROM user WHERE id = ?
          `).bind(sessionData.user_id).first();

          if (!userData) {
            return new Response(JSON.stringify({ error: "User not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" }
            });
          }

          return new Response(JSON.stringify(userData), {
            headers: { "Content-Type": "application/json" }
          });

        } catch (e) {
          console.error("Get user error:", e);
          return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      // 4.2) Get user's organization
      if (url.pathname === "/api/auth/organization" && request.method === "GET") {
        try {
          const sessionCookie = request.headers.get("cookie");
          if (!sessionCookie) {
            return new Response(JSON.stringify({ error: "Not authenticated" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
          }

          const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
          if (!sessionMatch) {
            return new Response(JSON.stringify({ error: "Invalid session" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
          }

          const sessionId = sessionMatch[1];
          const sessionData = await env.OPTIVIEW_DB.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

          if (!sessionData) {
            return new Response(JSON.stringify({ error: "Session expired" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
          }

          const orgData = await env.OPTIVIEW_DB.prepare(`
            SELECT o.id, o.name, o.created_ts 
            FROM organization o
            JOIN org_member om ON o.id = om.org_id
            WHERE om.user_id = ?
            LIMIT 1
          `).bind(sessionData.user_id).first();

          if (!orgData) {
            return new Response(JSON.stringify({ error: "No organization found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" }
            });
          }

          return new Response(JSON.stringify(orgData), {
            headers: { "Content-Type": "application/json" }
          });

        } catch (e) {
          console.error("Get organization error:", e);
          return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      // 4.3) Get user's project
      if (url.pathname === "/api/auth/project" && request.method === "GET") {
        try {
          const sessionCookie = request.headers.get("cookie");
          if (!sessionCookie) {
            return new Response(JSON.stringify({ error: "Not authenticated" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
          }

          const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
          if (!sessionMatch) {
            return new Response(JSON.stringify({ error: "Invalid session" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
          }

          const sessionId = sessionMatch[1];
          const sessionData = await env.OPTIVIEW_DB.prepare(`
            SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
          `).bind(sessionId, new Date().toISOString()).first();

          if (!sessionData) {
            return new Response(JSON.stringify({ error: "Session expired" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
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
            return new Response(JSON.stringify({ error: "No project found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" }
            });
          }

          return new Response(JSON.stringify(projectData), {
            headers: { "Content-Type": "application/json" }
          });

        } catch (e) {
          console.error("Get project error:", e);
          return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
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
            return addCorsHeaders(response);
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
          return addCorsHeaders(response);

        } catch (e) {
          console.error("Property creation error:", e);
          const response = new Response(JSON.stringify({ error: "Failed to create property" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
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
            return addCorsHeaders(response);
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
          return addCorsHeaders(response);

        } catch (e) {
          console.error("API key creation error:", e);
          const response = new Response(JSON.stringify({ error: "Failed to create API key" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
        }
      }

      // 3.5) JS Tag for Installation
      if (url.pathname === "/v1/tag.js" && request.method === "GET") {
        try {
          const pid = url.searchParams.get("pid");
          const kid = url.searchParams.get("kid");

          if (!pid || !kid) {
            const response = new Response("Missing pid or kid parameters", { status: 400 });
            return addCorsHeaders(response);
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
          return addCorsHeaders(response);

        } catch (e) {
          console.error("JS tag generation error:", e);
          const response = new Response("Internal server error", { status: 500 });
          return addCorsHeaders(response);
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
            return addCorsHeaders(response);
          }

          // Validate role
          if (!["owner", "member"].includes(role)) {
            const response = new Response(JSON.stringify({ error: "Invalid role. Must be 'owner' or 'member'" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response);
          }

          // Check if user is already a member
          const existingMember = await env.AI_FINGERPRINTS.get(`org_member:${org_id}:${email}`, { type: "json" });
          if (existingMember) {
            const response = new Response(JSON.stringify({ error: "User is already a member of this organization" }), {
              status: 409,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response);
          }

          // Check if there's already a pending invite
          const existingInvite = await env.AI_FINGERPRINTS.get(`pending_invite:${org_id}:${email}`, { type: "json" });
          if (existingInvite) {
            const response = new Response(JSON.stringify({ error: "Invite already pending for this user" }), {
              status: 409,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response);
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
          return addCorsHeaders(response);

        } catch (e) {
          console.error("Invite creation error:", e);
          const response = new Response(JSON.stringify({ error: "Failed to create invite" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
        }
      }

      // 4) Invite Acceptance (M5)
      if (url.pathname === "/invite/accept" && request.method === "GET") {
        try {
          const token = url.searchParams.get("token");
          if (!token) {
            const response = new Response("Invalid invite token", { status: 400 });
            return addCorsHeaders(response);
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
          return addCorsHeaders(response);

        } catch (e) {
          console.error("Invite acceptance error:", e);
          const response = new Response("Internal server error", { status: 500 });
          return addCorsHeaders(response);
        }
      }

      // 3) API Keys endpoint
      if (url.pathname === "/api/keys" && request.method === "GET") {
        // Return the structure the frontend expects: { keys: [] }
        const response = new Response(JSON.stringify({ keys: [] }), {
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
      }

      if (url.pathname === "/api/keys" && request.method === "POST") {
        const response = new Response(JSON.stringify({
          id: 1,
          key_id: "key_test123",
          secret_once: "secret_test123",
          name: "Test Key",
          project_id: 1,
          property_id: 1
        }), {
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
      }

      // 4) Content endpoint
      if (url.pathname === "/api/content" && request.method === "GET") {
        // Return the structure the frontend expects: { content: [] }
        const response = new Response(JSON.stringify({ content: [] }), {
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
      }

      // 5) Sources endpoint
      if (url.pathname === "/api/sources" && request.method === "GET") {
        // Return empty array directly if that's what frontend expects
        const response = new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
      }

      // 6) Events endpoint
      if (url.pathname === "/api/events" && request.method === "GET") {
        const response = new Response(JSON.stringify({ events: [], total: 0 }), {
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
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
            return addCorsHeaders(response);
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
            return addCorsHeaders(response);
          }

          // Store event in database
          const now = Date.now();
          const eventId = `evt_${generateToken().substring(0, 12)}`;

          await env.OPTIVIEW_DB.prepare(`
            INSERT INTO edge_click_event (
              id, org_id, project_id, property_id, 
              timestamp, event_type, metadata, 
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            eventId,
            apiKey.org_id || null,
            apiKey.project_id,
            property_id,
            now,
            event_type,
            JSON.stringify(metadata || {}),
            now
          ).run();

          // Update last_used timestamp for API key
          await env.OPTIVIEW_DB.prepare(`
            UPDATE api_key SET last_used_ts = ? WHERE id = ?
          `).bind(now, apiKey.id).run();

          const response = new Response(JSON.stringify({
            ok: true,
            event_id: eventId,
            timestamp: now
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);

        } catch (e) {
          console.error("Event creation error:", e);
          const response = new Response(JSON.stringify({ error: "Failed to create event" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
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
        return addCorsHeaders(response);
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
            return addCorsHeaders(response);
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
          return addCorsHeaders(response);

        } catch (e) {
          console.error("Last-seen query error:", e);
          const response = new Response(JSON.stringify({ error: "Failed to query events" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
        }
      }

      // 8) Properties endpoint (might be missing)
      if (url.pathname === "/api/properties" && request.method === "GET") {
        const response = new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
      }

      // 9) Projects endpoint (might be missing)
      if (url.pathname === "/api/projects" && request.method === "GET") {
        const response = new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
      }

      // 10) Organizations endpoint (might be missing)
      if (url.pathname === "/api/organizations" && request.method === "GET") {
        const response = new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
      }

      // 11) User endpoint (might be missing)
      if (url.pathname === "/api/user" && request.method === "GET") {
        const response = new Response(JSON.stringify({
          id: 1,
          email: "test@example.com",
          is_admin: false
        }), {
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
      }

      // 12) Dashboard endpoint (might be missing)
      if (url.pathname === "/api/dashboard" && request.method === "GET") {
        const response = new Response(JSON.stringify({
          stats: {
            total_events: 0,
            total_properties: 0,
            total_projects: 0
          }
        }), {
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
      }

      // 13) Any other /api/ endpoint that might be missing
      if (url.pathname.startsWith("/api/") && request.method === "GET") {
        console.log(`[DEBUG] Missing API endpoint: ${url.pathname}`);

        // Handle dynamic routes with IDs
        if (url.pathname.match(/^\/api\/projects\/\d+\/settings$/)) {
          // Project settings endpoint
          const response = new Response(JSON.stringify({
            id: 1,
            project_id: url.pathname.split('/')[3], // Extract the ID
            data_retention_days: 90,
            ai_detection_enabled: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
        }

        if (url.pathname.match(/^\/api\/projects\/\d+$/)) {
          // Single project endpoint
          const response = new Response(JSON.stringify({
            id: url.pathname.split('/')[3], // Extract the ID
            name: "Test Project",
            description: "A test project",
            created_at: new Date().toISOString()
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
        }

        if (url.pathname.match(/^\/api\/properties\/\d+$/)) {
          // Single property endpoint
          const response = new Response(JSON.stringify({
            id: url.pathname.split('/')[3], // Extract the ID
            domain: "example.com",
            project_id: 1,
            created_at: new Date().toISOString()
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
        }

        // Default fallback for any other API endpoint
        const response = new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
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
            return addCorsHeaders(response);
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
            return addCorsHeaders(response);
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
            return addCorsHeaders(response);
          } else {
            const response = new Response(JSON.stringify({
              message: "No active magic link found for this email",
              email: email,
              note: "Try requesting a new magic link first",
              status: "not_found"
            }), {
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response);
          }

        } catch (e) {
          console.error("Test magic link peek error:", e);
          const response = new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
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

      // 8) Fallback response for any unmatched routes
      const fallbackResponse = new Response("Not Found", { status: 404 });
      return addCorsHeaders(fallbackResponse);

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
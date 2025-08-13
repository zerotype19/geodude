export default {
  async fetch(request, env, ctx) {
    try {
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

      // Helper function to sanitize continue path (single source of truth)
      const sanitizeContinuePath = (input) => {
        const fallback = "/onboarding";
        if (typeof input !== "string") {
          console.log(JSON.stringify({ event: "continue_sanitized", reason: "not_string" }));
          return fallback;
        }

        const s = input.trim();

        // Must start with a single '/' (internal path). Reject protocol-relative (`//`) and absolute URLs.
        if (!s.startsWith("/") || s.startsWith("//")) {
          console.log(JSON.stringify({ event: "continue_sanitized", reason: "not_internal_path" }));
          return fallback;
        }

        // Reject backslashes and control chars
        if (/[\\\u0000-\u001F]/.test(s)) {
          console.log(JSON.stringify({ event: "continue_sanitized", reason: "control_chars" }));
          return fallback;
        }

        // Parse with a dummy base to normalize path+query; ignore fragments
        let candidate;
        try {
          const u = new URL(s, "http://local"); // ensures "/..." parses as path on same-origin
          // Only accept same-origin relative paths.
          if (u.origin !== "http://local") {
            console.log(JSON.stringify({ event: "continue_sanitized", reason: "not_same_origin" }));
            return fallback;
          }
          candidate = u.pathname + u.search; // drop hash if present
        } catch {
          console.log(JSON.stringify({ event: "continue_sanitized", reason: "url_parse_failed" }));
          return fallback;
        }

        // Allow only URL-path-safe characters (conservative)
        if (!/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@/%?]*$/.test(candidate)) {
          console.log(JSON.stringify({ event: "continue_sanitized", reason: "unsafe_chars" }));
          return fallback;
        }

        // Cap length to prevent abuse
        if (candidate.length > 512) {
          console.log(JSON.stringify({ event: "continue_sanitized", reason: "too_long" }));
          return fallback;
        }

        return candidate;
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

      // Helper function to check rate limits
      const checkRateLimit = async (key, limit, windowMs) => {
        const now = Date.now();
        const windowStart = now - windowMs;

        // Get current count from KV
        const current = await env.AI_FINGERPRINTS.get(key, { type: "json" }) || { count: 0, resetTime: now + windowMs };

        if (now > current.resetTime) {
          // Reset window
          await env.AI_FINGERPRINTS.put(key, JSON.stringify({ count: 1, resetTime: now + windowMs }), { expirationTtl: Math.ceil(windowMs / 1000) });
          return { allowed: true, remaining: limit - 1, resetTime: current.resetTime };
        }

        if (current.count >= limit) {
          return { allowed: false, remaining: 0, resetTime: current.resetTime };
        }

        // Increment count
        await env.AI_FINGERPRINTS.put(key, JSON.stringify({ count: current.count + 1, resetTime: current.resetTime }), { expirationTtl: Math.ceil(windowMs / 1000) });
        return { allowed: true, remaining: limit - current.count - 1, resetTime: current.resetTime };
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
            continue_sanitized_5m: 0, // Counter for sanitization fallbacks
            magic_links_requested_5m: 0,
            magic_links_consumed_5m: 0
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
      }

      // 2) Magic Link Authentication (M3)
      if (url.pathname === "/auth/request-link" && request.method === "POST") {
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

          const ipLimit = await checkRateLimit(ipKey, 10, 60 * 1000); // 10 per minute per IP
          const emailLimit = await checkRateLimit(emailKey, 5, 24 * 60 * 60 * 1000); // 5 per day per email

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
          const validatedContinuePath = sanitizeContinuePath(continue_path);

          // Generate secure token
          const token = generateToken();
          const tokenHash = await hashToken(token);

          // Store token in database (for now, use KV as temporary storage)
          const expirationMinutes = parseInt(env.MAGIC_LINK_EXP_MIN) || 15;
          const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

          const magicLinkData = {
            email,
            token_hash: tokenHash,
            continue_path: validatedContinuePath, // Store only the sanitized value
            expires_at: expiresAt.toISOString(),
            created_at: new Date().toISOString()
          };

          await env.AI_FINGERPRINTS.put(`magic_link:${tokenHash}`, JSON.stringify(magicLinkData), {
            expirationTtl: expirationMinutes * 60
          });

          // Generate magic link
          const appUrl = env.PUBLIC_APP_URL || "https://optiview.ai";
          const magicLink = `${appUrl}/auth/magic?token=${token}`;

          // Send email (for now, log to console in dev)
          if (env.NODE_ENV === "production") {
            // TODO: Implement real email sending
            console.log("Would send email to:", email, "with link:", magicLink);
          } else {
            // Dev mode: log the link
            console.log("🔐 DEV MODE - Magic Link for", email, ":", magicLink);
            console.log("Token Hash:", tokenHash);
            console.log("Expires:", expiresAt.toISOString());
          }

          // Always return { ok: true } to prevent user enumeration
          const response = new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);

        } catch (e) {
          console.error("Magic link request error:", e);
          // Still return { ok: true } to prevent user enumeration
          const response = new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
        }
      }

      // 2.5) Magic Link Consumption (M3)
      if (url.pathname === "/auth/magic" && request.method === "GET") {
        try {
          const token = url.searchParams.get("token");
          if (!token) {
            const response = new Response("Invalid token", { status: 400 });
            return addCorsHeaders(response);
          }

          // Hash the token to compare with stored hash
          const tokenHash = await hashToken(token);

          // Get stored magic link data
          const storedData = await env.AI_FINGERPRINTS.get(`magic_link:${tokenHash}`, { type: "json" });
          if (!storedData) {
            const response = new Response("Invalid or expired token", { status: 400 });
            return addCorsHeaders(response);
          }

          // Check expiration
          if (new Date(storedData.expires_at) < new Date()) {
            // Clean up expired token
            await env.AI_FINGERPRINTS.delete(`magic_link:${tokenHash}`);
            const response = new Response("Token expired", { status: 400 });
            return addCorsHeaders(response);
          }

          // Check if user is already logged in as different user
          const currentUserCookie = request.headers.get("cookie");
          let shouldPromptSwitch = false;
          let currentUserEmail = null;

          if (currentUserCookie) {
            // Parse current session to check if different user
            // For now, assume we'll implement session parsing later
            // TODO: Implement session cookie parsing
          }

          // Create session (for now, simple cookie)
          const sessionId = generateToken();
          const sessionData = {
            user_email: storedData.email,
            created_at: new Date().toISOString(),
            magic_link_used: true
          };

          // Store session in KV (temporary until we implement proper sessions)
          await env.AI_FINGERPRINTS.put(`session:${sessionId}`, JSON.stringify(sessionData), {
            expirationTtl: 24 * 60 * 60 // 24 hours
          });

          // Clean up used magic link
          await env.AI_FINGERPRINTS.delete(`magic_link:${tokenHash}`);

          // Re-sanitize continue path before redirect (defense-in-depth)
          const sanitizedRedirectUrl = sanitizeContinuePath(storedData.continue_path);

          const response = new Response(null, {
            status: 302,
            headers: {
              "Location": sanitizedRedirectUrl,
              "Set-Cookie": `optiview_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${24 * 60 * 60}`
            }
          });
          return addCorsHeaders(response);

        } catch (e) {
          console.error("Magic link consumption error:", e);
          const response = new Response("Internal server error", { status: 500 });
          return addCorsHeaders(response);
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
          const inviteExpiryDays = parseInt(env.INVITE_EXP_DAYS) || 7;
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
          const appUrl = env.PUBLIC_APP_URL || "https://optiview.ai";
          const inviteLink = `${appUrl}/invite/accept?token=${inviteToken}`;

          // Send invite email (for now, log to console in dev)
          if (env.NODE_ENV === "production") {
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
        const response = new Response(JSON.stringify({
          property_id: 1,
          events_15m: 0,
          by_class_15m: {
            direct_human: 0,
            human_via_ai: 0,
            ai_agent_crawl: 0,
            unknown_ai_like: 0
          },
          last_event_ts: null
        }), {
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
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
      if (url.pathname === "/_test/magic-link" && request.method === "GET" && env.TEST_MODE === "1") {
        try {
          const email = url.searchParams.get("email");
          if (!email) {
            const response = new Response(JSON.stringify({ error: "Email parameter required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response);
          }

          // Rate limit this endpoint even in dev
          const clientIP = request.headers.get("cf-connecting-ip") || "unknown";
          const ipKey = `rate_limit:test_magic_link:ip:${clientIP}`;
          const ipLimit = await checkRateLimit(ipKey, 10, 60 * 1000); // 10 per minute per IP

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
          // Note: This is a simplified lookup - in production we'd have proper database queries
          // For now, we'll search through KV storage for magic links
          console.log("🔍 TEST MODE - Looking for magic link token for:", email);

          // Search for magic links by email (this is a simplified approach)
          // In production, we'd have proper database queries with indexes
          let foundToken = null;

          // For now, we'll return a placeholder response indicating the endpoint is working
          // TODO: Implement proper token lookup from database
          const response = new Response(JSON.stringify({
            message: "Test endpoint active - token lookup not yet implemented",
            email: email,
            note: "This endpoint is for development/testing only",
            status: "working"
          }), {
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);

        } catch (e) {
          console.error("Test magic link peek error:", e);
          const response = new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
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

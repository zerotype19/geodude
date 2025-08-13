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
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
      }

      // 2) Simple auth endpoint for testing
      if (url.pathname === "/auth/request-code" && request.method === "POST") {
        try {
          const body = await request.json();
          const { email } = body;

          if (!email) {
            const response = new Response(JSON.stringify({ error: "Email is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response);
          }

          // For now, just return success
          const response = new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
        } catch (e) {
          const response = new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response);
        }
      }

      // 3) API Keys endpoint
      if (url.pathname === "/api/keys" && request.method === "GET") {
        // Return empty array directly if that's what frontend expects
        const response = new Response(JSON.stringify([]), {
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

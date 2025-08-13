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
        // Return empty array directly if that's what frontend expects
        const response = new Response(JSON.stringify([]), {
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

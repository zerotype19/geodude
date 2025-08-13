import { Request, Response, ExecutionContext } from '@cloudflare/workers-types';
import { Env } from './types';
import { handleAuthRoutes } from './routes/auth';
import { handleApiRoutes } from './routes/api';
import { addBasicSecurityHeaders, addCorsHeaders } from './cors';
import { log } from './logging';

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(req.url);
      const origin = req.headers.get("origin");

      // Handle CORS preflight requests
      if (req.method === "OPTIONS") {
        const response = new Response(null, { status: 204 });
        return addCorsHeaders(response, origin);
      }

      // Helper function to add any additional headers
      const attach = (resp: Response) => resp;

      // 1) Health check
      if (url.pathname === "/health") {
        const response = new Response("ok", { status: 200 });
        return addCorsHeaders(response, origin);
      }

      // 2) API Routes
      if (url.pathname.startsWith("/api/")) {
        const apiResponse = await handleApiRoutes(req, env, url, origin, attach, addBasicSecurityHeaders, addCorsHeaders);
        if (apiResponse) return apiResponse;
      }

      // 3) Authentication Routes
      if (url.pathname.startsWith("/auth/")) {
        const authResponse = await handleAuthRoutes(req, env, url, origin, attach, addBasicSecurityHeaders, addCorsHeaders);
        if (authResponse) return authResponse;
      }

      // 4) Invite Routes
      if (url.pathname.startsWith("/onboarding/invites") && req.method === "POST") {
        // TODO: Move to separate module
        const response = new Response(JSON.stringify({ error: "Not implemented yet" }), {
          status: 501,
          headers: { "Content-Type": "application/json" }
        });
        return addBasicSecurityHeaders(addCorsHeaders(response, origin));
      }

      if (url.pathname === "/invite/accept" && req.method === "GET") {
        // TODO: Move to separate module
        const response = new Response(JSON.stringify({ error: "Not implemented yet" }), {
          status: 501,
          headers: { "Content-Type": "application/json" }
        });
        return addBasicSecurityHeaders(addCorsHeaders(response, origin));
      }

      // 5) Fallback response for any unmatched routes
      const fallbackResponse = new Response("Not Found", { status: 404 });
      return addBasicSecurityHeaders(addCorsHeaders(fallbackResponse, origin));

    } catch (error) {
      log("worker_fatal_error", { 
        error: String(error), 
        stack: error instanceof Error ? error.stack : undefined 
      });
      
      const response = new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      
      return addBasicSecurityHeaders(addCorsHeaders(response, origin));
    }
  },

  // Cron job for refreshing fingerprints and retention purging
  async scheduled(event: any, env: Env, ctx: ExecutionContext) {
    if (event.cron === "*/30 * * * *") {
      try {
        // TODO: Implement fingerprint refresh
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
        // TODO: Implement retention purge
        log("retention_purge_completed", { timestamp: Date.now() });
      } catch (error) {
        log("retention_purge_error", {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
};

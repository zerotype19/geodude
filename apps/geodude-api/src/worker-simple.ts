import { Request, Response, ExecutionContext } from '@cloudflare/workers-types';
import { Env } from './types';
import { addCorsHeaders } from './cors';
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

      // 1) Health check
      if (url.pathname === "/health") {
        const response = new Response("ok", { status: 200 });
        return addCorsHeaders(response, origin);
      }

      // 2) Simple auth endpoint for testing
      if (url.pathname === "/auth/request-code" && req.method === "POST") {
        try {
          const body = await req.json() as { email: string };
          const { email } = body;

          if (!email) {
            const response = new Response(JSON.stringify({ error: "Email is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
            return addCorsHeaders(response, origin);
          }

          // For now, just return success
          const response = new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response, origin);
        } catch (e: any) {
          const response = new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json" }
          });
          return addCorsHeaders(response, origin);
        }
      }

      // 3) Fallback response for any unmatched routes
      const fallbackResponse = new Response("Not Found", { status: 404 });
      return addCorsHeaders(fallbackResponse, origin);

    } catch (error) {
      log("worker_fatal_error", { 
        error: String(error), 
        stack: error instanceof Error ? error.stack : undefined 
      });
      
      const response = new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      
      return addCorsHeaders(response, origin);
    }
  }
};

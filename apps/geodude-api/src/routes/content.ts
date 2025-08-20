import { addCorsHeaders } from '../cors';
import { bumpProjectVersion } from '../lib/cache';
import { ipRateLimit } from '../lib/ratelimit';
import { MetricsManager } from '../lib/metrics';

export async function handleContentRoutes(url: URL, request: Request, env: any, d1: any, origin: string) {
  // Get content endpoint
  if (url.pathname === "/api/content" && request.method === "GET") {
    try {
      const projectId = url.searchParams.get("project_id");
      if (!projectId) {
        const response = new Response(JSON.stringify({ error: "project_id is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Get content for project
      const content = await d1.prepare(`
        SELECT id, title, url, pathname, created_at, updated_at
        FROM content_assets 
        WHERE project_id = ? 
        ORDER BY created_at DESC
      `).bind(projectId).all();

      const response = new Response(JSON.stringify({
        content: content.results || [],
        total: content.results?.length || 0
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Get content error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to get content" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Create content endpoint
  if (url.pathname === "/api/content" && request.method === "POST") {
    try {
      // IP rate limiting
      if (env.RL_OFF !== "1") {
        try {
          const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "0.0.0.0";
          const metrics = new MetricsManager(env.CACHE);
          const { ok, remaining, resetAt } = await ipRateLimit(env.RL, ip, "/api/content", 120, 60, metrics);
          if (!ok) {
            const response = new Response(JSON.stringify({
              error: "rate_limited",
              retry_after: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
            }), {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "60"
              }
            });
            return addCorsHeaders(response, origin);
          }
        } catch (e) {
          console.error("Rate limiting error:", e);
          // Continue if rate limiting fails
        }
      }

      const body = await request.json();
      const { project_id, title, url, pathname } = body;

      if (!project_id || !title || !url) {
        const response = new Response(JSON.stringify({ error: "project_id, title, and url are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Validate URL format
      try {
        new URL(url);
      } catch (e) {
        const response = new Response(JSON.stringify({ error: "Invalid URL format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Create content
      const result = await d1.prepare(`
        INSERT INTO content_assets (project_id, title, url, pathname, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(project_id, title, url, pathname || null, Date.now(), Date.now()).run();

      // Invalidate cache for this project
      try {
        await bumpProjectVersion(env.CACHE, project_id);
      } catch (e) {
        console.error("Failed to invalidate cache:", e);
      }

      const response = new Response(JSON.stringify({
        message: "Content created successfully",
        content: {
          id: result.meta.last_row_id,
          project_id,
          title,
          url,
          pathname,
          created_at: Date.now()
        }
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Create content error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to create content" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Update content endpoint
  if (url.pathname === "/api/content" && request.method === "PATCH") {
    try {
      // IP rate limiting
      if (env.RL_OFF !== "1") {
        try {
          const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "0.0.0.0";
          const metrics = new MetricsManager(env.CACHE);
          const { ok, remaining, resetAt } = await ipRateLimit(env.RL, ip, "/api/content", 120, 60, metrics);
          if (!ok) {
            const response = new Response(JSON.stringify({
              error: "rate_limited",
              retry_after: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
            }), {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "60"
              }
            });
            return addCorsHeaders(response, origin);
          }
        } catch (e) {
          console.error("Rate limiting error:", e);
          // Continue if rate limiting fails
        }
      }

      const body = await request.json();
      const { id, title, url, pathname } = body;

      if (!id) {
        const response = new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Get current content to get project_id
      const currentContent = await d1.prepare(`
        SELECT project_id FROM content_assets WHERE id = ?
      `).bind(id).first();

      if (!currentContent) {
        const response = new Response(JSON.stringify({ error: "Content not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Build update query dynamically
      const updates = [];
      const values = [];
      if (title !== undefined) {
        updates.push("title = ?");
        values.push(title);
      }
      if (url !== undefined) {
        updates.push("url = ?");
        values.push(url);
      }
      if (pathname !== undefined) {
        updates.push("pathname = ?");
        values.push(pathname);
      }

      if (updates.length === 0) {
        const response = new Response(JSON.stringify({ error: "No fields to update" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      updates.push("updated_at = ?");
      values.push(Date.now());
      values.push(id);

      // Update content
      await d1.prepare(`
        UPDATE content_assets SET ${updates.join(", ")} WHERE id = ?
      `).bind(...values).run();

      // Invalidate cache for this project
      try {
        await bumpProjectVersion(env.CACHE, currentContent.project_id);
      } catch (e) {
        console.error("Failed to invalidate cache:", e);
      }

      const response = new Response(JSON.stringify({
        message: "Content updated successfully"
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Update content error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to update content" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Delete content endpoint
  if (url.pathname === "/api/content" && request.method === "DELETE") {
    try {
      // IP rate limiting
      if (env.RL_OFF !== "1") {
        try {
          const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "0.0.0.0";
          const metrics = new MetricsManager(env.CACHE);
          const { ok, remaining, resetAt } = await ipRateLimit(env.RL, ip, "/api/content", 120, 60, metrics);
          if (!ok) {
            const response = new Response(JSON.stringify({
              error: "rate_limited",
              retry_after: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
            }), {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "60"
              }
            });
            return addCorsHeaders(response, origin);
          }
        } catch (e) {
          console.error("Rate limiting error:", e);
          // Continue if rate limiting fails
        }
      }

      const body = await request.json();
      const { id } = body;

      if (!id) {
        const response = new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Get current content to get project_id
      const currentContent = await d1.prepare(`
        SELECT project_id FROM content_assets WHERE id = ?
      `).bind(id).first();

      if (!currentContent) {
        const response = new Response(JSON.stringify({ error: "Content not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Delete content
      await d1.prepare(`
        DELETE FROM content_assets WHERE id = ?
      `).bind(id).run();

      // Invalidate cache for this project
      try {
        await bumpProjectVersion(env.CACHE, currentContent.project_id);
      } catch (e) {
        console.error("Failed to invalidate cache:", e);
      }

      const response = new Response(JSON.stringify({
        message: "Content deleted successfully"
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Delete content error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to delete content" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  return null; // Not handled by this router
}

import { addCorsHeaders } from '../cors';
import { hashToken } from '../auth';

export async function handleApiKeyRoutes(url: URL, request: Request, env: any, d1: any, origin: string) {
  // Get API keys endpoint
  if (url.pathname === "/api/keys" && request.method === "GET") {
    try {
      const projectId = url.searchParams.get("project_id");
      if (!projectId) {
        const response = new Response(JSON.stringify({ error: "project_id is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Get API keys for project
      const keys = await d1.prepare(`
        SELECT id, name, created_at, last_used_ts, revoked_ts
        FROM api_key 
        WHERE project_id = ? 
        ORDER BY created_at DESC
      `).bind(projectId).all();

      const response = new Response(JSON.stringify({
        keys: keys.results || [],
        total: keys.results?.length || 0
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Get API keys error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to get API keys" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Create API key endpoint
  if (url.pathname === "/api/keys" && request.method === "POST") {
    try {
      const body = await request.json();
      const { project_id, name } = body;

      if (!project_id || !name) {
        const response = new Response(JSON.stringify({ error: "project_id and name are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Generate API key
      const keyId = `opt_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      const keyHash = await hashToken(keyId);

      // Store API key
      const result = await d1.prepare(`
        INSERT INTO api_key (project_id, name, key_id, hash, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(project_id, name, keyId, keyHash, Date.now()).run();

      const response = new Response(JSON.stringify({
        message: "API key created successfully",
        key: {
          id: result.meta.last_row_id,
          key_id: keyId,
          name,
          project_id,
          created_at: Date.now()
        }
      }), {
        status: 201,
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

  // Revoke API key endpoint
  if (url.pathname === "/api/keys/revoke" && request.method === "POST") {
    try {
      const body = await request.json();
      const { key_id } = body;

      if (!key_id) {
        const response = new Response(JSON.stringify({ error: "key_id is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Revoke API key
      await d1.prepare(`
        UPDATE api_key SET revoked_ts = ? WHERE key_id = ?
      `).bind(Date.now(), key_id).run();

      const response = new Response(JSON.stringify({
        message: "API key revoked successfully"
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Revoke API key error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to revoke API key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  return null; // Not handled by this router
}

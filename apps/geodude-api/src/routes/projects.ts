import { addCorsHeaders } from '../cors';

export async function handleProjectRoutes(url: URL, request: Request, env: any, d1: any, origin: string) {
  // Get projects endpoint
  if (url.pathname === "/api/projects" && request.method === "GET") {
    try {
      const organizationId = url.searchParams.get("organization_id");
      if (!organizationId) {
        const response = new Response(JSON.stringify({ error: "organization_id is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Get projects for organization
      const projects = await d1.prepare(`
        SELECT id, name, created_at, updated_at
        FROM projects 
        WHERE organization_id = ? 
        ORDER BY created_at DESC
      `).bind(organizationId).all();

      const response = new Response(JSON.stringify({
        projects: projects.results || [],
        total: projects.results?.length || 0
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Get projects error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to get projects" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Create project endpoint
  if (url.pathname === "/api/projects" && request.method === "POST") {
    try {
      const body = await request.json();
      const { name, organization_id } = body;

      if (!name || !organization_id) {
        const response = new Response(JSON.stringify({ error: "name and organization_id are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Create project
      const result = await d1.prepare(`
        INSERT INTO projects (name, organization_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).bind(name, organization_id, Date.now(), Date.now()).run();

      const response = new Response(JSON.stringify({
        message: "Project created successfully",
        project: {
          id: result.meta.last_row_id,
          name,
          organization_id,
          created_at: Date.now()
        }
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Create project error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to create project" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Get properties endpoint
  if (url.pathname === "/api/properties" && request.method === "GET") {
    try {
      const projectId = url.searchParams.get("project_id");
      if (!projectId) {
        const response = new Response(JSON.stringify({ error: "project_id is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Get properties for project
      const properties = await d1.prepare(`
        SELECT id, name, domain, created_at, updated_at
        FROM properties 
        WHERE project_id = ? 
        ORDER BY created_at DESC
      `).bind(projectId).all();

      const response = new Response(JSON.stringify({
        properties: properties.results || [],
        total: properties.results?.length || 0
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Get properties error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to get properties" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Create property endpoint
  if (url.pathname === "/api/properties" && request.method === "POST") {
    try {
      const body = await request.json();
      const { name, domain, project_id } = body;

      if (!name || !domain || !project_id) {
        const response = new Response(JSON.stringify({ error: "name, domain, and project_id are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Validate domain format
      try {
        new URL(`https://${domain}`);
      } catch (e) {
        const response = new Response(JSON.stringify({ error: "Invalid domain format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Create property
      const result = await d1.prepare(`
        INSERT INTO properties (name, domain, project_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(name, domain, project_id, Date.now(), Date.now()).run();

      const response = new Response(JSON.stringify({
        message: "Property created successfully",
        property: {
          id: result.meta.last_row_id,
          name,
          domain,
          project_id,
          created_at: Date.now()
        }
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Create property error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to create property" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Onboarding property endpoint
  if (url.pathname === "/api/onboarding/property" && request.method === "POST") {
    try {
      const body = await request.json();
      const { name, domain, project_id } = body;

      if (!name || !domain || !project_id) {
        const response = new Response(JSON.stringify({ error: "name, domain, and project_id are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Validate domain format
      try {
        new URL(`https://${domain}`);
      } catch (e) {
        const response = new Response(JSON.stringify({ error: "Invalid domain format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Create property
      const result = await d1.prepare(`
        INSERT INTO properties (name, domain, project_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(name, domain, project_id, Date.now(), Date.now()).run();

      const response = new Response(JSON.stringify({
        message: "Property created successfully",
        property: {
          id: result.meta.last_row_id,
          name,
          domain,
          project_id,
          created_at: Date.now()
        }
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Create onboarding property error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to create property" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Onboarding API key endpoint
  if (url.pathname === "/api/onboarding/api-key" && request.method === "POST") {
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
      const keyHash = await import('../auth').then(m => m.hashToken(keyId));

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
      console.error("Create onboarding API key error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to create API key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  return null; // Not handled by this router
}

import { addCorsHeaders } from '../cors';
import { EmailService } from '../email-service';
import { hashString } from '../utils';

export async function handleAuthRoutes(url: URL, request: Request, env: any, d1: any, origin: string) {
  // Auth request code endpoint
  if (url.pathname === "/auth/request-code" && request.method === "POST") {
    try {
      const body = await request.json();
      const { email } = body;

      if (!email) {
        const response = new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Generate verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutes

      // Store code in database
      await d1.prepare(`
        INSERT OR REPLACE INTO verification_codes (email, code, expires_at)
        VALUES (?, ?, ?)
      `).bind(email, code, expiresAt).run();

      // Send email
      const emailService = new EmailService(env);
      await emailService.sendVerificationCode(email, code);

      const response = new Response(JSON.stringify({
        message: "Verification code sent",
        expires_in: 15 * 60 // 15 minutes in seconds
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Request code error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to send verification code" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Auth request magic link endpoint
  if (url.pathname === "/api/auth/request-link" && request.method === "POST") {
    try {
      const body = await request.json();
      const { email } = body;

      if (!email) {
        const response = new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Generate magic link token
      const token = await hashString(email + Date.now().toString());
      const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutes

      // Store token in database
      await d1.prepare(`
        INSERT OR REPLACE INTO magic_links (email, token, expires_at)
        VALUES (?, ?, ?)
      `).bind(email, token, expiresAt).run();

      // Send email
      const emailService = new EmailService(env);
      const magicLink = `${env.PUBLIC_APP_URL}/auth/magic?token=${token}`;
      await emailService.sendMagicLink(email, magicLink);

      const response = new Response(JSON.stringify({
        message: "Magic link sent",
        expires_in: 15 * 60 // 15 minutes in seconds
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Request magic link error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to send magic link" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Magic link verification endpoint
  if (url.pathname === "/auth/magic" && request.method === "GET") {
    try {
      const token = url.searchParams.get("token");
      if (!token) {
        const response = new Response(JSON.stringify({ error: "Token is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Verify token
      const magicLink = await d1.prepare(`
        SELECT * FROM magic_links WHERE token = ? AND expires_at > ?
      `).bind(token, Date.now()).first();

      if (!magicLink) {
        const response = new Response(JSON.stringify({ error: "Invalid or expired token" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Create or get user
      let user = await d1.prepare(`
        SELECT * FROM users WHERE email = ?
      `).bind(magicLink.email).first();

      if (!user) {
        // Create new user
        const result = await d1.prepare(`
          INSERT INTO users (email, created_at, last_login)
          VALUES (?, ?, ?)
        `).bind(magicLink.email, Date.now(), Date.now()).run();
        user = { id: result.meta.last_row_id, email: magicLink.email };
      } else {
        // Update last login
        await d1.prepare(`
          UPDATE users SET last_login = ? WHERE id = ?
        `).bind(Date.now(), user.id).run();
      }

      // Delete used token
      await d1.prepare(`
        DELETE FROM magic_links WHERE token = ?
      `).bind(token).run();

      // Generate session token
      const sessionToken = await hashString(user.id + Date.now().toString());
      const sessionExpiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

      // Store session
      await d1.prepare(`
        INSERT INTO user_sessions (user_id, token, expires_at)
        VALUES (?, ?, ?)
      `).bind(user.id, sessionToken, sessionExpiresAt).run();

      const response = new Response(JSON.stringify({
        message: "Authentication successful",
        user: { id: user.id, email: user.email },
        session_token: sessionToken,
        expires_in: 24 * 60 * 60 // 24 hours in seconds
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Magic link verification error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to verify magic link" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Onboarding organization endpoint
  if (url.pathname === "/api/onboarding/organization" && request.method === "POST") {
    try {
      const body = await request.json();
      const { name, email } = body;

      if (!name || !email) {
        const response = new Response(JSON.stringify({ error: "Name and email are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Create organization
      const result = await d1.prepare(`
        INSERT INTO organizations (name, created_at)
        VALUES (?, ?)
      `).bind(name, Date.now()).run();

      const orgId = result.meta.last_row_id;

      // Create user if doesn't exist
      let user = await d1.prepare(`
        SELECT * FROM users WHERE email = ?
      `).bind(email).first();

      if (!user) {
        const userResult = await d1.prepare(`
          INSERT INTO users (email, created_at, last_login)
          VALUES (?, ?, ?)
        `).bind(email, Date.now(), Date.now()).run();
        user = { id: userResult.meta.last_row_id, email };
      }

      // Add user to organization as admin
      await d1.prepare(`
        INSERT INTO organization_users (organization_id, user_id, role, joined_at)
        VALUES (?, ?, ?, ?)
      `).bind(orgId, user.id, 'admin', Date.now()).run();

      const response = new Response(JSON.stringify({
        message: "Organization created successfully",
        organization: { id: orgId, name },
        user: { id: user.id, email: user.email }
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Create organization error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to create organization" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Onboarding project endpoint
  if (url.pathname === "/api/onboarding/project" && request.method === "POST") {
    try {
      const body = await request.json();
      const { name, organization_id } = body;

      if (!name || !organization_id) {
        const response = new Response(JSON.stringify({ error: "Name and organization_id are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Create project
      const result = await d1.prepare(`
        INSERT INTO project (name, organization_id, created_at)
        VALUES (?, ?, ?)
      `).bind(name, organization_id, Date.now()).run();

      const projectId = result.meta.last_row_id;

      const response = new Response(JSON.stringify({
        message: "Project created successfully",
        project: { id: projectId, name, organization_id }
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

  // Get current user endpoint
  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    try {
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const response = new Response(JSON.stringify({ error: "Authorization header required" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      const token = authHeader.substring(7);

      // Get user from session
      const session = await d1.prepare(`
        SELECT us.*, u.email, u.created_at
        FROM user_sessions us
        JOIN users u ON u.id = us.user_id
        WHERE us.token = ? AND us.expires_at > ?
      `).bind(token, Date.now()).first();

      if (!session) {
        const response = new Response(JSON.stringify({ error: "Invalid or expired session" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      const response = new Response(JSON.stringify({
        user: {
          id: session.user_id,
          email: session.email,
          created_at: session.created_at
        }
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Get user error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to get user" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  // Invite accept endpoint
  if (url.pathname === "/invite/accept" && request.method === "GET") {
    try {
      const token = url.searchParams.get("token");
      if (!token) {
        const response = new Response(JSON.stringify({ error: "Token is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Verify invite token
      const invite = await d1.prepare(`
        SELECT * FROM invites WHERE token = ? AND expires_at > ? AND accepted_at IS NULL
      `).bind(token, Date.now()).first();

      if (!invite) {
        const response = new Response(JSON.stringify({ error: "Invalid or expired invite" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response, origin);
      }

      // Mark invite as accepted
      await d1.prepare(`
        UPDATE invites SET accepted_at = ? WHERE id = ?
      `).bind(Date.now(), invite.id).run();

      const response = new Response(JSON.stringify({
        message: "Invite accepted successfully",
        organization_id: invite.organization_id
      }), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    } catch (e) {
      console.error("Accept invite error:", e);
      const response = new Response(JSON.stringify({ error: "Failed to accept invite" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response, origin);
    }
  }

  return null; // Not handled by this router
}

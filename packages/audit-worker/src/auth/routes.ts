/**
 * Auth API routes for magic link authentication
 */

import { 
  issueMagicToken, 
  verifyMagicToken, 
  getSession, 
  touchSession, 
  deleteSession,
  checkRateLimit,
  verifyAuditOwnership 
} from './service';
import { sendMagicLinkEmail } from './email';
import { 
  makeSessionCookie, 
  clearSessionCookie, 
  readCookie,
  getClientIp,
  getUserAgent 
} from './cookies';
import { logAuthEvent, getAuthStats } from './telemetry';

/**
 * Helper to create JSON responses with CORS headers
 */
function jsonResponse(data: any, status: number, request: Request): Response {
  const origin = request.headers.get('Origin') || 'https://app.optiview.ai';
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    }
  });
}

export interface Env {
  DB: D1Database;
  AUTH_LOGS: KVNamespace;
  SMTP2GO_API_KEY: string;
  APP_BASE_URL?: string;
  COOKIE_NAME?: string;
  COOKIE_TTL_DAYS?: string;
  MAGIC_TOKEN_TTL_MIN?: string;
  MAGIC_REQUESTS_PER_HOUR?: string;
}

/**
 * POST /v1/auth/magic/request
 * Request a magic link
 */
export async function handleMagicLinkRequest(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { email, intent, auditId, payload, redirectPath } = body;

    // Validate inputs
    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid email format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!intent || !['start_audit', 'open_audit', 'general'].includes(intent)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid intent' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Rate limiting (check both email and IP)
    const clientIp = getClientIp(request);
    const maxRequests = parseInt(env.MAGIC_REQUESTS_PER_HOUR || '5', 10);

    const emailLimit = await checkRateLimit(env.DB, `email:${normalizedEmail}`, maxRequests);
    if (!emailLimit.allowed) {
      console.warn(`[AUTH] Rate limit exceeded for email: ${normalizedEmail}`);
      
      // Log rate limit event
      await logAuthEvent(env.AUTH_LOGS, {
        event: 'rate_limit_hit',
        email: normalizedEmail,
        metadata: { limitType: 'email', maxRequests }
      }, request);
      
      // Still return 200 to prevent enumeration
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (clientIp) {
      const ipLimit = await checkRateLimit(env.DB, `ip:${clientIp}`, maxRequests);
      if (!ipLimit.allowed) {
        console.warn(`[AUTH] Rate limit exceeded for IP: ${clientIp}`);
        // Still return 200 to prevent enumeration
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Issue magic token
    const baseUrl = env.APP_BASE_URL || 'https://app.optiview.ai';
    const ttlMinutes = parseInt(env.MAGIC_TOKEN_TTL_MIN || '20', 10);
    const userAgent = getUserAgent(request);

    const result = await issueMagicToken(env.DB, {
      email: normalizedEmail,
      intent,
      auditId,
      payload,
      redirectPath,
      ipAddress: clientIp ?? undefined,
      userAgent: userAgent ?? undefined
    }, {
      baseUrl,
      ttlMinutes
    });

    // Send email
    const domain = payload?.domain || (auditId ? 'this audit' : undefined);
    const emailResult = await sendMagicLinkEmail(env.SMTP2GO_API_KEY, {
      to: normalizedEmail,
      verifyUrl: result.verifyUrl,
      expiresMinutes: ttlMinutes,
      domain
    });

    if (!emailResult.ok) {
      console.error('[AUTH] Failed to send magic link email:', emailResult.error);
      return new Response(JSON.stringify({ ok: false, error: 'Failed to send email' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AUTH] Magic link sent to ${normalizedEmail} (intent: ${intent})`);

    // Log telemetry event
    await logAuthEvent(env.AUTH_LOGS, {
      event: 'magic_request_sent',
      email: normalizedEmail,
      intent,
      metadata: { auditId, domain }
    }, request);

    // Always return 200 to prevent email enumeration
    return jsonResponse({ ok: true }, 200, request);

  } catch (error) {
    console.error('[AUTH] Error in handleMagicLinkRequest:', error);
    return jsonResponse({ ok: false, error: 'Internal server error' }, 500, request);
  }
}

/**
 * GET /v1/auth/magic/verify?token=...
 * Verify magic link token and create session
 */
export async function handleMagicLinkVerify(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const rawToken = url.searchParams.get('token');

    if (!rawToken) {
      return Response.redirect(`${env.APP_BASE_URL || 'https://app.optiview.ai'}/auth/error?reason=missing`, 302);
    }

    const sessionTtlDays = parseInt(env.COOKIE_TTL_DAYS || '30', 10);
    const result = await verifyMagicToken(env.DB, rawToken, { sessionTtlDays });

    if (!result.ok) {
      // Log failed verification
      await logAuthEvent(env.AUTH_LOGS, {
        event: 'magic_verify_fail',
        reason: 'expired_or_invalid'
      }, request);
      
      return Response.redirect(`${env.APP_BASE_URL || 'https://app.optiview.ai'}/auth/error?reason=expired_or_invalid`, 302);
    }

    // Create session cookie
    const cookieName = env.COOKIE_NAME || 'ov_sess';
    const setCookie = makeSessionCookie(cookieName, result.sessionId!, sessionTtlDays);

    console.log(`[AUTH] User verified: ${result.user!.email} (intent: ${result.intent})`);

    // Log successful verification
    await logAuthEvent(env.AUTH_LOGS, {
      event: 'magic_verify_success',
      email: result.user!.email,
      userId: result.user!.id,
      sessionId: result.sessionId!,
      intent: result.intent,
      metadata: { auditId: result.auditId }
    }, request);

    // Log session creation
    await logAuthEvent(env.AUTH_LOGS, {
      event: 'session_created',
      email: result.user!.email,
      userId: result.user!.id,
      sessionId: result.sessionId!
    }, request);

    // Handle intent-specific redirects
    let redirectUrl = result.redirectPath || '/';

    if (result.intent === 'start_audit' && result.payload) {
      // Redirect to the audits page with the audit details in the URL
      // The frontend will then call POST /api/audits to create and start the audit
      try {
        const audit = result.payload as any;
        console.log(`[AUTH] User verified for audit: ${audit.root_url}`);
        
        // Store audit details in URL params for the frontend to use
        const auditParams = new URLSearchParams({
          project_id: audit.project_id || 'default',
          root_url: audit.root_url,
          site_description: audit.site_description || '',
          max_pages: String(audit.max_pages || 50)
        });
        
        redirectUrl = `/audits/new?${auditParams.toString()}`;
        
      } catch (error) {
        console.error('[AUTH] Failed to prepare audit:', error);
        return Response.redirect(`${env.APP_BASE_URL || 'https://app.optiview.ai'}/auth/error?reason=internal_error`, 302);
      }
    } else if (result.intent === 'open_audit' && result.auditId) {
      // Verify ownership
      const hasAccess = await verifyAuditOwnership(env.DB, result.auditId, result.user!.id);
      if (!hasAccess) {
        return Response.redirect(`${env.APP_BASE_URL || 'https://app.optiview.ai'}/auth/error?reason=unauthorized`, 302);
      }
      redirectUrl = `/audits/${result.auditId}`;
    }

    const fullRedirectUrl = `${env.APP_BASE_URL || 'https://app.optiview.ai'}${redirectUrl}`;

    // Return JSON response with cookie and redirect info (for CORS compatibility)
    const origin = request.headers.get('Origin') || 'https://app.optiview.ai';
    return new Response(JSON.stringify({
      ok: true,
      redirectTo: redirectUrl,
      user: {
        email: result.user!.email,
        userId: result.user!.id
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': setCookie,
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      }
    });

  } catch (error) {
    console.error('[AUTH] Error in handleMagicLinkVerify:', error);
    return Response.redirect(`${env.APP_BASE_URL || 'https://app.optiview.ai'}/auth/error?reason=internal_error`, 302);
  }
}

/**
 * GET /v1/auth/me
 * Get current user session
 */
export async function handleAuthMe(request: Request, env: Env): Promise<Response> {
  try {
    const cookieName = env.COOKIE_NAME || 'ov_sess';
    const sessionId = readCookie(request, cookieName);

    if (!sessionId) {
      return jsonResponse({ ok: false, error: 'Not authenticated' }, 401, request);
    }

    const session = await getSession(env.DB, sessionId);

    if (!session) {
      return jsonResponse({ ok: false, error: 'Session expired' }, 401, request);
    }

    // Touch session (update last_seen_at)
    await touchSession(env.DB, sessionId);

    // Log session refresh
    await logAuthEvent(env.AUTH_LOGS, {
      event: 'session_refresh',
      email: session.email,
      userId: session.user_id,
      sessionId
    }, request);

    return jsonResponse({
      ok: true,
      email: session.email,
      userId: session.user_id,
      isAdmin: Boolean(session.is_admin),
      session: {
        createdAt: session.created_at,
        lastSeenAt: session.last_seen_at,
        authAgeAt: session.auth_age_at
      }
    }, 200, request);

  } catch (error) {
    console.error('[AUTH] Error in handleAuthMe:', error);
    return jsonResponse({ ok: false, error: 'Internal server error' }, 500, request);
  }
}

/**
 * POST /v1/auth/logout
 * Logout user (delete session)
 */
export async function handleAuthLogout(request: Request, env: Env): Promise<Response> {
  try {
    const cookieName = env.COOKIE_NAME || 'ov_sess';
    const sessionId = readCookie(request, cookieName);

    if (sessionId) {
      // Get session info before deleting for telemetry
      const session = await getSession(env.DB, sessionId);
      
      await deleteSession(env.DB, sessionId);
      
      // Log session deletion
      if (session) {
        await logAuthEvent(env.AUTH_LOGS, {
          event: 'session_deleted',
          email: session.email,
          userId: session.user_id,
          sessionId
        }, request);
      }
    }

    const clearCookie = clearSessionCookie(cookieName);
    const origin = request.headers.get('Origin') || 'https://app.optiview.ai';

    return new Response(null, {
      status: 204,
      headers: {
        'Set-Cookie': clearCookie,
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      }
    });

  } catch (error) {
    console.error('[AUTH] Error in handleAuthLogout:', error);
    return jsonResponse({ ok: false, error: 'Internal server error' }, 500, request);
  }
}

/**
 * GET /v1/auth/users
 * Get all users with stats (admin only)
 */
export async function handleGetUsers(request: Request, env: Env): Promise<Response> {
  try {
    // Get all users with last login info and audit counts
    const users = await env.DB.prepare(`
      SELECT 
        u.id,
        u.email,
        u.created_at,
        MAX(s.last_seen_at) as last_login_at,
        COUNT(DISTINCT a.id) as audit_count,
        COUNT(DISTINCT CASE 
          WHEN datetime(s.expires_at) > datetime('now') THEN s.id 
          ELSE NULL 
        END) as active_sessions
      FROM users u
      LEFT JOIN sessions s ON u.id = s.user_id
      LEFT JOIN audits a ON u.id = a.user_id
      GROUP BY u.id, u.email, u.created_at
      ORDER BY u.created_at DESC
    `).all();

    return new Response(JSON.stringify({
      ok: true,
      users: users.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[AUTH] Error in handleGetUsers:', error);
    return new Response(JSON.stringify({ ok: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /v1/auth/stats
 * Get auth statistics (admin only)
 */
export async function handleGetAuthStats(request: Request, env: Env): Promise<Response> {
  try {
    const stats = await getAuthStats(env.AUTH_LOGS);

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[AUTH] Error in handleGetAuthStats:', error);
    return new Response(JSON.stringify({ ok: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

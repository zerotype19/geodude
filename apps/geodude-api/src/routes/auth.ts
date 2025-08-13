import { Request, Response } from '@cloudflare/workers-types';
import { Env } from '../types';
import { 
  normalizeEmail, 
  generateOTPCode, 
  generateOTPExpiry, 
  hashSensitiveData,
  generateMagicLinkToken,
  generateMagicLinkExpiry,
  validateContinuePath
} from '../auth';
import { getOrCreateUser, createSession, deleteSession, setSessionCookie, clearSessionCookie } from '../auth-middleware';
import { EmailService } from '../email-service';
import { createRateLimiter } from '../rate-limiter';
import { getClientIP } from '../utils';
import { log } from '../logging';

export async function handleAuthRoutes(
  req: Request, 
  env: Env, 
  url: URL, 
  origin: string | null,
  attach: (resp: Response) => Response,
  addBasicSecurityHeaders: (resp: Response) => Response,
  addCorsHeaders: (resp: Response, origin: string | null) => Response
): Promise<Response | null> {
  // 7.1) Request OTP Code
  if (url.pathname === "/auth/request-code" && req.method === "POST") {
    try {
      // Check Content-Type
      const contentType = req.headers.get("content-type") as string;
      if (!contentType || !contentType.includes("application/json")) {
        const response = new Response("Content-Type must be application/json", { status: 415 });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      const body = await req.json() as { email: string };
      const { email } = body;

      if (!email) {
        const response = new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Normalize and validate email
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        const response = new Response(JSON.stringify({ error: "Invalid email format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Rate limiting by IP
      const clientIP = getClientIP(req);
      const loginRateLimiter = createRateLimiter({
        rps: parseInt(env.LOGIN_RPM_PER_IP || "10") / 60,
        burst: 1,
        retryAfter: 60
      });
      const rateLimitResult = loginRateLimiter.tryConsume(`login_ip_${clientIP}`);

      if (!rateLimitResult.allowed) {
        const response = new Response(JSON.stringify({
          error: "Rate limit exceeded",
          retry_after: rateLimitResult.retryAfter
        }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": rateLimitResult.retryAfter?.toString() || "60"
          }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Rate limiting by email per day
      const emailRateLimiter = createRateLimiter({
        rps: parseInt(env.LOGIN_RPD_PER_EMAIL || "50") / 86400,
        burst: 1,
        retryAfter: 86400
      });
      const emailRateLimitResult = emailRateLimiter.tryConsume(`login_email_${normalizedEmail}`);

      if (!emailRateLimitResult.allowed) {
        const response = new Response(JSON.stringify({
          error: "Too many requests for this email",
          retry_after: emailRateLimitResult.retryAfter
        }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": emailRateLimitResult.retryAfter?.toString() || "86400"
          }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Get or create user
      if (!normalizedEmail) {
        const response = new Response(JSON.stringify({ error: "Invalid email format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // @ts-ignore - normalizedEmail is checked above
      const user = await getOrCreateUser(env, normalizedEmail);

      // Generate OTP code
      const otpCode = generateOTPCode();
      const otpHash = await hashSensitiveData(otpCode);
      const expiresAt = generateOTPExpiry(parseInt(env.OTP_EXP_MIN || "10"));
      const ipHash = await hashSensitiveData(clientIP);

      // Store OTP code
      await env.OPTIVIEW_DB.prepare(`
        INSERT INTO login_code (email, code_hash, created_at, expires_at, requester_ip_hash)
        VALUES (?, ?, datetime('now'), ?, ?)
      `).bind(normalizedEmail, otpHash, expiresAt.toISOString(), ipHash).run();

      // Send email
      const emailService = EmailService.fromEnv(env);
      // @ts-ignore - normalizedEmail is checked above
      const htmlContent = emailService.generateOTPEmailHTML(normalizedEmail, otpCode, parseInt(env.OTP_EXP_MIN || "10"));
      // @ts-ignore - normalizedEmail is checked above
      const textContent = emailService.generateOTPEmailText(normalizedEmail, otpCode, parseInt(env.OTP_EXP_MIN || "10"));

      await emailService.sendEmail({
        // @ts-ignore - normalizedEmail is checked above
        to: normalizedEmail,
        subject: "Your Optiview Login Code",
        html: htmlContent,
        text: textContent
      });

      // Log the request (without the actual code)
      log("otp_requested", {
        email_hash: await hashSensitiveData(normalizedEmail),
        ip_hash: ipHash,
        user_id: user.id
      });

      // Always return success (no user enumeration)
      const response = new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" }
      });
      return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

    } catch (e: any) {
      log("otp_request_error", { error: e.message, stack: e.stack });
      const response = new Response(JSON.stringify({ ok: true }), { // Still no user enumeration
        headers: { "Content-Type": "application/json" }
      });
      return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
    }
  }

  // 7.2) Verify OTP Code
  if (url.pathname === "/auth/verify-code" && req.method === "POST") {
    try {
      // Check Content-Type
      const contentType = req.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const response = new Response("Content-Type must be application/json", { status: 415 });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      const body = await req.json() as { email: string; code: string };
      const { email, code } = body;

      if (!email || !code) {
        const response = new Response(JSON.stringify({ error: "Email and code are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Normalize email
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        const response = new Response(JSON.stringify({ error: "Invalid email format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Find the latest unconsumed code for this email
      const loginCode = await env.OPTIVIEW_DB.prepare(`
        SELECT * FROM login_code 
        WHERE email = ? AND consumed_at IS NULL
        ORDER BY created_at DESC 
        LIMIT 1
      `).bind(normalizedEmail).first<any>();

      if (!loginCode) {
        const response = new Response(JSON.stringify({ error: "Invalid or expired code" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Check if code is expired
      if (new Date(loginCode.expires_at) < new Date()) {
        const response = new Response(JSON.stringify({ error: "Invalid or expired code" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Check if code is locked
      if (loginCode.attempts >= 5) {
        const response = new Response(JSON.stringify({ error: "Code is locked due to too many attempts" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Verify code hash
      const codeHash = await hashSensitiveData(code);
      if (codeHash !== loginCode.code_hash) {
        // Increment attempts
        await env.OPTIVIEW_DB.prepare(`
          UPDATE login_code SET attempts = attempts + 1 WHERE id = ?
        `).bind(loginCode.id).run();

        // Log failed attempt
        log("otp_verification_failed", {
          email_hash: await hashSensitiveData(normalizedEmail),
          ip_hash: await hashSensitiveData(getClientIP(req)),
          attempts: loginCode.attempts + 1
        });

        const response = new Response(JSON.stringify({ error: "Invalid or expired code" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Code is valid - mark as consumed
      await env.OPTIVIEW_DB.prepare(`
        UPDATE login_code SET consumed_at = datetime('now') WHERE id = ?
      `).bind(loginCode.id).run();

      // Get or create user
      const user = await getOrCreateUser(env, normalizedEmail);

      // Create session
      const sessionId = await createSession(env, user.id, req, parseInt(env.SESSION_TTL_HOURS || "720"));

      // Set session cookie
      const response = new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" }
      });

      setSessionCookie(response, sessionId, parseInt(env.SESSION_TTL_HOURS || "720") * 3600);

      // Log successful login
      log("otp_verification_success", {
        email_hash: await hashSensitiveData(normalizedEmail),
        ip_hash: await hashSensitiveData(getClientIP(req)),
        user_id: user.id
      });

      return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

    } catch (e: any) {
      log("otp_verification_error", { error: e.message, stack: e.stack });
      const response = new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
    }
  }

  // 7.3) Request Magic Link
  if (url.pathname === "/auth/request-link" && req.method === "POST") {
    try {
      // Check Content-Type
      const contentType = req.headers.get("content-type") as string;
      if (!contentType || !contentType.includes("application/json")) {
        const response = new Response("Content-Type must be application/json", { status: 415 });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      const body = await req.json() as { email: string; continue_path?: string };
      const { email, continue_path } = body;

      if (!email) {
        const response = new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Normalize and validate email
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        const response = new Response(JSON.stringify({ error: "Invalid email format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Validate continue path
      const validatedPath = validateContinuePath(continue_path || '/onboarding');

      // Rate limiting by IP
      const clientIP = getClientIP(req);
      const magicLinkRateLimiter = createRateLimiter({
        rps: parseInt(env.MAGIC_LINK_RPM_PER_IP || "10") / 60,
        burst: 1,
        retryAfter: 60
      });
      const rateLimitResult = magicLinkRateLimiter.tryConsume(`magic_link_ip_${clientIP}`);

      if (!rateLimitResult.allowed) {
        const response = new Response(JSON.stringify({
          error: "Rate limit exceeded",
          retry_after: rateLimitResult.retryAfter
        }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": rateLimitResult.retryAfter?.toString() || "60"
          }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Rate limiting by email per day
      const emailRateLimiter = createRateLimiter({
        rps: parseInt(env.MAGIC_LINK_RPD_PER_EMAIL || "50") / 86400,
        burst: 1,
        retryAfter: 86400
      });
      const emailRateLimitResult = emailRateLimiter.tryConsume(`magic_link_email_${normalizedEmail}`);

      if (!emailRateLimitResult.allowed) {
        const response = new Response(JSON.stringify({
          error: "Too many requests for this email",
          retry_after: emailRateLimitResult.retryAfter
        }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": emailRateLimitResult.retryAfter?.toString() || "86400"
          }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Get or create user
      const user = await getOrCreateUser(env, normalizedEmail);

      // Generate magic link token
      const token = generateMagicLinkToken();
      const tokenHash = await hashSensitiveData(token);
      const expiresAt = generateMagicLinkExpiry(parseInt(env.MAGIC_LINK_EXP_MIN || "15"));
      const ipHash = await hashSensitiveData(clientIP);

      // Store magic link
      await env.OPTIVIEW_DB.prepare(`
        INSERT INTO magic_link (email, token_hash, created_at, expires_at, requester_ip_hash, continue_path)
        VALUES (?, ?, datetime('now'), ?, ?, ?)
      `).bind(normalizedEmail, tokenHash, expiresAt.toISOString(), ipHash, validatedPath).run();

      // Send email
      const emailService = EmailService.fromEnv(env);
      const magicLinkUrl = `${env.PUBLIC_APP_URL || 'http://localhost:3000'}/auth/magic?token=${token}&continue=${encodeURIComponent(validatedPath)}`;

      const htmlContent = emailService.generateMagicLinkEmailHTML(normalizedEmail, magicLinkUrl, parseInt(env.MAGIC_LINK_EXP_MIN || "15"));
      const textContent = emailService.generateMagicLinkEmailText(normalizedEmail, magicLinkUrl, parseInt(env.MAGIC_LINK_EXP_MIN || "15"));

      await emailService.sendEmail({
        to: normalizedEmail,
        subject: "Sign in to Optiview",
        html: htmlContent,
        text: textContent
      });

      // Log the request (without the actual token)
      log("magic_link_requested", {
        email_hash: await hashSensitiveData(normalizedEmail),
        ip_hash: ipHash,
        user_id: user.id
      });

      // Always return success (no user enumeration)
      const response = new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" }
      });
      return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

    } catch (e: any) {
      log("magic_link_request_error", { error: e.message, stack: e.stack });
      const response = new Response(JSON.stringify({ ok: true }), { // Still no user enumeration
        headers: { "Content-Type": "application/json" }
      });
      return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
    }
  }

  // 7.4) Consume Magic Link
  if (url.pathname === "/auth/magic" && req.method === "GET") {
    try {
      const urlObj = new URL(req.url);
      const token = urlObj.searchParams.get('token');
      const continuePath = urlObj.searchParams.get('continue') || '/onboarding';

      if (!token) {
        const response = new Response(JSON.stringify({ error: "Token is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Find the magic link
      const tokenHash = await hashSensitiveData(token);
      const magicLink = await env.OPTIVIEW_DB.prepare(`
        SELECT * FROM magic_link 
        WHERE token_hash = ? AND consumed_at IS NULL
        ORDER BY created_at DESC 
        LIMIT 1
      `).bind(tokenHash).first<any>();

      if (!magicLink) {
        const response = new Response(JSON.stringify({ error: "Invalid or expired link" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Check if link is expired
      if (new Date(magicLink.expires_at) < new Date()) {
        const response = new Response(JSON.stringify({ error: "Link has expired" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
      }

      // Mark as consumed
      await env.OPTIVIEW_DB.prepare(`
        UPDATE magic_link SET consumed_at = datetime('now') WHERE id = ?
      `).bind(magicLink.id).run();

      // Get or create user
      const user = await getOrCreateUser(env, magicLink.email);

      // Create session
      const sessionId = await createSession(env, user.id, req, parseInt(env.SESSION_TTL_HOURS || "720"));

      // Set session cookie and redirect
      const response = new Response(JSON.stringify({
        ok: true,
        redirect_to: magicLink.continue_path || '/onboarding'
      }), {
        headers: { "Content-Type": "application/json" }
      });

      setSessionCookie(response, sessionId, parseInt(env.SESSION_TTL_HOURS || "720") * 3600);

      // Log successful magic link usage
      log("magic_link_consumed", {
        email_hash: await hashSensitiveData(magicLink.email),
        user_id: user.id
      });

      return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

    } catch (e: any) {
      log("magic_link_consumption_error", { error: e.message, stack: e.stack });
      const response = new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
    }
  }

  // 7.5) Logout
  if (url.pathname === "/auth/logout" && req.method === "POST") {
    try {
      const sessionId = req.headers.get('cookie')?.split(';')
        .find(c => c.trim().startsWith('ov_sess='))
        ?.split('=')[1];

      if (sessionId) {
        await deleteSession(env, sessionId);
      }

      const response = new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" }
      });

      clearSessionCookie(response);
      return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

    } catch (e: any) {
      log("logout_error", { error: e.message, stack: e.stack });
      const response = new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
    }
  }

  // 7.6) Get current user
  if (url.pathname === "/auth/me" && req.method === "GET") {
    try {
      const { user } = await requireAuth(req, env);

      const response = new Response(JSON.stringify({
        id: user.id,
        email: user.email,
        is_admin: user.is_admin === 1
      }), {
        headers: { "Content-Type": "application/json" }
      });

      return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));

    } catch (e: any) {
      const response = new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
    }
  }

  return null; // No auth route matched
}

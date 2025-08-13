// Security headers utility for dashboard and API responses
// Applies CSP, X-Content-Type-Options, Referrer-Policy, and Frame-Options

export interface SecurityHeadersConfig {
  cspMode: 'production' | 'development';
}

/**
 * Apply security headers to HTML responses (dashboard)
 */
export function addSecurityHeaders(response: Response, config: SecurityHeadersConfig): Response {
  // Always add these security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Add CSP based on mode
  const csp = generateCSP(config.cspMode);
  response.headers.set('Content-Security-Policy', csp);
  
  return response;
}

/**
 * Apply basic security headers to API responses (no CSP)
 */
export function addBasicSecurityHeaders(response: Response): Response {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

/**
 * Generate CSP policy based on environment
 */
function generateCSP(mode: 'production' | 'development'): string {
  if (mode === 'development') {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.workers.dev http://localhost:5173 ws://localhost:5173 wss://localhost:5173",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');
  }
  
  // Production CSP (strict)
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.workers.dev",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
}

/**
 * Get security headers config from environment
 */
export function getSecurityHeadersConfig(env?: any): SecurityHeadersConfig {
  // For Cloudflare Workers, env vars are passed via bindings
  // Default to production for security
  const mode = 'production';
  return {
    cspMode: mode
  };
}

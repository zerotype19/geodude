// CORS utilities for the API with origin allowlisting
// Supports property domain matching and fallback origins

export interface CorsConfig {
  allowedOriginsFallback: string[];
}

export function addCorsHeaders(response: Response, origin?: string): Response {
  // Always allow preflight requests
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-optiview-key-id, x-optiview-signature, x-optiview-timestamp, cache-control, pragma');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  
  // Set origin based on request, default to frontend origin
  const allowedOrigin = origin || 'https://optiview.ai';
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  
  return response;
}

/**
 * Check if origin is allowed for the given project
 * Allows origins matching registered property domains or fallback origins
 */
export async function isOriginAllowed(
  origin: string, 
  projectId: number, 
  env: Env,
  fallbackOrigins: string[]
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Get project's registered property domains
    const properties = await env.OPTIVIEW_DB.prepare(`
      SELECT domain FROM properties WHERE project_id = ?
    `).bind(projectId).all<{ domain: string }>();
    
    const projectDomains = properties.results?.map(p => p.domain) || [];
    
    // Check if origin matches any project domain
    for (const domain of projectDomains) {
      if (originMatchesDomain(origin, domain)) {
        return { allowed: true };
      }
    }
    
    // Check fallback origins
    for (const fallback of fallbackOrigins) {
      if (originMatchesDomain(origin, fallback)) {
        return { allowed: true };
      }
    }
    
    return { 
      allowed: false, 
      reason: `Origin ${origin} not allowed for project ${projectId}` 
    };
    
  } catch (error) {
    console.error('CORS origin check error:', error);
    // Default to denied on error
    return { 
      allowed: false, 
      reason: 'Error checking origin permissions' 
    };
  }
}

/**
 * Check if origin matches domain (with scheme)
 */
function originMatchesDomain(origin: string, domain: string): boolean {
  try {
    const originUrl = new URL(origin);
    const domainUrl = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
    
    return originUrl.hostname === domainUrl.hostname && 
           originUrl.protocol === domainUrl.protocol;
  } catch {
    // If URL parsing fails, do simple string comparison
    return origin === domain;
  }
}

/**
 * Get CORS config from environment
 */
export function getCorsConfig(env?: any): CorsConfig {
  // For Cloudflare Workers, env vars are passed via bindings
  // Default fallback origins for development
  const fallback = 'https://localhost:3000,https://localhost:5173';
  return {
    allowedOriginsFallback: fallback.split(',').map((s: string) => s.trim()).filter(Boolean)
  };
}

// Types
type Env = {
  OPTIVIEW_DB: D1Database;
};

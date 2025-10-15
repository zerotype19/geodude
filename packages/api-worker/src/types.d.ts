// Type definitions for Cloudflare Workers environment

declare global {
  interface Env {
    // D1 Database
    DB: D1Database;
    
    // KV Namespace
    RATE_LIMIT_KV: KVNamespace;
    
    // R2 Bucket
    R2_BACKUPS: R2Bucket;
    
    // Browser Rendering (Cloudflare)
    BROWSER?: any;
    
  // Environment Variables
  USER_AGENT: string;
  AUDIT_MAX_PAGES: string;
  AUDIT_DAILY_LIMIT: string;
  RATE_LIMIT_DAILY_ENABLED?: string;
    HASH_SALT: string;
    BRAVE_SEARCH_ENDPOINT: string;
    CITATIONS_MAX_PER_QUERY: string;
    CITATIONS_DAILY_BUDGET: string;
    FROM_EMAIL: string;
    RENDER_MODE: string;
    RENDER_TIMEOUT_MS: string;
    RENDER_MAX_PAGES: string;
    
    // Secrets (set via wrangler secret put)
    BRAVE_SEARCH?: string;
    RESEND_KEY?: string;
    RESEND_API_KEY?: string;
    ADMIN_BASIC_AUTH?: string;
    BROWSERLESS_URL?: string;
  }
}

export {};


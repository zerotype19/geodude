// API configuration - Use VITE_API_URL from Cloudflare Pages environment
const configuredApiBase = (import.meta as any).env?.VITE_API_URL || "https://api.optiview.ai";
console.log('🔧 API_BASE Config:', {
  'VITE_API_URL': (import.meta as any).env?.VITE_API_URL,
  'final_API_BASE': configuredApiBase,
  'all_env_vars': (import.meta as any).env,
  'timestamp': new Date().toISOString()
});
export const API_BASE = configuredApiBase;

export const FETCH_OPTS: RequestInit = { credentials: "include" }; // send cookies

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

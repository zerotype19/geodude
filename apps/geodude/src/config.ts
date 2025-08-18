// API configuration
export const API_BASE = (import.meta as any).env?.VITE_API_URL || 
  (location.hostname === "optiview.ai" || location.hostname === "www.optiview.ai"
    ? "https://api.optiview.ai"
    : location.hostname === "staging.optiview.ai" 
    ? "https://api-staging.optiview.ai"
    : location.hostname === "dev.optiview.ai"
    ? "https://api-dev.optiview.ai"
    : "http://127.0.0.1:8787");

export const FETCH_OPTS: RequestInit = { credentials: "include" }; // send cookies

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

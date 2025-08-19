// API configuration
// Using hardcoded URL since VITE_API_URL from Pages dashboard isn't loading during build
export const API_BASE = "https://api.optiview.ai";

// Debug: Check if environment variables are available
const envCheck = {
  VITE_API_URL: (import.meta as any).env.VITE_API_URL,
  NODE_ENV: (import.meta as any).env.NODE_ENV,
  MODE: (import.meta as any).env.MODE,
  hardcoded: true
};
console.log("🔧 API CONFIG - DOMAIN FIX:", { API_BASE, env: envCheck });
console.log("🎯 API_BASE SHOULD BE: https://api.optiview.ai (NOT optiview.ai)");

export const FETCH_OPTS: RequestInit = { credentials: "include" }; // send cookies

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

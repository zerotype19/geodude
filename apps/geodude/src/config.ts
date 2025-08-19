// API configuration - FORCE NEW BUNDLE HASH
// Using hardcoded URL since VITE_API_URL from Pages dashboard isn't loading during build
export const API_BASE = "https://api.optiview.ai";

// FORCE BUNDLE CHANGE - Add timestamp to config
const BUNDLE_FORCE_TIMESTAMP = "2025-08-19T03:52:00Z";
const CONFIG_VERSION = "v4_direct_api_no_redirects";

// Debug: Check if environment variables are available
const envCheck = {
  VITE_API_URL: (import.meta as any).env.VITE_API_URL,
  NODE_ENV: (import.meta as any).env.NODE_ENV,
  MODE: (import.meta as any).env.MODE,
  hardcoded: true,
  bundleForce: BUNDLE_FORCE_TIMESTAMP,
  configVersion: CONFIG_VERSION
};
console.log("🔧 API CONFIG - FINAL FIX:", { API_BASE, env: envCheck });
console.log("🎯 CRITICAL: API_BASE =", API_BASE, "(MUST be api.optiview.ai)");
console.log("📦 CONFIG VERSION:", CONFIG_VERSION);

export const FETCH_OPTS: RequestInit = { credentials: "include" }; // send cookies

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

// API configuration - TEMPORARY FIX: Force API domain
// TODO: Restore environment variable once VITE_API_URL is set in Cloudflare Pages
// const VITE_API_URL = (import.meta as any).env.VITE_API_URL;
// export const API_BASE = VITE_API_URL || "https://api.optiview.ai";
export const API_BASE = "https://api.optiview.ai";

// FORCE BUNDLE CHANGE - Add timestamp to config
const BUNDLE_FORCE_TIMESTAMP = "2025-08-19T04:05:00Z";
const CONFIG_VERSION = "v6_temporary_hardcoded_fix";

// Debug: Check configuration
const envCheck = {
  VITE_API_URL: "TEMPORARILY_DISABLED",
  NODE_ENV: (import.meta as any).env.NODE_ENV,
  MODE: (import.meta as any).env.MODE,
  usingEnvVar: false,
  fallbackUsed: false,
  forcedDomain: true,
  bundleForce: BUNDLE_FORCE_TIMESTAMP,
  configVersion: CONFIG_VERSION
};
console.log("🔧 API CONFIG - TEMPORARY FIX:", { API_BASE, env: envCheck });
console.log("🎯 API_BASE =", API_BASE);
console.log("🌍 Using FORCED DOMAIN:", "✅ YES (api.optiview.ai)");
console.log("📦 CONFIG VERSION:", CONFIG_VERSION);

export const FETCH_OPTS: RequestInit = { credentials: "include" }; // send cookies

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

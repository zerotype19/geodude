// API configuration - Use Cloudflare Pages environment variable
const VITE_API_URL = (import.meta as any).env.VITE_API_URL;
export const API_BASE = VITE_API_URL || "https://api.optiview.ai";

// FORCE BUNDLE CHANGE - Add timestamp to config
const BUNDLE_FORCE_TIMESTAMP = "2025-08-19T03:55:00Z";
const CONFIG_VERSION = "v5_env_var_based";

// Debug: Check if environment variables are available
const envCheck = {
  VITE_API_URL,
  NODE_ENV: (import.meta as any).env.NODE_ENV,
  MODE: (import.meta as any).env.MODE,
  usingEnvVar: !!VITE_API_URL,
  fallbackUsed: !VITE_API_URL,
  bundleForce: BUNDLE_FORCE_TIMESTAMP,
  configVersion: CONFIG_VERSION
};
console.log("🔧 API CONFIG - ENV VAR BASED:", { API_BASE, env: envCheck });
console.log("🎯 API_BASE =", API_BASE);
console.log("🌍 Using ENV VAR:", !!VITE_API_URL ? "✅ YES" : "❌ NO (fallback)");
console.log("📦 CONFIG VERSION:", CONFIG_VERSION);

export const FETCH_OPTS: RequestInit = { credentials: "include" }; // send cookies

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

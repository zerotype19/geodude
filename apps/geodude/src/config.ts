// API configuration - FORCED due to environment variable issues
const FORCE_API_URL = "https://api.optiview.ai";
export const API_BASE = FORCE_API_URL;

// Environment variable debugging
const envDebug = {
  VITE_API_URL: (import.meta as any).env.VITE_API_URL,
  NODE_ENV: (import.meta as any).env.NODE_ENV,
  MODE: (import.meta as any).env.MODE,
  forced: true,
  timestamp: "2025-08-19-02-32"
};
console.log("🔍 FORCED API CONFIG:", envDebug);

export const FETCH_OPTS: RequestInit = { credentials: "include" }; // send cookies

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

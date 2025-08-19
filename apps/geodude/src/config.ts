// API configuration  
export const API_BASE = (import.meta as any).env.VITE_API_URL || "https://api.optiview.ai";

// Debug environment variables in build
console.log("🔍 Environment check:", {
  VITE_API_URL: (import.meta as any).env.VITE_API_URL,
  NODE_ENV: (import.meta as any).env.NODE_ENV,
  MODE: (import.meta as any).env.MODE
});

export const FETCH_OPTS: RequestInit = { credentials: "include" }; // send cookies

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

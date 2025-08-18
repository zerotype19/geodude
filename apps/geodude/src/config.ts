// API configuration - Force correct API URL for production
export const API_BASE = (import.meta as any).env?.VITE_API_URL || "https://api.optiview.ai";

export const FETCH_OPTS: RequestInit = { credentials: "include" }; // send cookies

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

// API configuration - Force correct API URL for production
const configuredApiBase = (import.meta as any).env?.VITE_API_URL || "https://api.optiview.ai";
console.log('🔧 Config loaded - API_BASE:', configuredApiBase, 'env.VITE_API_URL:', (import.meta as any).env?.VITE_API_URL, 'location.hostname:', location.hostname);
export const API_BASE = configuredApiBase;

export const FETCH_OPTS: RequestInit = { credentials: "include" }; // send cookies

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

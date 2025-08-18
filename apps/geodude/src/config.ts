// API configuration - FORCE DEPLOYMENT UPDATE
const configuredApiBase = "https://api.optiview.ai"; // HARDCODED TO FORCE UPDATE
console.log('🚨 FORCED API_BASE:', configuredApiBase, 'DEPLOYMENT_UPDATE:', Date.now());
export const API_BASE = configuredApiBase;

export const FETCH_OPTS: RequestInit = { credentials: "include" }; // send cookies

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

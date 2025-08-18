// API configuration - FORCE DEPLOYMENT UPDATE v2
const configuredApiBase = "https://api.optiview.ai"; // HARDCODED TO FORCE UPDATE  
console.log('🚨🚨 FORCED API_BASE v2:', configuredApiBase, 'DEPLOYMENT_UPDATE:', Date.now(), 'TIMESTAMP:', new Date().toISOString());
export const API_BASE = configuredApiBase;

export const FETCH_OPTS: RequestInit = { credentials: "include" }; // send cookies

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

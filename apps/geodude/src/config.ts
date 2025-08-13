// API configuration
export const API_BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8787").replace(/\/$/, '');

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

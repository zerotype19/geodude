// API configuration
export const API_BASE =
    location.hostname.endsWith("optiview.ai")
        ? "https://api.optiview.ai"
        : "http://127.0.0.1:8787";

export const FETCH_OPTS: RequestInit = { credentials: "include" }; // send cookies

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

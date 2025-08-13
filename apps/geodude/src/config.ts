// API configuration
export const API_BASE =
    location.hostname.endsWith("pages.dev")
        ? "https://geodude-api.kevin-mcgovern.workers.dev"
        : "http://127.0.0.1:8787";

export const FETCH_OPTS: RequestInit = { credentials: "include" }; // send cookies

export const ENABLE_ADMIN = (import.meta as any).env?.VITE_ENABLE_ADMIN === "true";

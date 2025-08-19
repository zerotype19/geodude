import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// ENV VAR BASED CONFIG: Use Cloudflare Pages VITE_API_URL
const DEPLOYMENT_ID = "ENV_VAR_CONFIG_" + Date.now() + "_" + Math.random().toString(36).substring(2);
const FORCED_TIMESTAMP = "2025-08-19T03:55:00Z";
const ENV_VAR_VERSION = "v5_cloudflare_env_vars";
const CACHE_BUST = Math.random().toString(36) + Date.now().toString(36);
console.log("🚀 ENV VAR CONFIG - CLOUDFLARE PAGES:", { 
  DEPLOYMENT_ID, 
  FORCED_TIMESTAMP, 
  ENV_VAR_VERSION, 
  CACHE_BUST,
  source: "main.tsx" 
});

// Different code structure to force bundle change
const initializeApp = () => {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    createRoot(rootElement).render(<App />);
  }
};

initializeApp();

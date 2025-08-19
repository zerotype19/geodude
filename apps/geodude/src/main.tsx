import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// FORCE DIFFERENT BUNDLE: Adding unique code to guarantee new hash
const DEPLOYMENT_ID = "API_DOMAIN_FIX_" + Date.now() + "_" + Math.random().toString(36).substring(2);
const FORCED_TIMESTAMP = "2025-08-19T03:45:00Z";
const API_DOMAIN_FIX_VERSION = "v3_direct_api_calls";
console.log("🚀 MAIN.TSX LOADED - API DOMAIN FIX:", { DEPLOYMENT_ID, FORCED_TIMESTAMP, API_DOMAIN_FIX_VERSION, source: "main.tsx" });

// Different code structure to force bundle change
const initializeApp = () => {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    createRoot(rootElement).render(<App />);
  }
};

initializeApp();

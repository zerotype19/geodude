import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// NUCLEAR BUNDLE CHANGE: Force completely new hash
const DEPLOYMENT_ID = "FINAL_API_FIX_" + Date.now() + "_" + Math.random().toString(36).substring(2);
const FORCED_TIMESTAMP = "2025-08-19T03:52:00Z";
const FINAL_API_FIX_VERSION = "v4_no_domain_redirects_final";
const NUCLEAR_CACHE_BUST = Math.random().toString(36) + Date.now().toString(36);
console.log("🚀 NUCLEAR BUNDLE CHANGE - FINAL API FIX:", { 
  DEPLOYMENT_ID, 
  FORCED_TIMESTAMP, 
  FINAL_API_FIX_VERSION, 
  NUCLEAR_CACHE_BUST,
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

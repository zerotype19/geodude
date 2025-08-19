import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// FORCE DIFFERENT BUNDLE: Adding unique code to guarantee new hash
const DEPLOYMENT_ID = "ROUTING_FIX_" + Date.now() + "_" + Math.random().toString(36).substring(2);
const FORCED_TIMESTAMP = "2025-08-19T03:10:00Z";
const ROUTING_FIX_VERSION = "v2_landing_gate_isolated";
console.log("🚀 MAIN.TSX LOADED - ROUTING FIX:", { DEPLOYMENT_ID, FORCED_TIMESTAMP, ROUTING_FIX_VERSION, source: "main.tsx" });

// Different code structure to force bundle change
const initializeApp = () => {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    createRoot(rootElement).render(<App />);
  }
};

initializeApp();

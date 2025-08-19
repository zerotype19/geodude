import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// FORCE DIFFERENT BUNDLE: Adding unique code to guarantee new hash
const DEPLOYMENT_ID = "DEPLOY_" + Date.now() + "_" + Math.random().toString(36).substring(2);
const FORCED_TIMESTAMP = "2025-08-19T02:32:00Z";
console.log("🚀 MAIN.TSX LOADED:", { DEPLOYMENT_ID, FORCED_TIMESTAMP, source: "main.tsx" });

// Different code structure to force bundle change
const initializeApp = () => {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    createRoot(rootElement).render(<App />);
  }
};

initializeApp();

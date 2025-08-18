import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// NUCLEAR CACHE INVALIDATION: 2025-08-18T23:40:00Z
// This MUST generate a different content hash!
createRoot(document.getElementById("root")!).render(<App />);

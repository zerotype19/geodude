import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Force build cache invalidation: 2025-08-18T23:15:00Z
createRoot(document.getElementById("root")!).render(<App />);

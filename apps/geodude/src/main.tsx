import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App";
import Login from "./pages/Login";
import Magic from "./pages/Magic";
import Onboard from "./pages/Onboard";
import Citations from "./pages/Citations";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";

const router = createBrowserRouter([
    { path: "/", element: <App /> },
    { path: "/login", element: <Login /> },
    { path: "/auth/magic", element: <Magic /> },
    { path: "/onboard", element: <Onboard /> },
    { path: "/citations", element: <Citations /> },
    { path: "/admin", element: <Admin /> },
    { path: "/settings", element: <Settings /> }
]);

createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);

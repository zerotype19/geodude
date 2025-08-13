import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import Login from "./pages/Login";
import Magic from "./pages/Magic";
import Onboard from "./pages/Onboard";

const router = createBrowserRouter([
    { path: "/", element: <App /> },
    { path: "/login", element: <Login /> },
    { path: "/auth/magic", element: <Magic /> },
    { path: "/onboard", element: <Onboard /> }
]);

createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);

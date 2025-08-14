import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Sources from "./pages/Sources";
import Content from "./pages/Content";
import Events from "./pages/Events";
import Conversions from "./pages/Conversions";
import Settings from "./pages/Settings";
import Install from "./pages/Install";
import AdminHealth from "./pages/AdminHealth";
import ApiKeys from "./pages/ApiKeys";
import DataPolicy from "./pages/DataPolicy";
import Docs from "./pages/Docs";
import Login from "./pages/Login";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Onboarding from "./pages/Onboarding";
// Protected Route Component
const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) {
        return _jsx("div", { className: "min-h-screen flex items-center justify-center", children: "Loading..." });
    }
    if (!user) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(_Fragment, { children: children });
};
// Public Route Component (redirects to home if already logged in)
const PublicRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) {
        return _jsx("div", { className: "min-h-screen flex items-center justify-center", children: "Loading..." });
    }
    if (user) {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    return _jsx(_Fragment, { children: children });
};
function AppRoutes() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(PublicRoute, { children: _jsx(Login, {}) }) }), _jsx(Route, { path: "/onboarding", element: _jsx(Onboarding, {}) }), _jsx(Route, { path: "/", element: _jsx(ProtectedRoute, { children: _jsx(Events, {}) }) }), _jsx(Route, { path: "/sources", element: _jsx(ProtectedRoute, { children: _jsx(Sources, {}) }) }), _jsx(Route, { path: "/content", element: _jsx(ProtectedRoute, { children: _jsx(Content, {}) }) }), _jsx(Route, { path: "/events", element: _jsx(ProtectedRoute, { children: _jsx(Events, {}) }) }), _jsx(Route, { path: "/install", element: _jsx(ProtectedRoute, { children: _jsx(Install, {}) }) }), _jsx(Route, { path: "/settings", element: _jsx(ProtectedRoute, { children: _jsx(Settings, {}) }) }), _jsx(Route, { path: "/api-keys", element: _jsx(ProtectedRoute, { children: _jsx(ApiKeys, {}) }) }), _jsx(Route, { path: "/data-policy", element: _jsx(ProtectedRoute, { children: _jsx(DataPolicy, {}) }) }), _jsx(Route, { path: "/docs/*", element: _jsx(ProtectedRoute, { children: _jsx(Docs, {}) }) }), _jsx(Route, { path: "/terms", element: _jsx(Terms, {}) }), _jsx(Route, { path: "/privacy", element: _jsx(Privacy, {}) }), _jsx(Route, { path: "/admin/health", element: _jsx(AdminHealth, {}) })] }));
}
function App() {
    return (_jsx(AuthProvider, { children: _jsx(Router, { children: _jsx(AppRoutes, {}) }) }));
}
export default App;

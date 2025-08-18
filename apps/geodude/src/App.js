import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "./config";
import Sources from "./pages/Sources";
import Content from "./pages/Content";
import Events from "./pages/Events";
import Referrals from "./pages/Referrals";
import Conversions from "./pages/Conversions";
import Citations from "./pages/Citations";
import Journeys from "./pages/Journeys";
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
import Funnels from "./pages/Funnels";
import Recommendations from "./pages/Recommendations";
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
// Smart Default Route Component - redirects based on data availability
const SmartDefaultRoute = () => {
    const { user, project, loading } = useAuth();
    const [hasEvents, setHasEvents] = useState(null);
    const [checkingEvents, setCheckingEvents] = useState(true);
    useEffect(() => {
        const checkForEvents = async () => {
            if (!project?.id || loading)
                return;
            try {
                setCheckingEvents(true);
                const response = await fetch(`${API_BASE}/api/events/has-any?project_id=${project.id}`, FETCH_OPTS);
                if (response.ok) {
                    const data = await response.json();
                    setHasEvents(data.hasAny || false);
                }
                else {
                    // If API fails, default to events page
                    setHasEvents(true);
                }
            }
            catch (error) {
                console.error('Failed to check events:', error);
                // If check fails, default to events page
                setHasEvents(true);
            }
            finally {
                setCheckingEvents(false);
            }
        };
        checkForEvents();
    }, [project?.id, loading]);
    if (loading || checkingEvents || hasEvents === null) {
        return _jsx("div", { className: "min-h-screen flex items-center justify-center", children: "Loading..." });
    }
    if (!user) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    // Redirect based on events availability
    if (hasEvents) {
        return _jsx(Navigate, { to: "/events", replace: true });
    }
    else {
        return _jsx(Navigate, { to: `/install?project_id=${project?.id}`, replace: true });
    }
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
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(PublicRoute, { children: _jsx(Login, {}) }) }), _jsx(Route, { path: "/onboarding", element: _jsx(Onboarding, {}) }), _jsx(Route, { path: "/", element: _jsx(SmartDefaultRoute, {}) }), _jsx(Route, { path: "/events", element: _jsx(ProtectedRoute, { children: _jsx(Events, {}) }) }), _jsx(Route, { path: "/content", element: _jsx(ProtectedRoute, { children: _jsx(Content, {}) }) }), _jsx(Route, { path: "/referrals", element: _jsx(ProtectedRoute, { children: _jsx(Referrals, {}) }) }), _jsx(Route, { path: "/conversions", element: _jsx(ProtectedRoute, { children: _jsx(Conversions, {}) }) }), _jsx(Route, { path: "/funnels", element: _jsx(ProtectedRoute, { children: _jsx(Funnels, {}) }) }), _jsx(Route, { path: "/journeys", element: _jsx(ProtectedRoute, { children: _jsx(Journeys, {}) }) }), _jsx(Route, { path: "/citations", element: _jsx(ProtectedRoute, { children: _jsx(Citations, {}) }) }), _jsx(Route, { path: "/recommendations", element: _jsx(ProtectedRoute, { children: _jsx(Recommendations, {}) }) }), _jsx(Route, { path: "/sources", element: _jsx(ProtectedRoute, { children: _jsx(Sources, {}) }) }), _jsx(Route, { path: "/install", element: _jsx(ProtectedRoute, { children: _jsx(Install, {}) }) }), _jsx(Route, { path: "/settings", element: _jsx(ProtectedRoute, { children: _jsx(Settings, {}) }) }), _jsx(Route, { path: "/api-keys", element: _jsx(ProtectedRoute, { children: _jsx(ApiKeys, {}) }) }), _jsx(Route, { path: "/data-policy", element: _jsx(ProtectedRoute, { children: _jsx(DataPolicy, {}) }) }), _jsx(Route, { path: "/docs/*", element: _jsx(ProtectedRoute, { children: _jsx(Docs, {}) }) }), _jsx(Route, { path: "/terms", element: _jsx(Terms, {}) }), _jsx(Route, { path: "/privacy", element: _jsx(Privacy, {}) }), _jsx(Route, { path: "/admin/health", element: _jsx(AdminHealth, {}) })] }));
}
function App() {
    return (_jsx(AuthProvider, { children: _jsx(Router, { children: _jsx(AppRoutes, {}) }) }));
}
export default App;

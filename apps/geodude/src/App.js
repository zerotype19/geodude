import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sources from "./pages/Sources";
import Content from "./pages/Content";
import Events from "./pages/Events";
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
function App() {
    return (_jsx(Router, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/onboarding", element: _jsx(Onboarding, {}) }), _jsx(Route, { path: "/", element: _jsx(Events, {}) }), _jsx(Route, { path: "/sources", element: _jsx(Sources, {}) }), _jsx(Route, { path: "/content", element: _jsx(Content, {}) }), _jsx(Route, { path: "/events", element: _jsx(Events, {}) }), _jsx(Route, { path: "/install", element: _jsx(Install, {}) }), _jsx(Route, { path: "/settings", element: _jsx(Settings, {}) }), _jsx(Route, { path: "/admin/health", element: _jsx(AdminHealth, {}) }), _jsx(Route, { path: "/api-keys", element: _jsx(ApiKeys, {}) }), _jsx(Route, { path: "/data-policy", element: _jsx(DataPolicy, {}) }), _jsx(Route, { path: "/docs/*", element: _jsx(Docs, {}) }), _jsx(Route, { path: "/terms", element: _jsx(Terms, {}) }), _jsx(Route, { path: "/privacy", element: _jsx(Privacy, {}) })] }) }));
}
export default App;

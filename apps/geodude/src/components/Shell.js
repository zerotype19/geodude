import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAuth } from "../contexts/AuthContext";
import { INSIGHTS_NAV, SETUP_NAV } from "../nav.config";
import TopNav from "./TopNav";
export default function Shell({ children }) {
    const { user, project } = useAuth();
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx(TopNav, { project: project, user: user, navItemsInsights: INSIGHTS_NAV, navItemsSetup: SETUP_NAV, isAdmin: !!(user?.is_admin) }), _jsx("main", { className: "flex-1", children: children }), _jsx("footer", { className: "bg-white border-t border-gray-200 mt-auto", children: _jsx("div", { className: "mx-auto max-w-screen-2xl px-4 py-8", children: _jsxs("div", { className: "flex flex-col md:flex-row items-center justify-between gap-4", children: [_jsx("div", { className: "flex items-center space-x-1 text-sm text-gray-500", children: _jsx("span", { children: "\u00A9 2024 Optiview. All rights reserved." }) }), _jsxs("div", { className: "flex items-center space-x-6", children: [_jsx("a", { href: "/privacy", className: "text-sm text-gray-500 hover:text-gray-700", children: "Privacy" }), _jsx("a", { href: "/terms", className: "text-sm text-gray-500 hover:text-gray-700", children: "Terms" })] })] }) }) })] }));
}

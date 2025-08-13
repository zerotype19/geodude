import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useLocation } from "react-router-dom";
export default function Shell({ children }) {
    const location = useLocation();
    const navigation = [
        { name: "Events", href: "/events" },
        { name: "Sources", href: "/sources" },
        { name: "Content", href: "/content" },
        { name: "Install", href: "/install" },
        { name: "Settings", href: "/settings" },
        { name: "Health", href: "/admin/health" },
    ];
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx("nav", { className: "bg-white shadow-sm border-b border-gray-200", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "flex justify-between h-16", children: [_jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0 flex items-center", children: _jsx(Link, { to: "/", className: "text-xl font-bold text-blue-600", children: "Optiview" }) }), _jsx("div", { className: "hidden sm:ml-6 sm:flex sm:space-x-8", children: navigation.map((item) => {
                                            const isActive = location.pathname === item.href;
                                            return (_jsx(Link, { to: item.href, className: `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive
                                                    ? "border-blue-500 text-gray-900"
                                                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"}`, children: item.name }, item.name));
                                        }) })] }), _jsx("div", { className: "hidden sm:ml-6 sm:flex sm:items-center", children: _jsx("div", { className: "ml-3 relative", children: _jsx("div", { className: "flex items-center space-x-4", children: _jsx("span", { className: "text-sm text-gray-500", children: "AI Visibility Platform" }) }) }) })] }) }) }), _jsx("div", { className: "sm:hidden", children: _jsx("div", { className: "pt-2 pb-3 space-y-1", children: navigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (_jsx(Link, { to: item.href, className: `block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${isActive
                                ? "bg-blue-50 border-blue-500 text-blue-700"
                                : "border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800"}`, children: item.name }, item.name));
                    }) }) }), _jsx("main", { className: "max-w-7xl mx-auto py-6 sm:px-6 lg:px-8", children: _jsx("div", { className: "px-4 py-6 sm:px-0", children: children }) })] }));
}

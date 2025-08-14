import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { User, Building2, ChevronDown, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
export default function Shell({ children }) {
    const location = useLocation();
    const { user, organization, project, logout, listOrganizations, listProjects, switchContext } = useAuth();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [orgMenuOpen, setOrgMenuOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [availableOrgs, setAvailableOrgs] = useState([]);
    const [availableProjects, setAvailableProjects] = useState([]);
    const [loadingOrgs, setLoadingOrgs] = useState(false);
    // Load available organizations and projects when org menu opens
    useEffect(() => {
        if (orgMenuOpen && availableOrgs.length === 0) {
            loadAvailableContexts();
        }
    }, [orgMenuOpen]);
    const loadAvailableContexts = async () => {
        setLoadingOrgs(true);
        try {
            const [orgs, projects] = await Promise.all([
                listOrganizations(),
                listProjects()
            ]);
            setAvailableOrgs(orgs);
            setAvailableProjects(projects);
        }
        catch (error) {
            console.error('Failed to load available contexts:', error);
        }
        finally {
            setLoadingOrgs(false);
        }
    };
    const handleContextSwitch = async (orgId, projectId) => {
        try {
            await switchContext(orgId, projectId);
            setOrgMenuOpen(false);
        }
        catch (error) {
            console.error('Failed to switch context:', error);
        }
    };
    const navigation = [
        { name: "Events", href: "/events" },
        { name: "Sources", href: "/sources" },
        { name: "Content", href: "/content" },
        { name: "Conversions", href: "/conversions" },
        { name: "Install", href: "/install" },
        { name: "API Keys", href: "/api-keys" },
        { name: "Data Policy", href: "/data-policy" },
        { name: "Settings", href: "/settings" },
        // Only show Health for admin users
        ...(user?.is_admin ? [{ name: "Health", href: "/admin/health" }] : []),
    ];
    const handleLogout = () => {
        logout();
        setUserMenuOpen(false);
    };
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx("nav", { className: "bg-white shadow-sm border-b border-gray-200", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "flex justify-between h-16", children: [_jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0 flex items-center", children: _jsx(Link, { to: "/", className: "text-xl font-bold text-blue-600", children: "Optiview" }) }), _jsx("div", { className: "hidden sm:ml-6 sm:flex sm:space-x-8", children: navigation.map((item) => {
                                            const isActive = location.pathname === item.href;
                                            return (_jsx(Link, { to: item.href, className: `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive
                                                    ? "border-blue-500 text-gray-900"
                                                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"}`, children: item.name }, item.name));
                                        }) })] }), _jsx("div", { className: "hidden sm:ml-6 sm:flex sm:items-center", children: _jsxs("div", { className: "ml-3 relative", children: [_jsxs("div", { className: "relative mr-4", children: [_jsxs("button", { onClick: () => setOrgMenuOpen(!orgMenuOpen), className: "flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-2 border border-gray-300", children: [_jsx(Building2, { className: "h-4 w-4" }), _jsx("span", { className: "max-w-32 truncate", children: organization?.name || 'Loading...' }), _jsx("span", { className: "text-gray-400", children: "/" }), _jsx("span", { className: "max-w-32 truncate", children: project?.name || 'Loading...' }), _jsx(ChevronDown, { className: "h-4 w-4" })] }), orgMenuOpen && (_jsx("div", { className: "absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50", children: _jsxs("div", { className: "py-2", children: [_jsxs("div", { className: "px-4 py-2 border-b border-gray-100", children: [_jsx("h3", { className: "text-sm font-medium text-gray-900", children: "Current Selection" }), _jsxs("p", { className: "text-sm text-gray-500 mt-1", children: [_jsx("span", { className: "font-medium", children: organization?.name }), " / ", project?.name] })] }), loadingOrgs ? (_jsx("div", { className: "px-4 py-2", children: _jsx("p", { className: "text-sm text-gray-500", children: "Loading available contexts..." }) })) : (_jsx("div", { className: "max-h-64 overflow-y-auto", children: availableOrgs.map((org) => {
                                                                    const orgProjects = availableProjects.filter(p => p.org_id === org.id);
                                                                    return (_jsxs("div", { className: "border-b border-gray-100 last:border-b-0", children: [_jsx("div", { className: "px-4 py-2 bg-gray-50", children: _jsx("h4", { className: "text-sm font-medium text-gray-900", children: org.name }) }), orgProjects.map((proj) => (_jsxs("button", { onClick: () => handleContextSwitch(org.id, proj.id), className: `w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${org.id === organization?.id && proj.id === project?.id
                                                                                    ? 'bg-blue-50 text-blue-700'
                                                                                    : 'text-gray-700'}`, children: [_jsx("span", { className: "ml-4", children: proj.name }), org.id === organization?.id && proj.id === project?.id && (_jsx("span", { className: "ml-2 text-blue-600", children: "\u2713" }))] }, proj.id)))] }, org.id));
                                                                }) })), availableOrgs.length === 0 && !loadingOrgs && (_jsx("div", { className: "px-4 py-2", children: _jsx("p", { className: "text-xs text-gray-500", children: "No other organizations available" }) }))] }) }))] }), _jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => setUserMenuOpen(!userMenuOpen), className: "flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-2 border border-gray-300", children: [_jsx(User, { className: "h-4 w-4" }), _jsx("span", { className: "max-w-32 truncate", children: user?.email || 'Loading...' }), _jsx(ChevronDown, { className: "h-4 w-4" })] }), userMenuOpen && (_jsx("div", { className: "absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50", children: _jsxs("div", { className: "py-2", children: [_jsxs("div", { className: "px-4 py-2 border-b border-gray-100", children: [_jsx("p", { className: "text-sm font-medium text-gray-900", children: user?.email }), _jsxs("p", { className: "text-xs text-gray-500", children: [organization?.name, " / ", project?.name] })] }), _jsxs("button", { onClick: handleLogout, className: "w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2", children: [_jsx(LogOut, { className: "h-4 w-4" }), _jsx("span", { children: "Sign out" })] })] }) }))] })] }) }), _jsx("div", { className: "flex items-center sm:hidden", children: _jsxs("button", { onClick: () => setMobileMenuOpen(!mobileMenuOpen), className: "inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500", "aria-expanded": "false", children: [_jsx("span", { className: "sr-only", children: "Open main menu" }), mobileMenuOpen ? (_jsx("svg", { className: "block h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })) : (_jsx("svg", { className: "block h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6h16M4 12h16M4 18h16" }) }))] }) })] }) }) }), _jsxs("div", { className: `sm:hidden ${mobileMenuOpen ? 'block' : 'hidden'}`, children: [_jsx("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-75 z-40", onClick: () => setMobileMenuOpen(false) }), _jsx("div", { className: "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out", children: _jsxs("div", { className: "pt-2 pb-3 space-y-1 bg-white border-b border-gray-200 shadow-lg h-full overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b border-gray-200", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Menu" }), _jsx("button", { onClick: () => setMobileMenuOpen(false), className: "rounded-md p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100", children: _jsx("svg", { className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsx("div", { className: "px-4 py-3 bg-gray-50 border-b border-gray-200", children: _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Building2, { className: "h-4 w-4 text-gray-500" }), _jsxs("div", { className: "text-sm", children: [_jsx("p", { className: "font-medium text-gray-900", children: organization?.name || 'Loading...' }), _jsx("p", { className: "text-gray-500", children: project?.name || 'Loading...' })] })] }) }), navigation.map((item) => {
                                    const isActive = location.pathname === item.href;
                                    return (_jsx(Link, { to: item.href, onClick: () => setMobileMenuOpen(false), className: `block pl-4 pr-4 py-3 border-l-4 text-base font-medium ${isActive
                                            ? "bg-blue-50 border-blue-500 text-blue-700"
                                            : "border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800"}`, children: item.name }, item.name));
                                }), _jsxs("div", { className: "border-t border-gray-200 pt-4 pb-3 mt-auto", children: [_jsxs("div", { className: "px-4 py-2", children: [_jsx("p", { className: "text-sm font-medium text-gray-900", children: user?.email }), _jsx("p", { className: "text-xs text-gray-500", children: "Signed in" })] }), _jsxs("button", { onClick: () => {
                                                handleLogout();
                                                setMobileMenuOpen(false);
                                            }, className: "w-full text-left px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 flex items-center space-x-2", children: [_jsx(LogOut, { className: "h-5 w-5" }), _jsx("span", { children: "Sign out" })] })] })] }) })] }), _jsxs("main", { className: "max-w-7xl mx-auto py-6 sm:px-6 lg:px-8", children: [_jsx("div", { className: "px-4 sm:px-0 mb-4", children: _jsx("nav", { className: "flex", "aria-label": "Breadcrumb", children: _jsxs("ol", { className: "flex items-center space-x-2", children: [_jsx("li", { children: _jsxs(Link, { to: "/", className: "text-gray-400 hover:text-gray-500", children: [_jsx("span", { className: "sr-only", children: "Home" }), _jsx("svg", { className: "h-5 w-5", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { d: "M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" }) })] }) }), organization && (_jsxs(_Fragment, { children: [_jsx("li", { children: _jsx("svg", { className: "h-5 w-5 text-gray-300", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z", clipRule: "evenodd" }) }) }), _jsx("li", { children: _jsx("span", { className: "text-sm font-medium text-gray-500", children: organization.name }) })] })), project && (_jsxs(_Fragment, { children: [_jsx("li", { children: _jsx("svg", { className: "h-5 w-5 text-gray-300", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z", clipRule: "evenodd" }) }) }), _jsx("li", { children: _jsx("span", { className: "text-sm font-medium text-gray-500", children: project.name }) })] })), location.pathname !== "/" && (_jsxs(_Fragment, { children: [_jsx("li", { children: _jsx("svg", { className: "h-5 w-5 text-gray-300", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z", clipRule: "evenodd" }) }) }), _jsx("li", { children: _jsx("span", { className: "text-sm font-medium text-gray-500 capitalize", children: location.pathname.split('/').filter(Boolean).join(' / ') }) })] }))] }) }) }), _jsx("div", { className: "px-4 py-6 sm:px-0", children: children })] }), _jsx("footer", { className: "bg-white border-t border-gray-200 mt-auto", children: _jsx("div", { className: "max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { className: "text-sm text-gray-500", children: ["\u00A9 2024 ", organization?.name || 'Optiview', ". All rights reserved."] }), _jsxs("div", { className: "flex space-x-6", children: [_jsx(Link, { to: "/docs", className: "text-sm text-gray-500 hover:text-gray-700", children: "Documentation" }), _jsx(Link, { to: "/privacy", className: "text-sm text-gray-500 hover:text-gray-700", children: "Privacy" }), _jsx(Link, { to: "/terms", className: "text-sm text-gray-500 hover:text-gray-700", children: "Terms" })] })] }) }) })] }));
}

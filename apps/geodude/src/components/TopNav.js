import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NavTabs } from './NavTabs';
import { SetupMenu } from './SetupMenu';
import { UserMenu } from './UserMenu';
import ProjectSwitcher from './ProjectSwitcher';
import CreateProjectModal from './CreateProjectModal';
export default function TopNav({ project, user, navItemsInsights, navItemsSetup, isAdmin }) {
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    return (_jsxs(_Fragment, { children: [_jsxs("header", { className: "sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200", children: [_jsx("div", { className: "mx-auto max-w-screen-2xl px-4", children: _jsxs("div", { className: "h-12 flex items-center gap-3", children: [_jsx("a", { href: "/", className: "shrink-0 font-semibold text-slate-900 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded", children: "Optiview" }), _jsx("div", { className: "h-6 w-px bg-slate-200" }), _jsx(ProjectSwitcher, { onCreateProject: () => setShowCreateProjectModal(true) }), _jsx(NavTabs, { items: navItemsInsights }), _jsx("div", { className: "flex-1" }), _jsx(SetupMenu, { items: navItemsSetup, isAdmin: isAdmin }), _jsx(UserMenu, { user: user }), _jsx("button", { onClick: () => setMobileMenuOpen(!mobileMenuOpen), className: "md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", "aria-label": "Toggle mobile menu", "aria-expanded": mobileMenuOpen, children: mobileMenuOpen ? (_jsx(X, { className: "h-5 w-5" })) : (_jsx(Menu, { className: "h-5 w-5" })) })] }) }), mobileMenuOpen && (_jsx("div", { className: "md:hidden border-t border-slate-200 bg-white", children: _jsxs("div", { className: "mx-auto max-w-screen-2xl px-4 py-4", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider", children: "Insights" }), _jsx("nav", { className: "mt-2 space-y-1", children: navItemsInsights.map(item => (_jsx("a", { href: item.href, onClick: () => setMobileMenuOpen(false), className: `block rounded-md px-2 py-2 text-sm font-medium ${item.match(window.location.pathname)
                                                    ? "bg-slate-900 text-white"
                                                    : "text-slate-700 hover:bg-slate-100"}`, children: item.label }, item.href))) })] }), _jsxs("div", { children: [_jsx("h3", { className: "px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider", children: "Setup" }), _jsx("nav", { className: "mt-2 space-y-1", children: navItemsSetup
                                                .filter(item => (item.adminOnly ? isAdmin : true))
                                                .map(item => (_jsx("a", { href: item.href, onClick: () => setMobileMenuOpen(false), className: `block rounded-md px-2 py-2 text-sm font-medium ${item.match(window.location.pathname)
                                                    ? "bg-slate-900 text-white"
                                                    : "text-slate-700 hover:bg-slate-100"}`, children: item.label }, item.href))) })] })] }) }))] }), _jsx(CreateProjectModal, { isOpen: showCreateProjectModal, onClose: () => setShowCreateProjectModal(false) })] }));
}

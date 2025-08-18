import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, User, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
export function UserMenu({ user }) {
    const [isOpen, setIsOpen] = useState(false);
    const { logout } = useAuth();
    const menuRef = useRef(null);
    const buttonRef = useRef(null);
    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);
    // Handle keyboard navigation
    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            setIsOpen(false);
            buttonRef.current?.focus();
        }
    };
    const handleLogout = () => {
        setIsOpen(false);
        logout();
    };
    if (!user) {
        return null;
    }
    return (_jsxs("div", { className: "relative", ref: menuRef, children: [_jsxs("button", { ref: buttonRef, onClick: () => setIsOpen(!isOpen), onKeyDown: handleKeyDown, "aria-label": "User menu", "aria-expanded": isOpen, "aria-haspopup": "true", className: "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex h-6 w-6 items-center justify-center rounded-full bg-slate-200", children: _jsx(User, { className: "h-3 w-3 text-slate-600" }) }), _jsx("span", { className: "hidden sm:block max-w-[120px] truncate", children: user.email })] }), _jsx(ChevronDown, { className: "h-4 w-4" })] }), isOpen && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-40 md:hidden", onClick: () => setIsOpen(false) }), _jsxs("div", { className: "absolute right-0 mt-2 w-56 z-50 rounded-xl border border-slate-200 bg-white shadow-lg focus:outline-none", onKeyDown: handleKeyDown, children: [_jsxs("div", { className: "px-3 py-2 border-b border-slate-100", children: [_jsx("p", { className: "text-sm font-medium text-slate-900 truncate", children: user.email }), !!(user.is_admin) && (_jsx("p", { className: "text-xs text-slate-500", children: "Administrator" }))] }), _jsx("div", { className: "py-1", children: _jsxs("button", { onClick: handleLogout, className: "flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900", children: [_jsx(LogOut, { className: "h-4 w-4" }), "Sign out"] }) })] })] }))] }));
}

import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Settings } from 'lucide-react';
export function SetupMenu({ items, isAdmin }) {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const menuRef = useRef(null);
    const buttonRef = useRef(null);
    // Filter items based on admin status
    const filteredItems = items.filter(item => (item.adminOnly ? isAdmin : true));
    // Compute active state for each item
    const itemsWithActive = filteredItems.map(item => ({
        ...item,
        active: item.match(location.pathname)
    }));
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
    return (_jsxs("div", { className: "relative", ref: menuRef, children: [_jsx("button", { ref: buttonRef, onClick: () => setIsOpen(!isOpen), onKeyDown: handleKeyDown, "aria-label": "Setup menu", "aria-expanded": isOpen, "aria-haspopup": "true", className: "inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: _jsx(Settings, { className: "h-5 w-5" }) }), isOpen && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-40 md:hidden", onClick: () => setIsOpen(false) }), _jsx("div", { className: "absolute right-0 mt-2 w-56 z-50 rounded-xl border border-slate-200 bg-white shadow-lg focus:outline-none", onKeyDown: handleKeyDown, children: _jsx("div", { className: "py-1", children: itemsWithActive.map(item => (_jsx("a", { href: item.href, onClick: () => setIsOpen(false), className: `block px-3 py-2 text-sm transition-colors ${item.active
                                    ? "font-semibold text-slate-900 bg-slate-50"
                                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"}`, children: item.label }, item.href))) }) })] }))] }));
}

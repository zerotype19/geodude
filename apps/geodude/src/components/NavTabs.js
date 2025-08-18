import { jsx as _jsx } from "react/jsx-runtime";
import { useLocation } from 'react-router-dom';
export function NavTabs({ items }) {
    const location = useLocation();
    // Compute active state for each item
    const tabsWithActive = items.map(item => ({
        ...item,
        active: item.match(location.pathname)
    }));
    return (_jsx("nav", { className: "ml-3 hidden md:block max-w-[56vw] overflow-x-auto overscroll-x-contain", "aria-label": "Primary", children: _jsx("ul", { className: "flex items-center gap-2 whitespace-nowrap pr-2", children: tabsWithActive.map(item => (_jsx("li", { children: _jsx("a", { href: item.href, "aria-current": item.active ? "page" : undefined, className: `inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors ${item.active
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"}`, children: item.label }) }, item.href))) }) }));
}

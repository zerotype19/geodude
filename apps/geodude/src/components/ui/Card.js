import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Card({ title, children }) {
    return (_jsxs("div", { className: "bg-white rounded-2xl border shadow-sm", children: [_jsx("div", { className: "px-4 py-3 border-b text-sm font-medium", children: title }), _jsx("div", { className: "p-4", children: children })] }));
}

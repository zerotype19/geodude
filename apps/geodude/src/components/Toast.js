import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
function Toast({ message, type, duration = 4000, onClose }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);
    const icons = {
        success: _jsx(CheckCircle, { className: "text-green-600", size: 20 }),
        error: _jsx(XCircle, { className: "text-red-600", size: 20 }),
        info: _jsx(Info, { className: "text-blue-600", size: 20 })
    };
    const bgColors = {
        success: 'bg-green-50 border-green-200',
        error: 'bg-red-50 border-red-200',
        info: 'bg-blue-50 border-blue-200'
    };
    const textColors = {
        success: 'text-green-800',
        error: 'text-red-800',
        info: 'text-blue-800'
    };
    return (_jsxs("div", { className: `flex items-center justify-between p-4 border rounded-lg shadow-lg ${bgColors[type]} min-w-80 max-w-md`, children: [_jsxs("div", { className: "flex items-center space-x-3", children: [icons[type], _jsx("span", { className: `text-sm font-medium ${textColors[type]}`, children: message })] }), _jsx("button", { onClick: onClose, className: `text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded ${type === 'success' ? 'focus:ring-green-500' :
                    type === 'error' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`, "aria-label": "Close notification", children: _jsx(X, { size: 16 }) })] }));
}
export function ToastContainer({ toasts, onRemove }) {
    return (_jsx("div", { className: "fixed top-4 right-4 space-y-2 z-50", children: toasts.map((toast) => (_jsx(Toast, { message: toast.message, type: toast.type, duration: toast.duration, onClose: () => onRemove(toast.id) }, toast.id))) }));
}
export default Toast;

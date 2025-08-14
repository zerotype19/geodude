import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { API_BASE } from '../config';
export default function Login() {
    const [state, setState] = useState({
        email: '',
        loading: false,
        error: '',
        success: ''
    });
    const navigate = useNavigate();
    const handleRequestMagicLink = async (e) => {
        e.preventDefault();
        setState(prev => ({ ...prev, loading: true, error: '', success: '' }));
        try {
            const response = await fetch(`${API_BASE}/api/auth/request-link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: state.email,
                    continue_path: '/onboarding'
                }),
            });
            if (response.ok) {
                setState(prev => ({
                    ...prev,
                    loading: false,
                    success: 'Check your email for a magic link to sign in!'
                }));
            }
            else {
                const data = await response.json();
                setState(prev => ({
                    ...prev,
                    loading: false,
                    error: data.error || 'Failed to send magic link'
                }));
            }
        }
        catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: 'Network error. Please try again.'
            }));
        }
    };
    const isEmailValid = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };
    return (_jsxs("div", { className: "min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "sm:mx-auto sm:w-full sm:max-w-md", children: [_jsx("h2", { className: "mt-6 text-center text-3xl font-extrabold text-gray-900", children: "Sign in to Optiview" }), _jsx("p", { className: "mt-2 text-center text-sm text-gray-600", children: "Enter your email to receive a magic link" })] }), _jsx("div", { className: "mt-8 sm:mx-auto sm:w-full sm:max-w-md", children: _jsxs(Card, { className: "px-4 py-8 sm:px-10", children: [state.error && (_jsx("div", { className: "mb-4 bg-red-50 border border-red-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("svg", { className: "h-5 w-5 text-red-400", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z", clipRule: "evenodd" }) }) }), _jsx("div", { className: "ml-3", children: _jsx("p", { className: "text-sm text-red-800", children: state.error }) })] }) })), state.success && (_jsx("div", { className: "mb-4 bg-green-50 border border-green-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("svg", { className: "h-5 w-5 text-green-400", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }) }), _jsx("div", { className: "ml-3", children: _jsx("p", { className: "text-sm text-green-800", children: state.success }) })] }) })), _jsxs("form", { onSubmit: handleRequestMagicLink, className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-sm font-medium text-gray-700", children: "Email address" }), _jsx("div", { className: "mt-1", children: _jsx("input", { id: "email", name: "email", type: "email", autoComplete: "email", required: true, value: state.email, onChange: (e) => setState(prev => ({ ...prev, email: e.target.value })), className: "appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm", placeholder: "Enter your email" }) })] }), _jsx("div", { children: _jsx("button", { type: "submit", disabled: state.loading || !isEmailValid(state.email), className: "w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed", children: state.loading ? 'Sending...' : 'Send Magic Link' }) })] }), _jsx("div", { className: "mt-6 text-center", children: _jsxs("p", { className: "text-xs text-gray-500", children: ["By signing in, you agree to our", ' ', _jsx("a", { href: "/terms", className: "text-indigo-600 hover:text-indigo-500", children: "Terms of Service" }), ' ', "and", ' ', _jsx("a", { href: "/privacy", className: "text-indigo-600 hover:text-indigo-500", children: "Privacy Policy" })] }) })] }) })] }));
}

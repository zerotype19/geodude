import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../config';
import { Card } from '../components/ui/Card';
export default function Onboarding() {
    const { login } = useAuth();
    const [state, setState] = useState({
        step: 1,
        organization: {
            name: '',
        },
        project: {
            name: '',
            description: '',
        },
        loading: false,
        error: '',
    });
    const handleNext = async () => {
        if (state.step === 1) {
            await createOrganization();
        }
        else if (state.step === 2) {
            await createProject();
        }
    };
    const handlePrevious = () => {
        if (state.step > 1) {
            setState(prev => ({ ...prev, step: prev.step - 1, error: '' }));
        }
    };
    const createOrganization = async () => {
        if (!state.organization.name.trim()) {
            setState(prev => ({ ...prev, error: 'Organization name is required' }));
            return;
        }
        setState(prev => ({ ...prev, loading: true, error: '' }));
        try {
            console.log('🚀 Sending organization creation request:', {
                url: `${API_BASE}/api/onboarding/organization`,
                data: { name: state.organization.name.trim() }
            });
            const response = await fetch(`${API_BASE}/api/onboarding/organization`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: state.organization.name.trim()
                })
            });
            console.log('📥 Response received:', {
                status: response.status,
                statusText: response.statusText,
                headers: 'Response headers available'
            });
            const responseText = await response.text();
            console.log('📄 Response body (raw):', responseText);
            let data;
            try {
                data = JSON.parse(responseText);
                console.log('📊 Parsed response data:', data);
            }
            catch (parseError) {
                console.error('❌ Failed to parse response as JSON:', parseError);
                setState(prev => ({
                    ...prev,
                    error: 'Invalid response from server',
                    loading: false
                }));
                return;
            }
            if (response.ok) {
                console.log('✅ Organization creation successful, data:', data);
                if (!data.id) {
                    console.error('❌ Response missing organization.id:', data);
                    setState(prev => ({
                        ...prev,
                        error: 'Server response missing organization ID',
                        loading: false
                    }));
                    return;
                }
                setState(prev => ({
                    ...prev,
                    step: 2,
                    organization: { ...prev.organization, id: data.id },
                    loading: false
                }));
            }
            else {
                console.error('❌ Organization creation failed:', data);
                setState(prev => ({
                    ...prev,
                    error: data.error || 'Failed to create organization',
                    loading: false
                }));
            }
        }
        catch (error) {
            console.error('❌ Network error:', error);
            setState(prev => ({
                ...prev,
                error: 'Network error. Please try again.',
                loading: false
            }));
        }
    };
    const createProject = async () => {
        if (!state.project.name.trim() || !state.organization.id) {
            setState(prev => ({ ...prev, error: 'Project name is required' }));
            return;
        }
        setState(prev => ({ ...prev, loading: true, error: '' }));
        try {
            const response = await fetch(`${API_BASE}/api/onboarding/project`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: state.project.name.trim(),
                    description: state.project.description.trim(),
                    organizationId: state.organization.id
                })
            });
            const data = await response.json();
            if (response.ok) {
                console.log('✅ Project creation successful, data:', data);
                if (!data.id) {
                    console.error('❌ Response missing project.id:', data);
                    setState(prev => ({
                        ...prev,
                        error: 'Server response missing project ID',
                        loading: false
                    }));
                    return;
                }
                setState(prev => ({
                    ...prev,
                    project: { ...prev.project, id: data.id },
                    loading: false
                }));
                // Complete onboarding and automatically log the user in
                await completeOnboarding();
            }
            else {
                setState(prev => ({
                    ...prev,
                    error: data.error || 'Failed to create project',
                    loading: false
                }));
            }
        }
        catch (error) {
            setState(prev => ({
                ...prev,
                error: 'Network error. Please try again.',
                loading: false
            }));
        }
    };
    const completeOnboarding = async () => {
        try {
            // Get the user, organization, and project data to log them in
            const [userResponse, orgResponse, projectResponse] = await Promise.all([
                fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' }),
                fetch(`${API_BASE}/api/auth/organization`, { credentials: 'include' }),
                fetch(`${API_BASE}/api/auth/project`, { credentials: 'include' })
            ]);
            if (userResponse.ok && orgResponse.ok && projectResponse.ok) {
                const [userData, orgData, projectData] = await Promise.all([
                    userResponse.json(),
                    orgResponse.json(),
                    projectResponse.json()
                ]);
                // Log the user in with all their data
                login(userData, orgData, projectData);
                // Redirect to main app
                window.location.href = '/';
            }
            else {
                console.error('Failed to get user data for login');
                // Still redirect, the auth context will handle loading the data
                window.location.href = '/';
            }
        }
        catch (error) {
            console.error('Error completing onboarding:', error);
            // Still redirect, the auth context will handle loading the data
            window.location.href = '/';
        }
    };
    const updateOrganization = (field, value) => {
        setState(prev => ({
            ...prev,
            organization: { ...prev.organization, [field]: value },
            error: '' // Clear error when user types
        }));
    };
    const updateProject = (field, value) => {
        setState(prev => ({
            ...prev,
            project: { ...prev.project, [field]: value },
            error: '' // Clear error when user types
        }));
    };
    const canProceed = () => {
        if (state.step === 1) {
            return state.organization.name.trim() && !state.loading;
        }
        if (state.step === 2) {
            return state.project.name.trim() && !state.loading;
        }
        return false;
    };
    return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center p-4", children: _jsxs("div", { className: "w-full max-w-2xl", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Welcome to Optiview" }), _jsx("p", { className: "text-gray-600", children: "Let's get you set up in a few simple steps" })] }), _jsx("div", { className: "flex justify-center mb-8", children: _jsx("div", { className: "flex items-center space-x-8", children: [1, 2].map((step) => (_jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: `w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium ${step < state.step
                                        ? 'bg-green-500 text-white'
                                        : step === state.step
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-600'}`, children: step < state.step ? '✓' : step }), step < 2 && (_jsx("div", { className: `w-20 h-1 mx-4 ${step < state.step ? 'bg-green-500' : 'bg-gray-200'}` }))] }, step))) }) }), state.error && (_jsx("div", { className: "mb-6 bg-red-50 border border-red-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("svg", { className: "h-5 w-5 text-red-400", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z", clipRule: "evenodd" }) }) }), _jsx("div", { className: "ml-3", children: _jsx("p", { className: "text-sm text-red-800", children: state.error }) })] }) })), _jsxs(Card, { className: "p-8", children: [state.step === 1 && (_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-6", children: "Organization" }), _jsx("div", { className: "space-y-4", children: _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Organization Name" }), _jsx("input", { type: "text", value: state.organization.name, onChange: (e) => updateOrganization('name', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", placeholder: "e.g., Acme Corp, My Company, etc.", disabled: state.loading })] }) })] })), state.step === 2 && (_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-6", children: "Project" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Project Name" }), _jsx("input", { type: "text", value: state.project.name, onChange: (e) => updateProject('name', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", placeholder: "e.g., Company Website, Marketing Blog, etc.", disabled: state.loading })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description (Optional)" }), _jsx("textarea", { value: state.project.description, onChange: (e) => updateProject('description', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", rows: 3, placeholder: "e.g., Track AI referrals for our blog and marketing content", disabled: state.loading })] })] })] })), _jsx("div", { className: "flex justify-end mt-8", children: _jsx("button", { onClick: handleNext, disabled: !canProceed(), className: `px-6 py-2 rounded-md font-medium ${canProceed()
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`, children: state.loading ? 'Creating...' : state.step === 2 ? 'Complete Setup' : 'Next' }) })] })] }) }));
}

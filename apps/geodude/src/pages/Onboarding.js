import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
export default function Onboarding() {
    const [state, setState] = useState({
        currentStep: 0,
        steps: [
            {
                id: 'org',
                title: 'Organization',
                description: 'Set up your organization',
                completed: false
            },
            {
                id: 'project',
                title: 'Project',
                description: 'Create your first project',
                completed: false
            },
            {
                id: 'property',
                title: 'Property',
                description: 'Add a website property',
                completed: false
            },
            {
                id: 'api-key',
                title: 'API Key',
                description: 'Generate an API key',
                completed: false
            },
            {
                id: 'install',
                title: 'Install & Verify',
                description: 'Install the tracking code and verify data',
                completed: false
            },
            {
                id: 'invite',
                title: 'Invite Team (Optional)',
                description: 'Invite team members to collaborate',
                completed: false
            }
        ],
        loading: false,
        error: '',
        success: '',
        orgName: '',
        projectName: '',
        propertyName: '',
        propertyUrl: '',
        apiKeyName: '',
        inviteEmail: '',
        inviteRole: 'member'
    });
    const navigate = useNavigate();
    // Load progress from localStorage
    useEffect(() => {
        const savedProgress = localStorage.getItem('onboarding-progress');
        if (savedProgress) {
            try {
                const progress = JSON.parse(savedProgress);
                setState(prev => ({
                    ...prev,
                    ...progress,
                    currentStep: progress.currentStep || 0
                }));
            }
            catch (e) {
                console.error('Failed to load onboarding progress:', e);
            }
        }
    }, []);
    // Save progress to localStorage
    const saveProgress = (updates) => {
        const newState = { ...state, ...updates };
        setState(newState);
        localStorage.setItem('onboarding-progress', JSON.stringify(newState));
    };
    const handleNext = () => {
        if (state.currentStep < state.steps.length - 1) {
            saveProgress({ currentStep: state.currentStep + 1 });
        }
    };
    const handlePrevious = () => {
        if (state.currentStep > 0) {
            saveProgress({ currentStep: state.currentStep - 1 });
        }
    };
    const handleStepComplete = (stepId) => {
        const updatedSteps = state.steps.map(step => step.id === stepId ? { ...step, completed: true } : step);
        saveProgress({ steps: updatedSteps });
    };
    const handleCreateOrg = async () => {
        if (!state.orgName.trim()) {
            setState(prev => ({ ...prev, error: 'Organization name is required' }));
            return;
        }
        setState(prev => ({ ...prev, loading: true, error: '' }));
        try {
            // TODO: Implement organization creation API call
            // For now, just mark as complete
            handleStepComplete('org');
            setState(prev => ({ ...prev, loading: false, success: 'Organization created successfully!' }));
            setTimeout(() => {
                setState(prev => ({ ...prev, success: '' }));
                handleNext();
            }, 1500);
        }
        catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: 'Failed to create organization. Please try again.'
            }));
        }
    };
    const handleCreateProject = async () => {
        if (!state.projectName.trim()) {
            setState(prev => ({ ...prev, error: 'Project name is required' }));
            return;
        }
        setState(prev => ({ ...prev, loading: true, error: '' }));
        try {
            // TODO: Implement project creation API call
            // For now, just mark as complete
            handleStepComplete('project');
            setState(prev => ({ ...prev, loading: false, success: 'Project created successfully!' }));
            setTimeout(() => {
                setState(prev => ({ ...prev, success: '' }));
                handleNext();
            }, 1500);
        }
        catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: 'Failed to create project. Please try again.'
            }));
        }
    };
    const handleCreateProperty = async () => {
        if (!state.propertyName.trim() || !state.propertyUrl.trim()) {
            setState(prev => ({ ...prev, error: 'Property name and URL are required' }));
            return;
        }
        setState(prev => ({ ...prev, loading: true, error: '' }));
        try {
            // TODO: Implement property creation API call
            // For now, just mark as complete
            handleStepComplete('property');
            setState(prev => ({ ...prev, loading: false, success: 'Property created successfully!' }));
            setTimeout(() => {
                setState(prev => ({ ...prev, success: '' }));
                handleNext();
            }, 1500);
        }
        catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: 'Failed to create property. Please try again.'
            }));
        }
    };
    const handleCreateApiKey = async () => {
        if (!state.apiKeyName.trim()) {
            setState(prev => ({ ...prev, error: 'API key name is required' }));
            return;
        }
        setState(prev => ({ ...prev, loading: true, error: '' }));
        try {
            // TODO: Implement API key creation API call
            // For now, just mark as complete
            handleStepComplete('api-key');
            setState(prev => ({ ...prev, loading: false, success: 'API key created successfully!' }));
            setTimeout(() => {
                setState(prev => ({ ...prev, success: '' }));
                handleNext();
            }, 1500);
        }
        catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: 'Failed to create API key. Please try again.'
            }));
        }
    };
    const handleCompleteInstall = async () => {
        setState(prev => ({ ...prev, loading: true, error: '' }));
        try {
            // TODO: Implement installation verification API call
            // For now, just mark as complete
            handleStepComplete('install');
            setState(prev => ({ ...prev, loading: false, success: 'Installation verified successfully!' }));
            setTimeout(() => {
                setState(prev => ({ ...prev, success: '' }));
                handleNext();
            }, 1500);
        }
        catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: 'Failed to verify installation. Please try again.'
            }));
        }
    };
    const handleSendInvite = async () => {
        if (!state.inviteEmail.trim()) {
            setState(prev => ({ ...prev, error: 'Email is required' }));
            return;
        }
        setState(prev => ({ ...prev, loading: true, error: '' }));
        try {
            // TODO: Implement invite API call
            // For now, just mark as complete
            handleStepComplete('invite');
            setState(prev => ({ ...prev, loading: false, success: 'Invitation sent successfully!' }));
            setTimeout(() => {
                setState(prev => ({ ...prev, success: '' }));
                // Redirect to dashboard
                navigate('/events');
            }, 1500);
        }
        catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: 'Failed to send invitation. Please try again.'
            }));
        }
    };
    const renderStep = () => {
        const currentStepData = state.steps[state.currentStep];
        switch (currentStepData.id) {
            case 'org':
                return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "orgName", className: "block text-sm font-medium text-gray-700", children: "Organization Name" }), _jsx("input", { id: "orgName", type: "text", value: state.orgName, onChange: (e) => saveProgress({ orgName: e.target.value }), className: "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm", placeholder: "Enter organization name" })] }), _jsx("button", { onClick: handleCreateOrg, disabled: state.loading || !state.orgName.trim(), className: "w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed", children: state.loading ? 'Creating...' : 'Create Organization' })] }));
            case 'project':
                return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "projectName", className: "block text-sm font-medium text-gray-700", children: "Project Name" }), _jsx("input", { id: "projectName", type: "text", value: state.projectName, onChange: (e) => saveProgress({ projectName: e.target.value }), className: "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm", placeholder: "Enter project name" })] }), _jsx("button", { onClick: handleCreateProject, disabled: state.loading || !state.projectName.trim(), className: "w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed", children: state.loading ? 'Creating...' : 'Create Project' })] }));
            case 'property':
                return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "propertyName", className: "block text-sm font-medium text-gray-700", children: "Property Name" }), _jsx("input", { id: "propertyName", type: "text", value: state.propertyName, onChange: (e) => saveProgress({ propertyName: e.target.value }), className: "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm", placeholder: "Enter property name" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "propertyUrl", className: "block text-sm font-medium text-gray-700", children: "Website URL" }), _jsx("input", { id: "propertyUrl", type: "url", value: state.propertyUrl, onChange: (e) => saveProgress({ propertyUrl: e.target.value }), className: "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm", placeholder: "https://example.com" })] }), _jsx("button", { onClick: handleCreateProperty, disabled: state.loading || !state.propertyName.trim() || !state.propertyUrl.trim(), className: "w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed", children: state.loading ? 'Creating...' : 'Create Property' })] }));
            case 'api-key':
                return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "apiKeyName", className: "block text-sm font-medium text-gray-700", children: "API Key Name" }), _jsx("input", { id: "apiKeyName", type: "text", value: state.apiKeyName, onChange: (e) => saveProgress({ apiKeyName: e.target.value }), className: "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm", placeholder: "Enter API key name" })] }), _jsx("button", { onClick: handleCreateApiKey, disabled: state.loading || !state.apiKeyName.trim(), className: "w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed", children: state.loading ? 'Creating...' : 'Create API Key' })] }));
            case 'install':
                return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "bg-blue-50 border border-blue-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("svg", { className: "h-5 w-5 text-blue-400", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z", clipRule: "evenodd" }) }) }), _jsx("div", { className: "ml-3", children: _jsx("p", { className: "text-sm text-blue-800", children: "Install the Optiview tracking code on your website to start collecting data." }) })] }) }), _jsx("button", { onClick: handleCompleteInstall, disabled: state.loading, className: "w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed", children: state.loading ? 'Verifying...' : 'I\'ve installed the code' })] }));
            case 'invite':
                return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "inviteEmail", className: "block text-sm font-medium text-gray-700", children: "Team Member Email" }), _jsx("input", { id: "inviteEmail", type: "email", value: state.inviteEmail, onChange: (e) => saveProgress({ inviteEmail: e.target.value }), className: "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm", placeholder: "Enter email address" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "inviteRole", className: "block text-sm font-medium text-gray-700", children: "Role" }), _jsxs("select", { id: "inviteRole", value: state.inviteRole, onChange: (e) => saveProgress({ inviteRole: e.target.value }), className: "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm", children: [_jsx("option", { value: "member", children: "Member" }), _jsx("option", { value: "owner", children: "Owner" })] })] }), _jsxs("div", { className: "flex space-x-3", children: [_jsx("button", { onClick: () => navigate('/events'), className: "flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500", children: "Skip for now" }), _jsx("button", { onClick: handleSendInvite, disabled: state.loading || !state.inviteEmail.trim(), className: "flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed", children: state.loading ? 'Sending...' : 'Send Invitation' })] })] }));
            default:
                return null;
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-gray-50 py-12", children: _jsxs("div", { className: "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("h1", { className: "text-3xl font-extrabold text-gray-900 mb-2", children: "Welcome to Optiview" }), _jsx("p", { className: "text-lg text-gray-600", children: "Let's get you set up in a few simple steps" })] }), _jsxs("div", { className: "mb-8", children: [_jsx("div", { className: "flex items-center justify-between", children: state.steps.map((step, index) => (_jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: `flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${index < state.currentStep
                                            ? 'bg-green-500 text-white'
                                            : index === state.currentStep
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-200 text-gray-500'}`, children: index < state.currentStep ? (_jsx("svg", { className: "w-5 h-5", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z", clipRule: "evenodd" }) })) : (index + 1) }), index < state.steps.length - 1 && (_jsx("div", { className: `flex-1 h-0.5 mx-4 ${index < state.currentStep ? 'bg-green-500' : 'bg-gray-200'}` }))] }, step.id))) }), _jsx("div", { className: "mt-4 flex justify-between text-sm", children: state.steps.map((step, index) => (_jsx("div", { className: `text-center ${index === state.currentStep ? 'text-indigo-600 font-medium' : 'text-gray-500'}`, style: { width: `${100 / state.steps.length}%` }, children: step.title }, step.id))) })] }), _jsxs(Card, { className: "p-8", children: [state.error && (_jsx("div", { className: "mb-6 bg-red-50 border border-red-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("svg", { className: "h-5 w-5 text-red-400", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z", clipRule: "evenodd" }) }) }), _jsx("div", { className: "ml-3", children: _jsx("p", { className: "text-sm text-red-800", children: state.error }) })] }) })), state.success && (_jsx("div", { className: "mb-6 bg-green-50 border border-green-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("svg", { className: "h-5 w-5 text-green-400", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }) }), _jsx("div", { className: "ml-3", children: _jsx("p", { className: "text-sm text-green-800", children: state.success }) })] }) })), _jsxs("div", { className: "mb-8", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-2", children: state.steps[state.currentStep].title }), _jsx("p", { className: "text-gray-600", children: state.steps[state.currentStep].description })] }), renderStep(), state.steps[state.currentStep].id !== 'invite' && (_jsxs("div", { className: "mt-8 flex justify-between", children: [_jsx("button", { onClick: handlePrevious, disabled: state.currentStep === 0, className: "py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed", children: "Previous" }), _jsx("button", { onClick: handleNext, disabled: state.currentStep === state.steps.length - 1 || !state.steps[state.currentStep].completed, className: "py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed", children: "Next" })] }))] })] }) }));
}

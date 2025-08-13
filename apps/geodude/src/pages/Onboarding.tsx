import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

interface OnboardingState {
  currentStep: number;
  steps: OnboardingStep[];
  loading: boolean;
  error: string;
  success: string;
  // Step data
  orgName: string;
  projectName: string;
  propertyName: string;
  propertyUrl: string;
  apiKeyName: string;
  inviteEmail: string;
  inviteRole: 'member' | 'owner';
}

export default function Onboarding() {
  const [state, setState] = useState<OnboardingState>({
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
      } catch (e) {
        console.error('Failed to load onboarding progress:', e);
      }
    }
  }, []);

  // Save progress to localStorage
  const saveProgress = (updates: Partial<OnboardingState>) => {
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

  const handleStepComplete = (stepId: string) => {
    const updatedSteps = state.steps.map(step =>
      step.id === stepId ? { ...step, completed: true } : step
    );
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
        return (
          <div className="space-y-6">
            <div>
              <label htmlFor="orgName" className="block text-sm font-medium text-gray-700">
                Organization Name
              </label>
              <input
                id="orgName"
                type="text"
                value={state.orgName}
                onChange={(e) => saveProgress({ orgName: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter organization name"
              />
            </div>
            <button
              onClick={handleCreateOrg}
              disabled={state.loading || !state.orgName.trim()}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.loading ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        );

      case 'project':
        return (
          <div className="space-y-6">
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">
                Project Name
              </label>
              <input
                id="projectName"
                type="text"
                value={state.projectName}
                onChange={(e) => saveProgress({ projectName: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter project name"
              />
            </div>
            <button
              onClick={handleCreateProject}
              disabled={state.loading || !state.projectName.trim()}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        );

      case 'property':
        return (
          <div className="space-y-6">
            <div>
              <label htmlFor="propertyName" className="block text-sm font-medium text-gray-700">
                Property Name
              </label>
              <input
                id="propertyName"
                type="text"
                value={state.propertyName}
                onChange={(e) => saveProgress({ propertyName: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter property name"
              />
            </div>
            <div>
              <label htmlFor="propertyUrl" className="block text-sm font-medium text-gray-700">
                Website URL
              </label>
              <input
                id="propertyUrl"
                type="url"
                value={state.propertyUrl}
                onChange={(e) => saveProgress({ propertyUrl: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="https://example.com"
              />
            </div>
            <button
              onClick={handleCreateProperty}
              disabled={state.loading || !state.propertyName.trim() || !state.propertyUrl.trim()}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.loading ? 'Creating...' : 'Create Property'}
            </button>
          </div>
        );

      case 'api-key':
        return (
          <div className="space-y-6">
            <div>
              <label htmlFor="apiKeyName" className="block text-sm font-medium text-gray-700">
                API Key Name
              </label>
              <input
                id="apiKeyName"
                type="text"
                value={state.apiKeyName}
                onChange={(e) => saveProgress({ apiKeyName: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter API key name"
              />
            </div>
            <button
              onClick={handleCreateApiKey}
              disabled={state.loading || !state.apiKeyName.trim()}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.loading ? 'Creating...' : 'Create API Key'}
            </button>
          </div>
        );

      case 'install':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    Install the Optiview tracking code on your website to start collecting data.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleCompleteInstall}
              disabled={state.loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.loading ? 'Verifying...' : 'I\'ve installed the code'}
            </button>
          </div>
        );

      case 'invite':
        return (
          <div className="space-y-6">
            <div>
              <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700">
                Team Member Email
              </label>
              <input
                id="inviteEmail"
                type="email"
                value={state.inviteEmail}
                onChange={(e) => saveProgress({ inviteEmail: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter email address"
              />
            </div>
            <div>
              <label htmlFor="inviteRole" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                id="inviteRole"
                value={state.inviteRole}
                onChange={(e) => saveProgress({ inviteRole: e.target.value as 'member' | 'owner' })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="member">Member</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/events')}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Skip for now
              </button>
              <button
                onClick={handleSendInvite}
                disabled={state.loading || !state.inviteEmail.trim()}
                className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.loading ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
            Welcome to Optiview
          </h1>
          <p className="text-lg text-gray-600">
            Let's get you set up in a few simple steps
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {state.steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index < state.currentStep
                    ? 'bg-green-500 text-white'
                    : index === state.currentStep
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {index < state.currentStep ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                {index < state.steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    index < state.currentStep ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between text-sm">
            {state.steps.map((step, index) => (
              <div
                key={step.id}
                className={`text-center ${
                  index === state.currentStep ? 'text-indigo-600 font-medium' : 'text-gray-500'
                }`}
                style={{ width: `${100 / state.steps.length}%` }}
              >
                {step.title}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="p-8">
          {state.error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{state.error}</p>
                </div>
              </div>
            </div>
          )}

          {state.success && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800">{state.success}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {state.steps[state.currentStep].title}
            </h2>
            <p className="text-gray-600">
              {state.steps[state.currentStep].description}
            </p>
          </div>

          {renderStep()}

          {/* Navigation */}
          {state.steps[state.currentStep].id !== 'invite' && (
            <div className="mt-8 flex justify-between">
              <button
                onClick={handlePrevious}
                disabled={state.currentStep === 0}
                className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={handleNext}
                disabled={state.currentStep === state.steps.length - 1 || !state.steps[state.currentStep].completed}
                className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

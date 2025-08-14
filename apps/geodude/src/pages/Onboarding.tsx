import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { API_BASE } from '../config';

interface OnboardingState {
  step: number;
  organization: {
    name: string;
    slug: string;
    id?: string;
  };
  project: {
    name: string;
    description: string;
    id?: string;
  };
  loading: boolean;
  error: string;
}

export default function Onboarding() {
  const [state, setState] = useState<OnboardingState>({
    step: 1,
    organization: { name: '', slug: '' },
    project: { name: '', description: '' },
    loading: false,
    error: ''
  });

  const handleNext = async () => {
    if (state.step === 1) {
      // Create organization
      await createOrganization();
    } else if (state.step === 2) {
      // Create project
      await createProject();
    }
  };

  const handlePrevious = () => {
    if (state.step > 1) {
      setState(prev => ({ ...prev, step: prev.step - 1, error: '' }));
    }
  };

  const createOrganization = async () => {
    if (!state.organization.name.trim() || !state.organization.slug.trim()) {
      setState(prev => ({ ...prev, error: 'Organization name and slug are required' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: '' }));

    try {
      const response = await fetch(`${API_BASE}/api/onboarding/organization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.organization.name.trim(),
          slug: state.organization.slug.trim()
        })
      });

      const data = await response.json();

      if (response.ok) {
        setState(prev => ({ 
          ...prev, 
          step: 2, 
          organization: { ...prev.organization, id: data.organization.id },
          loading: false 
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          error: data.error || 'Failed to create organization',
          loading: false 
        }));
      }
    } catch (error) {
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
        body: JSON.stringify({
          name: state.project.name.trim(),
          description: state.project.description.trim(),
          organizationId: state.organization.id
        })
      });

      const data = await response.json();

      if (response.ok) {
        setState(prev => ({ 
          ...prev, 
          project: { ...prev.project, id: data.project.id },
          loading: false 
        }));
        
        // Complete onboarding and redirect to main app
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        setState(prev => ({ 
          ...prev, 
          error: data.error || 'Failed to create project',
          loading: false 
        }));
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Network error. Please try again.',
        loading: false 
      }));
    }
  };

  const updateOrganization = (field: keyof typeof state.organization, value: string) => {
    setState(prev => ({
      ...prev,
      organization: { ...prev.organization, [field]: value },
      error: '' // Clear error when user types
    }));
  };

  const updateProject = (field: keyof typeof state.project, value: string) => {
    setState(prev => ({
      ...prev,
      project: { ...prev.project, [field]: value },
      error: '' // Clear error when user types
    }));
  };

  const canProceed = () => {
    if (state.step === 1) {
      return state.organization.name.trim() && state.organization.slug.trim() && !state.loading;
    }
    if (state.step === 2) {
      return state.project.name.trim() && !state.loading;
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Optiview</h1>
          <p className="text-gray-600">Let's get you set up in a few simple steps</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-4">
            {[1, 2].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  step < state.step 
                    ? 'bg-green-500 text-white' 
                    : step === state.step 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {step < state.step ? '✓' : step}
                </div>
                {step < 2 && (
                  <div className={`w-16 h-1 mx-2 ${
                    step < state.step ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Display */}
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

        {/* Step Content */}
        <Card className="p-8">
          {state.step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Organization</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={state.organization.name}
                    onChange={(e) => updateOrganization('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your organization name"
                    disabled={state.loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organization Slug
                  </label>
                  <input
                    type="text"
                    value={state.organization.slug}
                    onChange={(e) => updateOrganization('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="your-org-slug"
                    disabled={state.loading}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    This will be used in URLs and API endpoints
                  </p>
                </div>
              </div>
            </div>
          )}

          {state.step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Project</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={state.project.name}
                    onChange={(e) => updateProject('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your project name"
                    disabled={state.loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={state.project.description}
                    onChange={(e) => updateProject('description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Describe what this project is for"
                    disabled={state.loading}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <button
              onClick={handlePrevious}
              disabled={state.step === 1 || state.loading}
              className={`px-6 py-2 rounded-md font-medium ${
                state.step === 1 || state.loading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`px-6 py-2 rounded-md font-medium ${
                canProceed()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {state.loading ? 'Creating...' : state.step === 2 ? 'Complete Setup' : 'Next'}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

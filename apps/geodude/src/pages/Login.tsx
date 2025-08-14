import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { API_BASE } from '../config';

interface LoginState {
  email: string;
  code: string;
  step: 'request' | 'verify';
  loading: boolean;
  error: string;
  success: string;
  authMethod: 'otp' | 'magic-link';
}

export default function Login() {
  const [state, setState] = useState<LoginState>({
    email: '',
    code: '',
    step: 'request',
    loading: false,
    error: '',
    success: '',
    authMethod: 'otp'
  });

  const navigate = useNavigate();

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, loading: true, error: '', success: '' }));

    try {
      if (state.authMethod === 'otp') {
        const response = await fetch(`${API_BASE}/api/auth/request-code`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: state.email }),
        });

        if (response.ok) {
          setState(prev => ({
            ...prev,
            step: 'verify',
            loading: false,
            success: 'Check your email for a login code!'
          }));
        } else {
          const data = await response.json();
          setState(prev => ({
            ...prev,
            loading: false,
            error: data.error || 'Failed to send code'
          }));
        }
      } else {
        // Magic link flow
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
        } else {
          const data = await response.json();
          setState(prev => ({
            ...prev,
            loading: false,
            error: data.error || 'Failed to send magic link'
          }));
        }
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Network error. Please try again.'
      }));
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, loading: true, error: '', success: '' }));

    try {
      const response = await fetch(`${API_BASE}/api/auth/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: state.email,
          code: state.code
        }),
      });

      if (response.ok) {
        setState(prev => ({
          ...prev,
          loading: false,
          success: 'Login successful! Redirecting...'
        }));

        // Redirect to dashboard after successful login
        setTimeout(() => {
          navigate('/events');
        }, 1500);
      } else {
        const data = await response.json();
        setState(prev => ({
          ...prev,
          loading: false,
          error: data.error || 'Invalid code'
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Network error. Please try again.'
      }));
    }
  };

  const handleResendCode = () => {
    setState(prev => ({ ...prev, step: 'request', code: '', error: '', success: '' }));
  };

  const isEmailValid = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  if (state.step === 'verify') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Enter your code
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-indigo-600">{state.email}</span>
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <Card className="px-4 py-8 sm:px-10">
            {state.success && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
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

            {state.error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
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

            <form onSubmit={handleVerifyCode} className="space-y-6">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                  Verification Code
                </label>
                <div className="mt-1">
                  <input
                    id="code"
                    name="code"
                    type="text"
                    required
                    value={state.code}
                    onChange={(e) => setState(prev => ({ ...prev, code: e.target.value }))}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    pattern="[0-9]{6}"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={state.loading || state.code.length !== 6}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {state.loading ? 'Verifying...' : 'Verify Code'}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <button
                onClick={handleResendCode}
                className="w-full text-center text-sm text-indigo-600 hover:text-indigo-500"
              >
                Didn't receive a code? Resend
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to Optiview
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter your email to receive a login code
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="px-4 py-8 sm:px-10">
          {/* Auth Method Tabs */}
          <div className="mb-6">
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setState(prev => ({ ...prev, authMethod: 'otp', step: 'request', error: '', success: '' }))}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${state.authMethod === 'otp'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Login Code
              </button>
              <button
                type="button"
                onClick={() => setState(prev => ({ ...prev, authMethod: 'magic-link', step: 'request', error: '', success: '' }))}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${state.authMethod === 'magic-link'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Magic Link
              </button>
            </div>
          </div>

          {state.error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
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

          <form onSubmit={handleRequestCode} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={state.email}
                  onChange={(e) => setState(prev => ({ ...prev, email: e.target.value }))}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={state.loading || !isEmailValid(state.email)}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.loading ? 'Sending...' : state.authMethod === 'otp' ? 'Send Login Code' : 'Send Magic Link'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              By signing in, you agree to our{' '}
              <a href="/terms" className="text-indigo-600 hover:text-indigo-500">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-indigo-600 hover:text-indigo-500">
                Privacy Policy
              </a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../config';

export default function MagicLink() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const consumeMagicLink = async () => {
      try {
        const token = searchParams.get('token');

        if (!token) {
          setError('No token provided');
          setStatus('error');
          return;
        }

        // Call the API to consume the magic link
        const response = await fetch(`${API_BASE}/auth/magic?token=${token}`, {
          method: 'GET',
          credentials: 'include', // Include cookies for session
        });

        if (response.ok) {
          // Magic link consumed successfully
          setStatus('success');

          // Redirect to onboarding after a brief delay
          setTimeout(() => {
            navigate('/onboarding');
          }, 1500);
        } else {
          // Handle different error cases
          if (response.status === 400) {
            setError('Invalid or expired token');
          } else if (response.status === 404) {
            setError('Token not found');
          } else {
            setError('Failed to validate magic link');
          }
          setStatus('error');
        }
      } catch (err) {
        console.error('Magic link consumption error:', err);
        setError('Network error. Please try again.');
        setStatus('error');
      }
    };

    consumeMagicLink();
  }, [searchParams, navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900">Validating your magic link...</h2>
            <p className="text-gray-600 mt-2">Please wait while we verify your sign-in link.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Magic link validated!</h2>
            <p className="text-gray-600 mt-2">Redirecting you to onboarding...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Magic link error</h2>
          <p className="text-gray-600 mt-2">{error}</p>
          <div className="mt-6">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

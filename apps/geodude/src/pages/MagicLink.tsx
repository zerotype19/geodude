import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../config';

export default function MagicLink() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUserData } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const [hasProcessed, setHasProcessed] = useState(false);

  useEffect(() => {
    const handleMagicLink = async () => {
      // Prevent multiple API calls
      if (hasProcessed) return;
      setHasProcessed(true);

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
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.success) {
            setStatus('success');
            
            // Debug: Check if session cookie is set
            console.log('🍪 Session cookie after magic link:', document.cookie);
            
            // Wait a bit for the session cookie to be set in the browser
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Debug: Check cookie again after delay
            console.log('🍪 Session cookie after delay:', document.cookie);
            
            // Refresh user data to get the latest state
            console.log('🔄 Calling refreshUserData...');
            await refreshUserData();
            console.log('✅ refreshUserData completed');
            
            // Redirect based on whether user has organization
            if (data.has_organization) {
              // User has completed onboarding, go to main app
              console.log('🏠 Redirecting to main app...');
              setTimeout(() => {
                navigate('/events');
              }, 1000);
            } else {
              // New user, go to onboarding
              console.log('📝 Redirecting to onboarding...');
              setTimeout(() => {
                navigate('/onboarding');
              }, 1000);
            }
          } else {
            setError('Magic link validation failed');
            setStatus('error');
            setTimeout(() => {
              navigate('/login');
            }, 2000);
          }
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
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        }
      } catch (err) {
        console.error('Magic link handling error:', err);
        setError('Network error. Please try again.');
        setStatus('error');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    };

    handleMagicLink();
  }, [searchParams, navigate, refreshUserData, hasProcessed]);

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
            <h2 className="text-xl font-semibold text-gray-900">Welcome back!</h2>
            <p className="text-gray-600 mt-2">Redirecting you to the dashboard...</p>
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
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

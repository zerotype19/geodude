import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.optiview.ai';

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setError('Missing token');
        setTimeout(() => navigate('/auth/error?reason=missing'), 2000);
        return;
      }

      try {
        // Call the API verify endpoint - it will set the session cookie
        const response = await fetch(`${API_BASE}/v1/auth/magic/verify?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          credentials: 'include'
        });

        if (!response.ok) {
          setError('Verification failed');
          setTimeout(() => navigate('/auth/error?reason=invalid'), 2000);
          return;
        }

        const data = await response.json();
        
        if (data.ok && data.redirectTo) {
          // Session cookie is set, navigate to the intended page
          window.location.href = data.redirectTo;
        } else {
          setError('Verification failed');
          setTimeout(() => navigate('/auth/error?reason=invalid'), 2000);
        }
      } catch (err) {
        console.error('Verification error:', err);
        setError('Verification failed');
        setTimeout(() => navigate('/auth/error?reason=error'), 2000);
      }
    };

    verifyToken();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-surface-1 rounded-lg shadow-lg p-8 text-center">
        <div className="inline-block p-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full mb-4 animate-pulse">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold  mb-2">
          {error ? 'Verification Failed' : 'Signing you in…'}
        </h1>
        <p className="text-sm muted">
          {error || 'Please wait while we verify your link.'}
        </p>
        
        {!error && (
          <div className="mt-6">
            <div className="flex justify-center space-x-2">
              <div className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


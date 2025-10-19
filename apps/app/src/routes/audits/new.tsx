import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_BASE = 'https://api.optiview.ai';

export default function NewAudit() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createAudit = async () => {
      try {
        const project_id = searchParams.get('project_id');
        const root_url = searchParams.get('root_url');
        const site_description = searchParams.get('site_description');
        const max_pages = searchParams.get('max_pages');

        if (!root_url) {
          setError('Missing audit details');
          return;
        }

        console.log('[NEW AUDIT] Creating audit:', { project_id, root_url });

        const response = await fetch(`${API_BASE}/api/audits`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include session cookie
          body: JSON.stringify({
            project_id: project_id || 'default',
            root_url,
            site_description: site_description || null,
            max_pages: parseInt(max_pages || '50', 10)
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[NEW AUDIT] Failed to create audit:', response.status, errorText);
          setError(`Failed to create audit: ${response.status}`);
          return;
        }

        const result = await response.json();
        console.log('[NEW AUDIT] Audit created:', result);

        // Redirect to the audit page
        if (result.audit_id) {
          navigate(`/audits/${result.audit_id}`);
        } else {
          setError('Audit created but no ID returned');
        }

      } catch (err) {
        console.error('[NEW AUDIT] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    createAudit();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="inline-block p-4 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Failed to Start Audit
          </h1>
          <p className="text-sm text-gray-600 mb-4">
            {error}
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="inline-block p-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full mb-4 animate-pulse">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Starting Your Audit
        </h1>
        <p className="text-sm text-gray-600">
          Please wait while we set up your audit...
        </p>
        
        <div className="mt-6">
          <div className="flex justify-center space-x-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}


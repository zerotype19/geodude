import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

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

        // Redirect to the audits dashboard (not the empty audit detail page)
        // User can click into the audit once it has data
        if (result.audit_id) {
          navigate('/audits');
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
      <div className="min-h-screen bg-surface-2 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardBody className="text-center py-12">
            <h1 className="text-2xl font-semibold mb-2">
              Failed to Start Audit
            </h1>
            <p className="muted mb-6">
              {error}
            </p>
            <Button onClick={() => navigate('/')}>
              Return Home
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardBody className="text-center py-12">
          <h1 className="text-2xl font-semibold mb-2">
            Starting Your Audit
          </h1>
          <p className="muted">
            Please wait while we set up your audit...
          </p>
          
          <div className="mt-8">
            <div className="flex justify-center space-x-2">
              <div className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


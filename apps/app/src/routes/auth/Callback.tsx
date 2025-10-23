import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardBody } from '../../components/ui/Card';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.optiview.ai';

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isStartingAudit, setIsStartingAudit] = useState(false);

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
          // Check if this is a new audit flow
          if (data.redirectTo.includes('/audits/new?')) {
            setIsStartingAudit(true);
          }
          
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
      <Card className="max-w-md w-full">
        <CardBody className="text-center py-12">
          <h1 className="text-2xl font-semibold mb-2">
            {error ? 'Verification Failed' : isStartingAudit ? 'Starting Your Audit' : 'Signing you in'}
          </h1>
          <p className="muted">
            {error || (isStartingAudit ? 'Setting up your audit...' : 'Please wait while we verify your link.')}
          </p>
          
          {!error && (
            <div className="mt-8">
              <div className="flex justify-center space-x-2">
                <div className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}


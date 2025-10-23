import { useSearchParams } from 'react-router-dom';
import { Card, CardBody } from '../../components/ui/Card';

export default function CheckEmail() {
  const [sp] = useSearchParams();
  const email = sp.get('email') ?? '';
  
  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardBody className="p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold mb-2">Check your email</h1>
            <p className="muted mb-6">
              We sent a secure sign-in link to{' '}
              <strong>{email || 'your inbox'}</strong>
            </p>
            <div className="bg-brand-soft border border-brand/20 rounded-lg p-4 text-sm text-left">
              <p className="font-medium mb-2">
                What to do next:
              </p>
              <ol className="list-decimal list-inside space-y-1 muted">
                <li>Check your email inbox</li>
                <li>Click the sign-in link</li>
                <li>You'll be automatically signed in</li>
              </ol>
            </div>
          </div>

          <div className="border-t border-border pt-6 mb-6">
            <div className="bg-warn-soft border border-warn/20 rounded-lg p-4 text-sm">
              <p className="font-medium mb-1">
                Link expires in 20 minutes
              </p>
              <p className="muted">
                If you don't see the email, check your spam folder.
              </p>
            </div>
          </div>

          <div className="text-center">
            <a href="/" className="text-sm muted hover:text-brand">
              ← Back to home
            </a>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


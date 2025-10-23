import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function AuthError() {
  const [sp] = useSearchParams();
  const reason = sp.get('reason') || 'unknown';
  
  const getErrorDetails = (reason: string) => {
    switch (reason) {
      case 'expired_or_invalid':
        return {
          title: 'Sign-in link expired',
          message: 'Your magic link has expired or is no longer valid. Links expire after 20 minutes for security.',
          explanation: 'Magic links are single-use and expire after 20 minutes. This keeps your account secure.'
        };
      case 'missing':
        return {
          title: 'Missing sign-in link',
          message: 'No sign-in token was provided. Please request a new magic link.',
          explanation: 'The sign-in link was incomplete or malformed.'
        };
      case 'unauthorized':
        return {
          title: 'Access denied',
          message: 'You don\'t have permission to access this audit. It may belong to another user.',
          explanation: 'This audit belongs to another account. Each user can only access their own audits.'
        };
      case 'internal_error':
        return {
          title: 'Something went wrong',
          message: 'An unexpected error occurred. Please try requesting a new link.',
          explanation: 'Our servers encountered an unexpected issue while processing your request.'
        };
      default:
        return {
          title: 'Sign-in link issue',
          message: `Your link has an issue: ${reason.replaceAll('_', ' ')}. You can request a new one.`,
          explanation: 'The sign-in link could not be verified.'
        };
    }
  };

  const details = getErrorDetails(reason);

  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardBody className="p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold mb-2">{details.title}</h1>
            <p className="muted mb-6">
              {details.message}
            </p>

            <div className="bg-danger-soft border border-danger/20 rounded-lg p-4 text-sm text-left mb-6">
              <p className="font-medium mb-2">
                What happened?
              </p>
              <p className="muted">
                {details.explanation}
              </p>
            </div>

            <div className="space-y-3">
              <Link to="/" className="block">
                <Button className="w-full">
                  Request a new link
                </Button>
              </Link>
              <Link to="/audits" className="block">
                <Button variant="soft" className="w-full">
                  View my audits
                </Button>
              </Link>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <div className="bg-brand-soft border border-brand/20 rounded-lg p-4 text-sm">
              <p className="font-medium mb-1">
                Tip
              </p>
              <p className="muted">
                Magic links work only once and expire quickly. 
                Save the link or click it right away when you receive it.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


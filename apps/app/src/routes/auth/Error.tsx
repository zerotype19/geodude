import { Link, useSearchParams } from 'react-router-dom';

export default function AuthError() {
  const [sp] = useSearchParams();
  const reason = sp.get('reason') || 'unknown';
  
  const getErrorDetails = (reason: string) => {
    switch (reason) {
      case 'expired_or_invalid':
        return {
          title: 'Sign-in link expired',
          message: 'Your magic link has expired or is no longer valid. Links expire after 20 minutes for security.',
          icon: '⏱️'
        };
      case 'missing':
        return {
          title: 'Missing sign-in link',
          message: 'No sign-in token was provided. Please request a new magic link.',
          icon: '🔍'
        };
      case 'unauthorized':
        return {
          title: 'Access denied',
          message: 'You don\'t have permission to access this audit. It may belong to another user.',
          icon: '🔒'
        };
      case 'internal_error':
        return {
          title: 'Something went wrong',
          message: 'An unexpected error occurred. Please try requesting a new link.',
          icon: '⚠️'
        };
      default:
        return {
          title: 'Sign-in link issue',
          message: `Your link has an issue: ${reason.replaceAll('_', ' ')}. You can request a new one.`,
          icon: '❌'
        };
    }
  };

  const details = getErrorDetails(reason);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">{details.icon}</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{details.title}</h1>
          <p className="text-sm text-gray-600 mb-6">
            {details.message}
          </p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-left mb-6">
            <p className="text-red-900 mb-2">
              <strong>What happened?</strong>
            </p>
            <p className="text-red-800">
              {reason === 'expired_or_invalid' && 'Magic links are single-use and expire after 20 minutes. This keeps your account secure.'}
              {reason === 'unauthorized' && 'This audit belongs to another account. Each user can only access their own audits.'}
              {reason === 'missing' && 'The sign-in link was incomplete or malformed.'}
              {reason === 'internal_error' && 'Our servers encountered an unexpected issue while processing your request.'}
              {!['expired_or_invalid', 'unauthorized', 'missing', 'internal_error'].includes(reason) && 'The sign-in link could not be verified.'}
            </p>
          </div>

          <div className="space-y-3">
            <Link
              to="/"
              className="block w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition font-medium"
            >
              Request a new link
            </Link>
            <Link
              to="/audits"
              className="block w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              View my audits
            </Link>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p className="text-blue-900">
              💡 <strong>Tip:</strong> Magic links work only once and expire quickly. 
              Save the link or click it right away when you receive it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


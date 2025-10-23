import { useSearchParams } from 'react-router-dom';

export default function CheckEmail() {
  const [sp] = useSearchParams();
  const email = sp.get('email') ?? '';
  
  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-surface-1 rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="inline-block p-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold  mb-2">Check your email</h1>
          <p className="text-sm muted mb-4">
            We sent a secure sign-in link to{' '}
            <strong className="">{email || 'your inbox'}</strong>
          </p>
          <div className="bg-brand-soft border border-blue-200 rounded-lg p-4 text-sm text-left">
            <p className="text-brand mb-2">
              📧 <strong>What to do next:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-brand">
              <li>Check your email inbox</li>
              <li>Click the sign-in link</li>
              <li>You'll be automatically signed in</li>
            </ol>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <div className="bg-warn-soft border border-warn rounded-lg p-3 text-sm">
            <p className="text-yellow-900">
              ⏱️ <strong>Link expires in 20 minutes</strong>
            </p>
            <p className="text-warn mt-1">
              If you don't see the email, check your spam folder.
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm muted hover: underline">
            ← Back to home
          </a>
        </div>
      </div>
    </div>
  );
}


import React, { useState } from 'react';
import { apiPost } from '../lib/api';

interface PublicShareToggleProps {
  auditId: string;
  initialIsPublic: boolean;
  compact?: boolean; // New prop for inline/header mode
}

export default function PublicShareToggle({ auditId, initialIsPublic, compact = false }: PublicShareToggleProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  
  const publicUrl = `${window.location.origin}/public/${auditId}`;

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const response = await apiPost(`/api/audits/${auditId}/public`, {
        is_public: !isPublic
      });
      
      if (response.success) {
        setIsPublic(!isPublic);
        // If turning on in compact mode, auto-copy the link
        if (!isPublic && compact) {
          handleCopyLink();
        }
      }
    } catch (error) {
      console.error('Failed to toggle public status:', error);
      alert('Failed to update sharing status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setShowCopyConfirm(true);
      setTimeout(() => {
        setCopied(false);
        setShowCopyConfirm(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback: select the text
      const input = document.createElement('input');
      input.value = publicUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setShowCopyConfirm(true);
      setTimeout(() => {
        setCopied(false);
        setShowCopyConfirm(false);
      }, 2000);
    }
  };

  // Compact inline version for header
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink-muted">Make Public</span>
          <button
            onClick={handleToggle}
            disabled={isLoading}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${isPublic ? 'bg-success' : 'bg-surface-3'}
              ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            aria-label={isPublic ? 'Make audit private' : 'Make audit public'}
            title={isPublic ? 'Click to make private' : 'Click to make public'}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm
                ${isPublic ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>
        
        {isPublic && (
          <button
            onClick={handleCopyLink}
            className="text-sm text-brand hover:underline font-medium flex items-center gap-1"
            title="Copy public link"
          >
            {showCopyConfirm ? (
              <>
                <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-success">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy Link
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  // Full card version (original)
  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-base mb-1">Public Sharing</h3>
            <p className="text-sm muted">
              {isPublic 
                ? 'This audit is publicly accessible via a shareable link'
                : 'Make this audit publicly accessible to share with others'
              }
            </p>
          </div>
          
          <button
            onClick={handleToggle}
            disabled={isLoading}
            className={`
              relative inline-flex h-7 w-14 items-center rounded-full transition-colors
              ${isPublic ? 'bg-success' : 'bg-surface-3'}
              ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            aria-label={isPublic ? 'Make audit private' : 'Make audit public'}
          >
            <span
              className={`
                inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm
                ${isPublic ? 'translate-x-8' : 'translate-x-1'}
              `}
            />
          </button>
        </div>

        {isPublic && (
          <div className="mt-4 pt-4 border-t border-border">
            <label className="field-label mb-2">Public URL</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={publicUrl}
                readOnly
                className="flex-1 px-3 py-2 text-sm bg-surface-2 border border-border rounded-lg font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={handleCopyLink}
                className={`
                  px-4 py-2 rounded-lg font-semibold text-sm transition-all flex-shrink-0
                  ${copied 
                    ? 'bg-success-soft text-success' 
                    : 'btn-soft hover:bg-brand hover:text-white'
                  }
                `}
              >
                {copied ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </span>
                ) : (
                  'Copy Link'
                )}
              </button>
            </div>
            <p className="text-xs muted mt-2">
              Anyone with this link can view the audit results, even without an Optiview account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


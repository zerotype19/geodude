import React, { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

interface MaskedKeyProps {
  value: string;
  className?: string;
}

export default function MaskedKey({ value, className = "" }: MaskedKeyProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Mask the key: show "key_" prefix + last 4 chars, middle as bullets
  const maskKey = useCallback((key: string) => {
    if (!key || key.length <= 8) return key;
    const prefix = key.startsWith('key_') ? 'key_' : '';
    const last4 = key.slice(-4);
    const bulletCount = Math.max(0, key.length - prefix.length - 4);
    return prefix + '•'.repeat(bulletCount) + last4;
  }, []);

  // Auto-hide after 60 seconds
  useEffect(() => {
    if (!isRevealed) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRevealed(false);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRevealed]);

  const handleReveal = () => {
    if (isRevealed) {
      setIsRevealed(false);
      setSecondsLeft(60);
    } else {
      setIsRevealed(true);
      setSecondsLeft(60);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus('success');
      
      // Show success toast (simple implementation)
      const event = new CustomEvent('show-toast', { 
        detail: { message: 'Key ID copied', type: 'success' }
      });
      window.dispatchEvent(event);
      
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      setCopyStatus('error');
      
      // Show error toast
      const event = new CustomEvent('show-toast', { 
        detail: { message: 'Failed to copy to clipboard', type: 'error' }
      });
      window.dispatchEvent(event);
      
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Key display */}
      <span 
        className={`font-mono text-sm ${isRevealed ? 'select-all' : 'select-none'}`}
        title={isRevealed ? value : 'Click reveal to view full key'}
      >
        {isRevealed ? value : maskKey(value)}
      </span>

      {/* Countdown badge when revealed */}
      {isRevealed && (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
          Visible for {secondsLeft}s
        </span>
      )}

      {/* Reveal/Hide button */}
      <button
        onClick={handleReveal}
        aria-pressed={isRevealed}
        aria-label={isRevealed ? 'Hide key ID' : 'Reveal key ID'}
        className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
        title={isRevealed ? 'Hide key ID' : 'Reveal key ID for 60 seconds'}
      >
        {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        disabled={copyStatus !== 'idle'}
        aria-label="Copy key ID to clipboard"
        className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded disabled:opacity-50"
        title="Copy key ID to clipboard"
      >
        {copyStatus === 'success' ? (
          <Check size={16} className="text-green-600" />
        ) : (
          <Copy size={16} />
        )}
      </button>
    </div>
  );
}

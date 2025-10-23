import React from 'react';

interface AICitedBadgeProps {
  citationCount: number;
  className?: string;
  showCount?: boolean;
}

/**
 * Badge to indicate a page is being cited by AI systems
 */
export default function AICitedBadge({ citationCount, className = '', showCount = true }: AICitedBadgeProps) {
  if (citationCount === 0) return null;

  return (
    <span 
      className={`pill pill-brand inline-flex items-center gap-1 ${className}`}
      title={`Cited ${citationCount} time${citationCount !== 1 ? 's' : ''} by AI systems`}
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
      </svg>
      <span className="font-bold">AI</span>
      {showCount && citationCount > 1 && (
        <span className="text-xs">×{citationCount}</span>
      )}
    </span>
  );
}


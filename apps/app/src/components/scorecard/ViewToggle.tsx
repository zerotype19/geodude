import { useState, useEffect } from 'react';

export type ScorecardView = 'business' | 'technical';

const STORAGE_KEY = 'ov:scorecard:view';

interface ViewToggleProps {
  onChange?: (view: ScorecardView) => void;
}

export default function ViewToggle({ onChange }: ViewToggleProps) {
  const [view, setView] = useState<ScorecardView>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(STORAGE_KEY) as ScorecardView) || 'business';
    }
    return 'business';
  });

  const handleToggle = (newView: ScorecardView) => {
    setView(newView);
    localStorage.setItem(STORAGE_KEY, newView);
    onChange?.(newView);
  };

  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-1 p-1">
      <button
        onClick={() => handleToggle('business')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          view === 'business'
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
            : 'muted hover:'
        }`}
      >
        Business View
      </button>
      <button
        onClick={() => handleToggle('technical')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          view === 'technical'
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
            : 'muted hover:'
        }`}
      >
        Technical View
      </button>
    </div>
  );
}

/**
 * Custom hook for scorecard view management
 */
export function useScorecardView(): [ScorecardView, (view: ScorecardView) => void] {
  const [view, setView] = useState<ScorecardView>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(STORAGE_KEY) as ScorecardView) || 'business';
    }
    return 'business';
  });

  const updateView = (newView: ScorecardView) => {
    setView(newView);
    localStorage.setItem(STORAGE_KEY, newView);
  };

  return [view, updateView];
}


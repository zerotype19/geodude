/**
 * Global View Mode Toggle
 * 
 * Switches between Business (default) and Technical views
 */

import { useViewMode } from '../store/viewMode';

export default function ViewToggle() {
  const { mode, setMode } = useViewMode();

  return (
    <div className="inline-flex items-center gap-1 bg-surface-2 rounded-lg p-1">
      <button
        onClick={() => setMode('business')}
        className={`
          px-4 py-2 rounded-md text-sm font-medium transition-colors
          ${mode === 'business' 
            ? 'bg-surface-1 text-ink shadow-sm' 
            : 'text-ink-muted hover:text-ink'
          }
        `}
      >
        Business
      </button>
      <button
        onClick={() => setMode('technical')}
        className={`
          px-4 py-2 rounded-md text-sm font-medium transition-colors
          ${mode === 'technical' 
            ? 'bg-surface-1 text-ink shadow-sm' 
            : 'text-ink-muted hover:text-ink'
          }
        `}
      >
        Technical
      </button>
    </div>
  );
}


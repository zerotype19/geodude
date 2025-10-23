/**
 * Global View Mode Toggle
 * 
 * Switches between Business (default) and Technical views
 */

import { useViewMode } from '../store/viewMode';

export default function ViewToggle() {
  const { mode, setMode } = useViewMode();

  return (
    <div className="inline-flex items-center gap-2 bg-surface-2 dark:bg-gray-800 rounded-lg p-1">
      <button
        onClick={() => setMode('business')}
        className={`
          px-4 py-2 rounded-md text-sm font-medium transition-colors
          ${mode === 'business' 
            ? 'bg-surface-1 dark:bg-gray-700 text-brand dark:text-purple-400 shadow-sm' 
            : 'muted dark:subtle hover: dark:hover:text-gray-200'
          }
        `}
      >
        👔 Business
      </button>
      <button
        onClick={() => setMode('technical')}
        className={`
          px-4 py-2 rounded-md text-sm font-medium transition-colors
          ${mode === 'technical' 
            ? 'bg-surface-1 dark:bg-gray-700 text-brand dark:text-purple-400 shadow-sm' 
            : 'muted dark:subtle hover: dark:hover:text-gray-200'
          }
        `}
      >
        🔧 Technical
      </button>
    </div>
  );
}


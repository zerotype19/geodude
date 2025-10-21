/**
 * Global View Mode Toggle
 * 
 * Switches between Business (default) and Technical views
 */

import { useViewMode } from '../store/viewMode';

export default function ViewToggle() {
  const { mode, setMode } = useViewMode();

  return (
    <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      <button
        onClick={() => setMode('business')}
        className={`
          px-4 py-2 rounded-md text-sm font-medium transition-colors
          ${mode === 'business' 
            ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm' 
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
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
            ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm' 
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }
        `}
      >
        🔧 Technical
      </button>
    </div>
  );
}


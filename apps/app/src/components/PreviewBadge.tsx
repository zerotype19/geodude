/**
 * Preview Badge
 * 
 * Shown on shadow mode checks (A12, C1, G11, G12) while PHASE_NEXT_SCORING=false
 */

export default function PreviewBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
      bg-warn-soft text-warn dark:bg-amber-900/30 dark:text-amber-400
      ${className}
    `}>
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      Preview
    </span>
  );
}


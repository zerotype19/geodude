interface ScoreBadgeProps {
  score?: number;
  label: string;
  subtitle?: string; // Optional subtitle (e.g., "Raw: 0 (+8 from citations)")
  tooltip?: string; // Optional tooltip explanation
  icon: string; // A or G
  iconColor: string; // bg-brand or bg-success-soft0
  penalty?: number;
  penaltyReason?: string;
  showDelta?: boolean;
}

export default function ScoreBadge({ 
  score, 
  label,
  subtitle,
  tooltip,
  icon, 
  iconColor,
  penalty,
  penaltyReason,
  showDelta = false 
}: ScoreBadgeProps) {
  const getScoreColor = (score?: number) => {
    if (!score) return 'subtle';
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warn';
    return 'text-danger';
  };

  const displayScore = score ? Math.round(score) : 'N/A';
  const hasPenalty = penalty && penalty > 0;

  return (
    <div className="bg-surface-1 overflow-hidden shadow rounded-lg" title={tooltip}>
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`w-8 h-8 ${iconColor} rounded-full flex items-center justify-center`}>
              <span className="text-white font-bold text-sm">{icon}</span>
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium subtle truncate">{label}</dt>
              <dd className="flex items-baseline gap-2">
                <span className={`text-2xl font-semibold ${getScoreColor(score)}`}>
                  {displayScore}
                </span>
                {hasPenalty && (
                  <span className="text-xs text-danger font-medium" title={penaltyReason}>
                    (-{penalty})
                  </span>
                )}
              </dd>
              {subtitle && (
                <dd className="text-xs subtle mt-1">{subtitle}</dd>
              )}
            </dl>
          </div>
        </div>
        {tooltip && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs muted">{tooltip}</p>
            </div>
          </div>
        )}
        {hasPenalty && penaltyReason && !tooltip && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs muted">{penaltyReason}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


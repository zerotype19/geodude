interface ScoreBadgeProps {
  score?: number;
  label: string;
  icon: string; // A or G
  iconColor: string; // bg-blue-500 or bg-green-500
  penalty?: number;
  penaltyReason?: string;
  showDelta?: boolean;
}

export default function ScoreBadge({ 
  score, 
  label, 
  icon, 
  iconColor,
  penalty,
  penaltyReason,
  showDelta = false 
}: ScoreBadgeProps) {
  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-500';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const displayScore = score ? Math.round(score) : 'N/A';
  const hasPenalty = penalty && penalty > 0;

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`w-8 h-8 ${iconColor} rounded-full flex items-center justify-center`}>
              <span className="text-white font-bold text-sm">{icon}</span>
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{label}</dt>
              <dd className="flex items-baseline gap-2">
                <span className={`text-2xl font-semibold ${getScoreColor(score)}`}>
                  {displayScore}
                </span>
                {hasPenalty && (
                  <span className="text-xs text-red-600 font-medium" title={penaltyReason}>
                    (-{penalty})
                  </span>
                )}
              </dd>
            </dl>
          </div>
        </div>
        {hasPenalty && penaltyReason && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-gray-600">{penaltyReason}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


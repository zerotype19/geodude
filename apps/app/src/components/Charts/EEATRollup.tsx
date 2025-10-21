/**
 * E-E-A-T Rollup Visualization
 * 
 * Simple bar chart showing 5 E-E-A-T pillar scores (0-100)
 */

interface EEATRollupProps {
  data: Record<string, number>;
}

export default function EEATRollup({ data }: EEATRollupProps) {
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No E-E-A-T data available
      </div>
    );
  }

  // Color scale based on score
  const getColor = (score: number) => {
    if (score >= 80) return 'bg-purple-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-indigo-500';
    return 'bg-gray-500';
  };

  return (
    <div className="space-y-4">
      {entries.map(([pillar, score]) => (
        <div key={pillar} className="space-y-1">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {pillar}
            </span>
            <span className="text-gray-600 dark:text-gray-400 font-mono">
              {Math.round(score)}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getColor(score)}`}
              style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}


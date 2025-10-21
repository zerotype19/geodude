/**
 * Category Rollup Visualization
 * 
 * Simple bar chart showing 6 category scores (0-100)
 */

interface CategoryRollupProps {
  data: Record<string, number>;
}

export default function CategoryRollup({ data }: CategoryRollupProps) {
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No category data available
      </div>
    );
  }

  // Color scale based on score
  const getColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-4">
      {entries.map(([category, score]) => (
        <div key={category} className="space-y-1">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {category}
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


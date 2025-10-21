/**
 * Criteria Card for Score Guide
 * 
 * Displays individual criterion with metadata and references
 */

import { CriterionMeta } from '../../content/criteriaV2';
import PreviewBadge from '../PreviewBadge';

interface CriteriaCardProps {
  criterion: CriterionMeta;
}

export default function CriteriaCard({ criterion }: CriteriaCardProps) {
  const impactColors = {
    High: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    Low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {criterion.id}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${impactColors[criterion.impact]}`}>
              {criterion.impact}
            </span>
            {criterion.preview && <PreviewBadge />}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {criterion.title}
          </h3>
        </div>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          W{criterion.weight}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {criterion.description}
      </p>

      {/* Why It Matters */}
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 mb-3">
        <p className="text-sm font-medium text-purple-900 dark:text-purple-300">
          💡 {criterion.whyItMatters}
        </p>
      </div>

      {/* References */}
      {criterion.references && criterion.references.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Supported by:</span>
          {criterion.references.map((ref, idx) => (
            <a
              key={idx}
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
            >
              {ref.label} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}


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
    High: 'bg-red-100 text-red-800',
    Medium: 'bg-yellow-100 text-yellow-800',
    Low: 'bg-green-100 text-green-800'
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-gray-100 text-gray-700">
              {criterion.id}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${impactColors[criterion.impact]}`}>
              {criterion.impact}
            </span>
            {criterion.preview && <PreviewBadge />}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {criterion.title}
          </h3>
        </div>
        <span className="text-sm font-medium text-gray-500">
          W{criterion.weight}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-3">
        {criterion.description}
      </p>

      {/* Why It Matters */}
      <div className="bg-blue-50 rounded-lg p-3 mb-3 border border-blue-100">
        <p className="text-sm font-medium text-blue-900">
          💡 {criterion.whyItMatters}
        </p>
      </div>

      {/* References */}
      {criterion.references && criterion.references.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500">Supported by:</span>
          {criterion.references.map((ref, idx) => (
            <a
              key={idx}
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              {ref.label} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}


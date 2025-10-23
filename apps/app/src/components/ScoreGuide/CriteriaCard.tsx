/**
 * Criteria Card for Score Guide
 * 
 * Displays individual criterion with metadata and references
 * Expandable to show full D1 content (examples, how_to_fix, common_issues, etc.)
 */

import { useState } from 'react';
import type { CriterionMeta } from '../../content/criteriaV3';

interface CriteriaCardProps {
  criterion: CriterionMeta;
}

export default function CriteriaCard({ criterion }: CriteriaCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const impactColors = {
    High: 'bg-red-100 text-red-800 border-red-200',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Low: 'bg-blue-100 text-blue-800 border-blue-200'
  };

  const scopeColors = {
    page: 'bg-green-100 text-green-800',
    site: 'bg-purple-100 text-purple-800'
  };

  const checkTypeColors = {
    html_dom: 'bg-blue-50 text-blue-700 border-blue-200',
    http: 'bg-amber-50 text-amber-700 border-amber-200',
    aggregate: 'bg-green-50 text-green-700 border-green-200',
    llm: 'bg-purple-50 text-purple-700 border-purple-200'
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 transition-all overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-bold bg-gray-900 text-white">
                {criterion.id}
              </span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold border-2 ${impactColors[criterion.impact]}`}>
                {criterion.impact} Impact
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${scopeColors[criterion.scope]}`}>
                {criterion.scope}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${checkTypeColors[criterion.check_type]}`}>
                {criterion.check_type}
              </span>
              {criterion.preview && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                  Preview
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {criterion.title}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {criterion.description}
            </p>
          </div>
          <div className="ml-4 flex flex-col items-end gap-2">
            <span className="text-sm font-bold text-blue-600">
              Weight: {criterion.weight}
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Why it matters - Always visible */}
        {criterion.why_it_matters && !isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-sm text-blue-800 bg-blue-50 rounded p-3">
              💡 <strong>Why it matters:</strong> {criterion.why_it_matters}
            </p>
          </div>
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-4 border-t border-gray-200 bg-gray-50">
          {/* Why it matters */}
          {criterion.why_it_matters && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                <span>💡</span> Why This Matters
              </h4>
              <p className="text-sm text-blue-800 leading-relaxed">
                {criterion.why_it_matters}
              </p>
            </div>
          )}

          {/* How to fix */}
          {criterion.how_to_fix && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2">
                <span>🔧</span> How to Fix
              </h4>
              <p className="text-sm text-green-800 leading-relaxed whitespace-pre-line">
                {criterion.how_to_fix}
              </p>
            </div>
          )}

          {/* Examples */}
          {criterion.examples && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                <span>📝</span> Example
              </h4>
              <pre className="text-xs text-purple-800 bg-white rounded p-3 overflow-x-auto border border-purple-100">
                {criterion.examples}
              </pre>
            </div>
          )}

          {/* Common issues */}
          {criterion.common_issues && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                <span>⚠️</span> Common Issues
              </h4>
              <p className="text-sm text-red-800 leading-relaxed">
                {criterion.common_issues}
              </p>
            </div>
          )}

          {/* Quick fixes */}
          {criterion.quick_fixes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
                <span>⚡</span> Quick Fixes
              </h4>
              <p className="text-sm text-amber-800 leading-relaxed">
                {criterion.quick_fixes}
              </p>
            </div>
          )}

          {/* References & Docs */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-bold text-gray-900 mb-3">📚 Resources</h4>
            <div className="space-y-2">
              {criterion.official_docs && (
                <a
                  href={criterion.official_docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  📖 Official Documentation ↗
                </a>
              )}
              {criterion.references && criterion.references.length > 0 && (
                <div className="space-y-1">
                  {criterion.references.map((ref, idx) => (
                    <a
                      key={idx}
                      href={ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      🔗 {new URL(ref).hostname} ↗
                    </a>
                  ))}
                </div>
              )}
              {criterion.learn_more_links && (
                <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-200">
                  {criterion.learn_more_links}
                </p>
              )}
            </div>
          </div>

          {/* Technical Details */}
          <div className="bg-gray-100 rounded-lg p-4 text-xs text-gray-600 space-y-1">
            <div><strong>Scoring Approach:</strong> {criterion.scoring_approach || 'Automated analysis'}</div>
            <div><strong>Pass Threshold:</strong> {criterion.pass_threshold}% | <strong>Warn Threshold:</strong> {criterion.warn_threshold}%</div>
            <div><strong>Points Possible:</strong> {criterion.points_possible || 100}</div>
            {criterion.importance_rank && <div><strong>Priority Rank:</strong> #{criterion.importance_rank}</div>}
          </div>
        </div>
      )}
    </div>
  );
}


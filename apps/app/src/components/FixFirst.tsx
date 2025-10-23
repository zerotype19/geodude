import React, { useState } from 'react';
import CheckPill from './CheckPill';

interface FixItem {
  id: string;
  name: string;
  category: string;
  impact_level: 'High' | 'Medium' | 'Low';
  weight: number;
  score: number;
  why_it_matters?: string;
  how_to_fix?: string;
  examples?: string;
  quick_fixes?: string;
  common_issues?: string;
  official_docs?: string;
  learn_more_links?: string;
}

interface FixFirstProps {
  fixes: FixItem[];
}

const IMPACT_COLORS = {
  High: 'bg-red-100 text-red-800 border-red-300',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  Low: 'bg-blue-100 text-blue-800 border-blue-300'
};

const IMPACT_ICONS = {
  High: '🔴',
  Medium: '🟡',
  Low: '🔵'
};

export default function FixFirst({ fixes }: FixFirstProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedFixes, setExpandedFixes] = useState<Set<string>>(new Set());

  if (!fixes || fixes.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🎯</span>
          <h2 className="text-lg font-semibold text-gray-900">Fix First</h2>
        </div>
        <p className="text-sm text-gray-600">
          Great news! All checks are passing well. No critical fixes needed.
        </p>
      </div>
    );
  }

  // Group fixes by category
  const fixesByCategory = fixes.reduce((acc, fix) => {
    if (!acc[fix.category]) {
      acc[fix.category] = [];
    }
    acc[fix.category].push(fix);
    return acc;
  }, {} as Record<string, FixItem[]>);

  // Sort categories by total impact (High Impact items count first)
  const sortedCategories = Object.entries(fixesByCategory).sort(([, aFixes], [, bFixes]) => {
    const aHighCount = aFixes.filter(f => f.impact_level === 'High').length;
    const bHighCount = bFixes.filter(f => f.impact_level === 'High').length;
    if (aHighCount !== bHighCount) return bHighCount - aHighCount;
    return bFixes.length - aFixes.length;
  });

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleFix = (fixId: string) => {
    const newExpanded = new Set(expandedFixes);
    if (newExpanded.has(fixId)) {
      newExpanded.delete(fixId);
    } else {
      newExpanded.add(fixId);
    }
    setExpandedFixes(newExpanded);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🎯</span>
        <h2 className="text-lg font-semibold text-gray-900">Fix First</h2>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Top priority improvements organized by category
      </p>

      <div className="space-y-3">
        {sortedCategories.map(([category, categoryFixes]) => {
          const isExpanded = expandedCategories.has(category);
          const highCount = categoryFixes.filter(f => f.impact_level === 'High').length;
          const mediumCount = categoryFixes.filter(f => f.impact_level === 'Medium').length;
          const lowCount = categoryFixes.filter(f => f.impact_level === 'Low').length;

          return (
            <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-700 font-medium">{category}</span>
                  <span className="text-sm text-gray-500">
                    {categoryFixes.length} issue{categoryFixes.length !== 1 ? 's' : ''}
                  </span>
                  {highCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                      {highCount} High
                    </span>
                  )}
                  {mediumCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      {mediumCount} Medium
                    </span>
                  )}
                  {lowCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {lowCount} Low
                    </span>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Category Fixes (Collapsible) */}
              {isExpanded && (
                <div className="p-4 space-y-3 bg-white">
                  {categoryFixes.map((fix, index) => {
                    const isFixExpanded = expandedFixes.has(fix.id);
                    return (
                      <div
                        key={fix.id}
                        className="border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-all overflow-hidden"
                      >
                        {/* Fix Header */}
                        <button
                          onClick={() => toggleFix(fix.id)}
                          className="w-full p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            {/* Priority number within category */}
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm">
                              {index + 1}
                            </div>

                            <div className="flex-1 min-w-0 text-left">
                              {/* Check name and pill */}
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <CheckPill code={fix.id} score={fix.score} weight={fix.weight} />
                                <h3 className="text-sm font-bold text-gray-900">{fix.name}</h3>
                              </div>

                              {/* Impact and weight */}
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${IMPACT_COLORS[fix.impact_level]}`}>
                                  {IMPACT_ICONS[fix.impact_level]} {fix.impact_level} Impact
                                </span>
                                <span className="text-xs text-gray-500">
                                  Weight: {fix.weight} | Score: {Math.round(fix.score)}
                                </span>
                              </div>

                              {/* Why it matters - preview */}
                              {fix.why_it_matters && !isFixExpanded && (
                                <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                                  💡 {fix.why_it_matters}
                                </p>
                              )}
                            </div>

                            {/* Expand/Collapse Icon */}
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isFixExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {/* Expanded Fix Details */}
                        {isFixExpanded && (
                          <div className="px-4 pb-4 space-y-3 border-t border-gray-200 bg-gray-50">
                            {/* Why it matters */}
                            {fix.why_it_matters && (
                              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                <h4 className="font-bold text-blue-900 text-xs mb-1 flex items-center gap-1">
                                  <span>💡</span> Why This Matters
                                </h4>
                                <p className="text-xs text-blue-800 leading-relaxed">
                                  {fix.why_it_matters}
                                </p>
                              </div>
                            )}

                            {/* How to fix */}
                            {fix.how_to_fix && (
                              <div className="bg-green-50 border border-green-200 rounded p-3">
                                <h4 className="font-bold text-green-900 text-xs mb-1 flex items-center gap-1">
                                  <span>🔧</span> How to Fix
                                </h4>
                                <p className="text-xs text-green-800 leading-relaxed whitespace-pre-line">
                                  {fix.how_to_fix}
                                </p>
                              </div>
                            )}

                            {/* Quick fixes */}
                            {fix.quick_fixes && (
                              <div className="bg-amber-50 border border-amber-200 rounded p-3">
                                <h4 className="font-bold text-amber-900 text-xs mb-1 flex items-center gap-1">
                                  <span>⚡</span> Quick Fixes
                                </h4>
                                <p className="text-xs text-amber-800 leading-relaxed">
                                  {fix.quick_fixes}
                                </p>
                              </div>
                            )}

                            {/* Examples */}
                            {fix.examples && (
                              <div className="bg-purple-50 border border-purple-200 rounded p-3">
                                <h4 className="font-bold text-purple-900 text-xs mb-1 flex items-center gap-1">
                                  <span>📝</span> Example
                                </h4>
                                <pre className="text-xs text-purple-800 bg-white rounded p-2 overflow-x-auto border border-purple-100">
                                  {fix.examples}
                                </pre>
                              </div>
                            )}

                            {/* Common issues */}
                            {fix.common_issues && (
                              <div className="bg-red-50 border border-red-200 rounded p-3">
                                <h4 className="font-bold text-red-900 text-xs mb-1 flex items-center gap-1">
                                  <span>⚠️</span> Common Issues
                                </h4>
                                <p className="text-xs text-red-800 leading-relaxed">
                                  {fix.common_issues}
                                </p>
                              </div>
                            )}

                            {/* Official docs */}
                            {fix.official_docs && (
                              <div className="bg-white border border-gray-200 rounded p-3">
                                <h4 className="font-bold text-gray-900 text-xs mb-1">📚 Learn More</h4>
                                <a
                                  href={fix.official_docs}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  📖 Official Documentation ↗
                                </a>
                                {fix.learn_more_links && (
                                  <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
                                    {fix.learn_more_links}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          💡 <strong>Tip:</strong> Focus on High Impact items first for maximum improvement to your Optiview score.
        </p>
      </div>
    </div>
  );
}

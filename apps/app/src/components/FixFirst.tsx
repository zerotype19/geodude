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
                  {categoryFixes.map((fix, index) => (
                    <div
                      key={fix.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-3">
                        {/* Priority number within category */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm">
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Check name and pill */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <CheckPill code={fix.id} score={fix.score} weight={fix.weight} />
                            <h3 className="text-sm font-medium text-gray-900">{fix.name}</h3>
                          </div>

                          {/* Impact and weight */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${IMPACT_COLORS[fix.impact_level]}`}>
                              {IMPACT_ICONS[fix.impact_level]} {fix.impact_level} Impact
                            </span>
                            <span className="text-xs text-gray-500">
                              Weight: {fix.weight}
                            </span>
                          </div>

                          {/* Why it matters */}
                          {fix.why_it_matters && (
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {fix.why_it_matters}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
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

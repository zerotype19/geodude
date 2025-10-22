import React from 'react';
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🎯</span>
        <h2 className="text-lg font-semibold text-gray-900">Fix First</h2>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Top priority improvements ranked by impact × weight
      </p>

      <div className="space-y-3">
        {fixes.map((fix, index) => (
          <div
            key={fix.id}
            className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-3">
              {/* Priority number */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm">
                {index + 1}
              </div>

              <div className="flex-1 min-w-0">
                {/* Check name and pill */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <CheckPill code={fix.id} score={fix.score} weight={fix.weight} />
                  <h3 className="text-sm font-medium text-gray-900">{fix.name}</h3>
                </div>

                {/* Category and impact */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    {fix.category}
                  </span>
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

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          💡 <strong>Tip:</strong> Focus on High Impact items first for maximum improvement to your AEO/GEO scores.
        </p>
      </div>
    </div>
  );
}


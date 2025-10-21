import React from 'react';

interface FixFirstItem {
  id: string;
  name: string;
  category: string;
  impact_level: 'High' | 'Medium' | 'Low';
  weight: number;
  score: number;
}

interface FixFirstProps {
  fixes: FixFirstItem[];
  onClickFix?: (fixId: string) => void;
}

export default function FixFirst({ fixes, onClickFix }: FixFirstProps) {
  if (fixes.length === 0) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-200 rounded-lg p-6 mb-8">
        <div className="flex items-start gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Great news!</h2>
            <p className="text-sm text-gray-600 mt-1">
              No high-impact fixes needed. Tackle medium-impact items next to continue improving.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg p-6 mb-8">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl">🔴</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Fix First</h2>
          <p className="text-sm text-gray-600 mt-1">
            Top {fixes.length} priority items sorted by impact and weight
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {fixes.map((fix, index) => (
          <button
            key={fix.id}
            onClick={() => onClickFix?.(fix.id)}
            className="w-full text-left bg-white rounded-lg p-4 border border-gray-200 hover:border-red-400 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-700 text-sm font-bold flex items-center justify-center">
                {index + 1}
              </span>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 group-hover:text-red-700">
                    {fix.name}
                  </span>
                  <span className="text-xs text-gray-500">({fix.id})</span>
                  
                  {/* Impact Badge */}
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    fix.impact_level === 'High' ? 'bg-red-100 text-red-800' :
                    fix.impact_level === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {fix.impact_level}
                  </span>
                </div>
                
                <div className="text-xs text-gray-600">
                  <span className="font-medium">{fix.category}</span>
                  {' • '}
                  Weight: W{fix.weight}
                  {' • '}
                  Score: {fix.score}/3
                </div>
              </div>

              <span className="text-gray-400 group-hover:text-red-600 transition-colors">
                →
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}


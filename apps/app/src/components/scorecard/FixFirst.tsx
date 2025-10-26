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
      <div className="bg-gradient-to-r from-green-50 to-teal-50 border-2 border-success rounded-lg p-6 mb-8">
        <div className="flex items-start gap-3">
          <span className="text-2xl"></span>
          <div>
            <h2 className="text-xl font-bold ">Great news!</h2>
            <p className="text-sm muted mt-1">
              No high-impact fixes needed. Tackle medium-impact items next to continue improving.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-danger rounded-lg p-6 mb-8">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl"></span>
        <div>
          <h2 className="text-xl font-bold ">Fix First</h2>
          <p className="text-sm muted mt-1">
            Top {fixes.length} priority items sorted by impact and weight
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {fixes.map((fix, index) => (
          <button
            key={fix.id}
            onClick={() => onClickFix?.(fix.id)}
            className="w-full text-left bg-surface-1 rounded-lg p-4 border border-border hover:border-red-400 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-danger-soft text-danger text-sm font-bold flex items-center justify-center">
                {index + 1}
              </span>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold  group-hover:text-danger">
                    {fix.name}
                  </span>
                  <span className="text-xs subtle">({fix.id})</span>
                  
                  {/* Impact Badge */}
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    fix.impact_level === 'High' ? 'bg-danger-soft text-danger' :
                    fix.impact_level === 'Medium' ? 'bg-warn-soft text-warn' :
                    'bg-brand-soft text-brand'
                  }`}>
                    {fix.impact_level}
                  </span>
                </div>
                
                <div className="text-xs muted">
                  <span className="font-medium">{fix.category}</span>
                  {' • '}
                  Weight: W{fix.weight}
                  {' • '}
                  Score: {fix.score}/3
                </div>
              </div>

              <span className="subtle group-hover:text-danger transition-colors">
                →
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}


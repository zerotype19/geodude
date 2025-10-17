import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import tooltips from '../data/scoring-tooltips.json';

interface ScoringItemProps {
  code: string;
  score: number;
  weight: number;
  evidence?: any;
  showTooltip?: boolean;
}

const ScoringItem: React.FC<ScoringItemProps> = ({ 
  code, 
  score, 
  weight, 
  evidence, 
  showTooltip = true 
}) => {
  const [showTooltipContent, setShowTooltipContent] = useState(false);
  
  const tooltip = tooltips[code as keyof typeof tooltips];
  
  if (!tooltip) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
        <span className="font-medium">{code}</span>
        <span className="text-sm text-gray-500">No tooltip available</span>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score <= 1) return 'bg-red-100 text-red-800 border-red-200';
    if (score === 2) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getScoreLabel = (score: number) => {
    if (score <= 1) return 'Fix now';
    if (score === 2) return 'Improve';
    return 'Good';
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded hover:bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{code}</span>
            <span className="text-sm text-gray-500">({weight})</span>
          </div>
          <span className="text-sm text-gray-600">{tooltip.title}</span>
          {showTooltip && (
            <button
              onMouseEnter={() => setShowTooltipContent(true)}
              onMouseLeave={() => setShowTooltipContent(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Show tooltip"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-xs font-medium rounded border ${getScoreColor(score)}`}>
            {getScoreLabel(score)}
          </span>
          <span className="text-sm font-medium text-gray-900">{score}/3</span>
        </div>
      </div>

      {showTooltipContent && showTooltip && (
        <div className="absolute z-10 w-80 p-4 bg-white border border-gray-200 rounded-lg shadow-lg top-full left-0 mt-1">
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">{tooltip.title}</h4>
            <p className="text-sm text-gray-600">{tooltip.description}</p>
            <p className="text-sm text-blue-600">{tooltip.tooltip}</p>
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                <strong>How to win:</strong> {tooltip.howToWin}
              </p>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <Link 
                to="/score-guide" 
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Learn more →
              </Link>
            </div>
          </div>
        </div>
      )}

      {evidence && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
          <details className="cursor-pointer">
            <summary className="font-medium text-gray-700">Evidence</summary>
            <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap">
              {JSON.stringify(evidence, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default ScoringItem;

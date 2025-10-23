/**
 * Criteria Card for Score Guide
 * 
 * Clickable card that navigates to a dedicated detail page
 */

import { Link } from 'react-router-dom';
import type { CriterionMeta } from '../../content/criteriaV3';

interface CriteriaCardProps {
  criterion: CriterionMeta;
}

export default function CriteriaCard({ criterion }: CriteriaCardProps) {
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
    <Link 
      to={`/score-guide/${criterion.id}`}
      className="block bg-white rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all p-6 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
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
          <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
            {criterion.title}
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            {criterion.description}
          </p>
          
          {/* Why it matters preview */}
          {criterion.why_it_matters && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">💡 Why it matters:</span> {criterion.why_it_matters}
              </p>
            </div>
          )}
          
          {/* View details CTA */}
          <div className="flex items-center gap-2 text-sm font-medium text-blue-600 group-hover:text-blue-700">
            <span>View detailed guide</span>
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        
        <div className="ml-4 text-right">
          <div className="text-lg font-bold text-gray-900">
            W{criterion.weight}
          </div>
          <div className="text-xs text-gray-500">weight</div>
        </div>
      </div>
    </Link>
  );
}


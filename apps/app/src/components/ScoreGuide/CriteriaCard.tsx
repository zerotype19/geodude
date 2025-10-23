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
      className="block bg-white rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all p-6 group flex flex-col h-full"
    >
      {/* Title and description first - user-friendly */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors leading-tight">
            {criterion.title}
          </h3>
          <p className="text-base text-gray-700 leading-relaxed mb-4">
            {criterion.description}
          </p>
        </div>
        <div className="ml-4 flex-shrink-0">
          <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold border-2 ${impactColors[criterion.impact]}`}>
            {criterion.impact}
          </span>
        </div>
      </div>
      
      {/* Why it matters preview */}
      {criterion.why_it_matters && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-900 leading-relaxed">
            <span className="font-semibold">Why it matters:</span> {criterion.why_it_matters}
          </p>
        </div>
      )}
      
      {/* Spacer to push technical details to bottom */}
      <div className="flex-grow"></div>
      
      {/* Technical details at bottom - subtle and minimal */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {criterion.scope === 'page' ? 'Checked on each page' : 'Checked once per site'}
          </span>
        </div>
        
        {/* View details CTA */}
        <div className="flex items-center gap-2 text-sm font-medium text-blue-600 group-hover:text-blue-700">
          <span>Learn how to fix</span>
          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}


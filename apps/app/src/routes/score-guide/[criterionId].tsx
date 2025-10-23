/**
 * Score Guide - Criterion Detail Page
 * 
 * Full-page view of a single criterion with all D1 content
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import { CRITERIA_BY_ID } from '../../content/criteriaV3';

export default function CriterionDetail() {
  const { criterionId } = useParams<{ criterionId: string }>();
  const navigate = useNavigate();
  
  const criterion = criterionId ? CRITERIA_BY_ID.get(criterionId) : undefined;
  
  if (!criterion) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Criterion Not Found</h2>
            <p className="text-gray-600 mb-4">The criterion "{criterionId}" doesn't exist.</p>
            <Link to="/score-guide" className="text-blue-600 hover:text-blue-800 font-medium">
              ← Back to Score Guide
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
    html_dom: 'bg-blue-50 text-blue-700',
    http: 'bg-amber-50 text-amber-700',
    aggregate: 'bg-green-50 text-green-700',
    llm: 'bg-purple-50 text-purple-700'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors group"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Score Guide
        </button>

        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 p-10 mb-8">
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-mono font-bold bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-md">
              {criterion.id}
            </span>
            <span className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold shadow-sm ${impactColors[criterion.impact]}`}>
              {criterion.impact} Impact
            </span>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${scopeColors[criterion.scope]}`}>
              {criterion.scope}-level
            </span>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${checkTypeColors[criterion.check_type]}`}>
              {criterion.check_type}
            </span>
            {criterion.preview && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-amber-100 text-amber-800">
                Preview
              </span>
            )}
          </div>
          
          <h1 className="text-4xl font-black text-gray-900 mb-4 leading-tight">
            {criterion.title}
          </h1>
          
          <p className="text-xl text-gray-700 leading-relaxed mb-6">
            {criterion.description}
          </p>
          
          <div className="flex items-center gap-8 text-base font-medium text-gray-700 bg-gray-50 rounded-xl p-4">
            <div>
              <span className="text-gray-500">Weight:</span> <span className="text-gray-900 font-bold">{criterion.weight}</span>
            </div>
            <div>
              <span className="text-gray-500">Pass:</span> <span className="text-green-700 font-bold">{criterion.pass_threshold}%</span>
            </div>
            <div>
              <span className="text-gray-500">Warn:</span> <span className="text-yellow-700 font-bold">{criterion.warn_threshold}%</span>
            </div>
            <div>
              <span className="text-gray-500">Points:</span> <span className="text-gray-900 font-bold">{criterion.points_possible || 100}</span>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          {/* Why it matters */}
          {criterion.why_it_matters && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                Why This Matters
              </h2>
              <p className="text-base text-gray-700 leading-relaxed">
                {criterion.why_it_matters}
              </p>
            </div>
          )}

          {/* How to fix */}
          {criterion.how_to_fix && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                How to Fix
              </h2>
              <p className="text-base text-gray-700 leading-relaxed whitespace-pre-line">
                {criterion.how_to_fix}
              </p>
            </div>
          )}

          {/* Examples */}
          {criterion.examples && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                Example
              </h2>
              <pre className="text-sm text-gray-900 bg-gray-50 rounded p-4 border border-gray-200 font-mono leading-relaxed whitespace-pre-wrap break-words">
{criterion.examples}
              </pre>
            </div>
          )}

          {/* Quick fixes */}
          {criterion.quick_fixes && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                Quick Fixes
              </h2>
              <p className="text-base text-gray-700 leading-relaxed">
                {criterion.quick_fixes}
              </p>
            </div>
          )}

          {/* Common issues */}
          {criterion.common_issues && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                Common Issues
              </h2>
              <p className="text-base text-gray-700 leading-relaxed">
                {criterion.common_issues}
              </p>
            </div>
          )}

          {/* Resources */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Resources
            </h2>
            <div className="space-y-3">
              {criterion.official_docs && (
                <a
                  href={criterion.official_docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-base text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Official Documentation →
                </a>
              )}
              {criterion.references && criterion.references.length > 0 && (
                <div className="space-y-2">
                  {criterion.references.map((ref, idx) => (
                    <a
                      key={idx}
                      href={ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {new URL(ref).hostname} →
                    </a>
                  ))}
                </div>
              )}
              {criterion.learn_more_links && (
                <p className="text-base text-gray-700 pt-3 border-t border-gray-200 leading-relaxed mt-3">
                  {criterion.learn_more_links}
                </p>
              )}
            </div>
          </div>

          {/* Technical Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Technical Details
            </h2>
            <dl className="grid grid-cols-2 gap-6 text-base">
              <div className="bg-gray-50 rounded-xl p-4">
                <dt className="font-bold text-gray-700 mb-1">Scoring Approach</dt>
                <dd className="text-gray-900">{criterion.scoring_approach || 'Automated analysis'}</dd>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <dt className="font-bold text-gray-700 mb-1">Check Type</dt>
                <dd className="text-gray-900">{criterion.check_type}</dd>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <dt className="font-bold text-gray-700 mb-1">Scope</dt>
                <dd className="text-gray-900">{criterion.scope}-level</dd>
              </div>
              {criterion.importance_rank && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <dt className="font-bold text-gray-700 mb-1">Priority Rank</dt>
                  <dd className="text-gray-900">#{criterion.importance_rank}</dd>
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-4">
                <dt className="font-bold text-gray-700 mb-1">Category</dt>
                <dd className="text-gray-900">{criterion.category}</dd>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <dt className="font-bold text-gray-700 mb-1">Weight</dt>
                <dd className="text-gray-900 text-xl font-bold">{criterion.weight}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Back to top */}
        <div className="mt-10 pt-8 border-t-2 border-gray-300 text-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Score Guide
          </button>
        </div>
      </div>
    </div>
  );
}


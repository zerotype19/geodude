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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Score Guide
        </button>

        {/* Header Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-6">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="inline-flex items-center px-3 py-1.5 rounded text-sm font-mono font-bold bg-gray-900 text-white">
              {criterion.id}
            </span>
            <span className={`inline-flex items-center px-3 py-1.5 rounded text-sm font-bold border-2 ${impactColors[criterion.impact]}`}>
              {criterion.impact} Impact
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium ${scopeColors[criterion.scope]}`}>
              {criterion.scope}-level
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium ${checkTypeColors[criterion.check_type]}`}>
              {criterion.check_type}
            </span>
            {criterion.preview && (
              <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-amber-100 text-amber-800">
                Preview
              </span>
            )}
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            {criterion.title}
          </h1>
          
          <p className="text-lg text-gray-700 leading-relaxed mb-4">
            {criterion.description}
          </p>
          
          <div className="flex items-center gap-6 text-sm text-gray-600 border-t border-gray-200 pt-4">
            <div>
              <span className="font-semibold">Weight:</span> {criterion.weight}
            </div>
            <div>
              <span className="font-semibold">Pass:</span> {criterion.pass_threshold}%
            </div>
            <div>
              <span className="font-semibold">Warn:</span> {criterion.warn_threshold}%
            </div>
            <div>
              <span className="font-semibold">Points:</span> {criterion.points_possible || 100}
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          {/* Why it matters */}
          {criterion.why_it_matters && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">💡</span> Why This Matters
              </h2>
              <p className="text-base text-gray-700 leading-relaxed">
                {criterion.why_it_matters}
              </p>
            </div>
          )}

          {/* How to fix */}
          {criterion.how_to_fix && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">🔧</span> How to Fix
              </h2>
              <p className="text-base text-gray-700 leading-relaxed whitespace-pre-line">
                {criterion.how_to_fix}
              </p>
            </div>
          )}

          {/* Examples */}
          {criterion.examples && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">📝</span> Example
              </h2>
              <pre className="text-sm text-gray-800 bg-gray-50 rounded-lg p-4 overflow-x-auto border border-gray-200 font-mono">
                {criterion.examples}
              </pre>
            </div>
          )}

          {/* Quick fixes */}
          {criterion.quick_fixes && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">⚡</span> Quick Fixes
              </h2>
              <p className="text-base text-gray-700 leading-relaxed">
                {criterion.quick_fixes}
              </p>
            </div>
          )}

          {/* Common issues */}
          {criterion.common_issues && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">⚠️</span> Common Issues
              </h2>
              <p className="text-base text-gray-700 leading-relaxed">
                {criterion.common_issues}
              </p>
            </div>
          )}

          {/* Resources */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">📚</span> Resources
            </h2>
            <div className="space-y-3">
              {criterion.official_docs && (
                <a
                  href={criterion.official_docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-base text-blue-600 hover:text-blue-800 hover:underline"
                >
                  📖 Official Documentation ↗
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
                      className="block text-base text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      🔗 {new URL(ref).hostname} ↗
                    </a>
                  ))}
                </div>
              )}
              {criterion.learn_more_links && (
                <p className="text-base text-gray-600 pt-3 border-t border-gray-200">
                  {criterion.learn_more_links}
                </p>
              )}
            </div>
          </div>

          {/* Technical Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Technical Details</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-semibold text-gray-700">Scoring Approach</dt>
                <dd className="text-gray-600">{criterion.scoring_approach || 'Automated analysis'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-700">Check Type</dt>
                <dd className="text-gray-600">{criterion.check_type}</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-700">Scope</dt>
                <dd className="text-gray-600">{criterion.scope}-level</dd>
              </div>
              {criterion.importance_rank && (
                <div>
                  <dt className="font-semibold text-gray-700">Priority Rank</dt>
                  <dd className="text-gray-600">#{criterion.importance_rank}</dd>
                </div>
              )}
              <div>
                <dt className="font-semibold text-gray-700">Category</dt>
                <dd className="text-gray-600">{criterion.category}</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-700">Weight</dt>
                <dd className="text-gray-600">{criterion.weight}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Back to top */}
        <div className="mt-8 pt-8 border-t border-gray-200 text-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Score Guide
          </button>
        </div>
      </div>
    </div>
  );
}


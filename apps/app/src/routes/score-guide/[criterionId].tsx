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
      <div className="min-h-screen bg-surface-2 py-8">
        <div className="page-max container-px">
          <div className="card card-body text-center">
            <h2 className="text-2xl font-bold mb-2">Criterion Not Found</h2>
            <p className="muted mb-4">The criterion "{criterionId}" doesn't exist.</p>
            <Link to="/score-guide" className="text-brand hover:underline font-medium">
              ← Back to Score Guide
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const impactColors = {
    High: 'pill pill-danger',
    Medium: 'pill pill-warn',
    Low: 'pill pill-success'
  };

  const scopeColors = {
    page: 'pill pill-success',
    site: 'pill pill-brand'
  };

  const checkTypeColors = {
    html_dom: 'pill pill-brand',
    http: 'pill pill-warn',
    aggregate: 'pill pill-success',
    llm: 'pill pill-brand'
  };

  return (
    <div className="min-h-screen bg-surface-2 py-12">
      <div className="page-max container-px">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-8 inline-flex items-center gap-2 text-brand hover:underline font-semibold transition-colors group"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Score Guide
        </button>

        {/* Header Card */}
        <div className="card card-body mb-8">
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <span className="tag bg-gray-900 text-white font-mono font-bold">
              {criterion.id}
            </span>
            <span className={impactColors[criterion.impact]}>
              {criterion.impact} Impact
            </span>
            <span className={scopeColors[criterion.scope]}>
              {criterion.scope}-level
            </span>
            <span className={checkTypeColors[criterion.check_type]}>
              {criterion.check_type}
            </span>
            {criterion.preview && (
              <span className="pill pill-warn">
                Preview
              </span>
            )}
          </div>
          
          <h1 className="text-4xl font-black  mb-4 leading-tight">
            {criterion.title}
          </h1>
          
          <p className="text-xl muted leading-relaxed mb-6">
            {criterion.description}
          </p>
          
          <div className="flex items-center gap-8 text-base font-medium muted card-muted rounded-xl p-4">
            <div>
              <span className="subtle">Weight:</span> <span className="font-bold">{criterion.weight}</span>
            </div>
            <div>
              <span className="subtle">Pass:</span> <span className="text-success font-bold">{criterion.pass_threshold}%</span>
            </div>
            <div>
              <span className="subtle">Warn:</span> <span className="text-warn font-bold">{criterion.warn_threshold}%</span>
            </div>
            <div>
              <span className="subtle">Points:</span> <span className="font-bold">{criterion.points_possible || 100}</span>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          {/* Why it matters */}
          {criterion.why_it_matters && (
            <div className="card card-body">
              <h2 className="section-title mb-3">
                Why This Matters
              </h2>
              <p className="text-base muted leading-relaxed">
                {criterion.why_it_matters}
              </p>
            </div>
          )}

          {/* How to fix */}
          {criterion.how_to_fix && (
            <div className="card card-body">
              <h2 className="section-title mb-3">
                How to Fix
              </h2>
              <p className="text-base muted leading-relaxed whitespace-pre-line">
                {criterion.how_to_fix}
              </p>
            </div>
          )}

          {/* Examples */}
          {criterion.examples && (
            <div className="card card-body">
              <h2 className="section-title mb-3">
                Example
              </h2>
              <pre className="text-sm card-muted rounded-xl p-4 border border-border font-mono leading-relaxed whitespace-pre-wrap break-words">
{criterion.examples}
              </pre>
            </div>
          )}

          {/* Quick fixes */}
          {criterion.quick_fixes && (
            <div className="card card-body">
              <h2 className="section-title mb-3">
                Quick Fixes
              </h2>
              <p className="text-base muted leading-relaxed">
                {criterion.quick_fixes}
              </p>
            </div>
          )}

          {/* Common issues */}
          {criterion.common_issues && (
            <div className="card card-body">
              <h2 className="section-title mb-3">
                Common Issues
              </h2>
              <p className="text-base muted leading-relaxed">
                {criterion.common_issues}
              </p>
            </div>
          )}

          {/* Resources */}
          <div className="card card-body">
            <h2 className="section-title mb-4">
              Resources
            </h2>
            <div className="space-y-3">
              {criterion.official_docs && (
                <a
                  href={criterion.official_docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-base text-brand hover:underline"
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
                      className="block text-sm text-brand hover:underline"
                    >
                      {new URL(ref).hostname} →
                    </a>
                  ))}
                </div>
              )}
              {criterion.learn_more_links && (
                <p className="text-base muted pt-3 border-t border-border leading-relaxed mt-3">
                  {criterion.learn_more_links}
                </p>
              )}
            </div>
          </div>

          {/* Technical Details */}
          <div className="card card-body">
            <h2 className="section-title mb-4">
              Technical Details
            </h2>
            <dl className="grid grid-cols-2 gap-6 text-base">
              <div className="card-muted rounded-xl p-4">
                <dt className="font-bold muted mb-1">Scoring Approach</dt>
                <dd>{criterion.scoring_approach || 'Automated analysis'}</dd>
              </div>
              <div className="card-muted rounded-xl p-4">
                <dt className="font-bold muted mb-1">Check Type</dt>
                <dd>{criterion.check_type}</dd>
              </div>
              <div className="card-muted rounded-xl p-4">
                <dt className="font-bold muted mb-1">Scope</dt>
                <dd>{criterion.scope}-level</dd>
              </div>
              {criterion.importance_rank && (
                <div className="card-muted rounded-xl p-4">
                  <dt className="font-bold muted mb-1">Priority Rank</dt>
                  <dd>#{criterion.importance_rank}</dd>
                </div>
              )}
              <div className="card-muted rounded-xl p-4">
                <dt className="font-bold muted mb-1">Category</dt>
                <dd>{criterion.category}</dd>
              </div>
              <div className="card-muted rounded-xl p-4">
                <dt className="font-bold muted mb-1">Weight</dt>
                <dd className="text-xl font-bold">{criterion.weight}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Back to top */}
        <div className="mt-10 pt-8 border-t border-border text-center">
          <button
            onClick={() => navigate(-1)}
            className="btn-primary"
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


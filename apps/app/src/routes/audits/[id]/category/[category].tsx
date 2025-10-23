import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet } from '/src/lib/api';
import { CRITERIA_BY_ID, CATEGORY_ORDER, getCriteriaForCategory } from '/src/content/criteriaV3';
import type { Category } from '/src/content/criteriaV3';

interface CategoryScore {
  category: string;
  score: number;
  weight_total: number;
  checks_count: number;
}

interface CheckResult {
  id: string;
  score: number;
  status: 'ok' | 'warn' | 'fail' | 'error' | 'not_applicable';
  details: Record<string, any>;
  evidence?: string[];
  scope: 'page' | 'site';
  preview?: boolean;
  impact?: 'High' | 'Medium' | 'Low';
}

interface Page {
  id: string;
  url: string;
  status_code: number;
  checks_json?: string;
}

interface Audit {
  id: string;
  root_url: string;
  category_scores?: CategoryScore[];
}

// Category descriptions (no emojis for professional look)

// Category descriptions (from D1 scoring guide)
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Content & Clarity': 'Clear, complete answers that assistants can quote.',
  'Structure & Organization': 'Pages and links arranged so people and parsers "get it."',
  'Authority & Trust': 'Visible expertise and evidence to earn citations.',
  'Technical Foundations': 'Schema and semantics that explain meaning to machines.',
  'Crawl & Discoverability': 'Make sure crawlers and AIs can reach and render it.',
  'Experience & Performance': 'Fast, readable, accessible everywhere.'
};

export default function CategoryDetail() {
  const { id, category } = useParams<{ id: string; category: string }>();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  // Convert slug back to category name
  const SLUG_TO_CATEGORY: Record<string, string> = {
    'content-clarity': 'Content & Clarity',
    'structure-organization': 'Structure & Organization',
    'authority-trust': 'Authority & Trust',
    'technical-foundations': 'Technical Foundations',
    'crawl-discoverability': 'Crawl & Discoverability',
    'experience-performance': 'Experience & Performance'
  };

  const categoryName = (SLUG_TO_CATEGORY[category || ''] || '') as Category;
  const categorySlug = category || '';

  const description = CATEGORY_DESCRIPTIONS[categoryName] || '';

  // Get checks for this category from D1 criteria
  const checksInCategory = getCriteriaForCategory(categoryName);
  // Filter to only page-level checks for the breakdown
  const pageChecksInCategory = checksInCategory.filter(c => c.scope === 'page');

  // Find the category score
  const categoryScore = audit?.category_scores?.find(cs => cs.category === categoryName);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      const [auditData, pagesData] = await Promise.all([
        apiGet<Audit>(`/api/audits/${id}`),
        apiGet<{ pages: Page[] }>(`/api/audits/${id}/pages?limit=200`)
      ]);
      setAudit(auditData);
      setPages(pagesData.pages || []);
    } catch (error) {
      console.error('Failed to fetch category data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate category breakdown by check (using 0-100 scale)
  const getCheckBreakdown = () => {
    return pageChecksInCategory.map(check => {
      let totalScore = 0;
      let count = 0;
      let passingPages = 0;
      let failingPages = 0;

      pages.forEach(page => {
        if (page.checks_json) {
          try {
            const checks = JSON.parse(page.checks_json) as CheckResult[];
            const checkResult = checks.find(c => c.id === check.id);
            if (checkResult && !checkResult.preview) {
              totalScore += checkResult.score;
              count++;
              // Using 0-100 scale: >= 60 is passing
              if (checkResult.score >= 60) {
                passingPages++;
              } else {
                failingPages++;
              }
            }
          } catch (e) {
            console.error('Error parsing checks_json:', e);
          }
        }
      });

      const avgScore = count > 0 ? totalScore / count : 0;

      return {
        check,
        avgScore,
        passingPages,
        failingPages,
        totalPages: count
      };
    });
  };

  // Get pages that have issues in this category (score < 60)
  const getPagesWithIssues = () => {
    return pages
      .map(page => {
        if (!page.checks_json) return null;
        try {
          const checks = JSON.parse(page.checks_json) as CheckResult[];
          const failingChecks = checks.filter(check => 
            pageChecksInCategory.some(c => c.id === check.id) && 
            check.score < 60 &&
            !check.preview
          );
          
          if (failingChecks.length === 0) return null;
          
          return {
            ...page,
            failingChecks
          };
        } catch {
          return null;
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  };

  const checkBreakdown = getCheckBreakdown();
  const pagesWithIssues = getPagesWithIssues();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-2 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-surface-3 rounded w-1/3"></div>
            <div className="h-64 bg-surface-3 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-success bg-success-soft border-success';
    if (score >= 60) return 'text-warn bg-warn-soft border-warn';
    if (score >= 40) return 'text-orange-600 bg-warn-soft border-warn';
    return 'text-danger bg-danger-soft border-danger';
  };

  const getCheckScoreColor = (score: number) => {
    if (score >= 85) return 'text-success';
    if (score >= 60) return 'text-warn';
    if (score >= 40) return 'text-orange-600';
    return 'text-danger';
  };

  const getStatusBadge = (score: number) => {
    if (score >= 85) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-success-soft text-success">
          Excellent
        </span>
      );
    } else if (score >= 60) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-warn-soft text-warn">
          Good
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-danger-soft text-danger">
          Needs Work
        </span>
      );
    }
  };

  return (
    <div className="min-h-screen bg-surface-2 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link 
            to={`/audits/${id}`} 
            className="text-brand hover:text-brand text-sm font-medium"
          >
            ← Back to Audit Overview
          </Link>
        </div>

        {/* Category Header */}
        <div className="bg-surface-1 rounded-lg border border-border p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold  mb-2">{categoryName}</h1>
              <p className="muted mb-3">{description}</p>
              <div className="text-sm subtle mb-4">
                {audit?.root_url && (
                  <span>
                    Analyzing: <span className="font-medium muted">{audit.root_url}</span>
                  </span>
                )}
              </div>
              
              {/* Learn More Link */}
              <Link
                to={`/score-guide#${categorySlug}`}
                className="text-sm text-brand hover:text-brand font-medium"
              >
                Learn how to fix these issues →
              </Link>
            </div>
            {categoryScore && (
              <div className={`px-6 py-3 rounded-lg border ${getScoreColor(categoryScore.score)} font-bold text-3xl`}>
                {Math.round(categoryScore.score)}
              </div>
            )}
          </div>
        </div>

        {/* How to Improve - Show quick guidance from failing checks */}
        {pagesWithIssues.length > 0 && checksInCategory.some(c => c.how_to_fix) && (
          <div className="bg-surface-1 rounded-lg border border-border p-6 mb-8">
            <h2 className="text-lg font-bold  mb-4">
              How to Improve This Category
            </h2>
            <div className="space-y-4">
              {checksInCategory
                .filter(check => check.scope === 'page' && check.how_to_fix)
                .slice(0, 3)
                .map(check => (
                  <div key={check.id} className="bg-surface-1 rounded-lg border border-blue-200 p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🔧</span>
                      <div className="flex-1">
                        <h3 className="font-bold  mb-1">{check.title}</h3>
                        <p className="text-sm muted mb-2">{check.why_it_matters}</p>
                        <div className="bg-success-soft border border-success rounded p-3 text-sm text-green-900">
                          <strong className="block mb-1">How to fix:</strong>
                          <p className="whitespace-pre-line">{check.how_to_fix}</p>
                        </div>
                        {check.quick_fixes && (
                          <div className="mt-2 bg-surface-2 border border-border rounded p-3 text-sm muted">
                            <strong className="block mb-1 ">Quick fixes:</strong>
                            <p>{check.quick_fixes}</p>
                          </div>
                        )}
                        {check.official_docs && (
                          <a
                            href={check.official_docs}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 text-sm text-brand hover:text-brand font-medium"
                          >
                            Official Docs →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Check Breakdown */}
        <div className="bg-surface-1 rounded-lg border border-border p-6 mb-8">
          <h2 className="text-lg font-semibold  mb-4">
            Category Score Breakdown
          </h2>
          <p className="text-sm muted mb-4">
            Performance on each check within this category (0-100 scale)
          </p>
          <div className="space-y-3">
            {checkBreakdown.length === 0 ? (
              <p className="subtle text-sm">No page-level checks defined for this category.</p>
            ) : (
              checkBreakdown.map(({ check, avgScore, passingPages, failingPages, totalPages }) => (
                <div 
                  key={check.id} 
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-surface-2"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono subtle bg-surface-2 px-2 py-1 rounded">
                        {check.id}
                      </span>
                      <h3 className="font-medium ">{check.title}</h3>
                      {getStatusBadge(avgScore)}
                    </div>
                    <p className="text-sm muted mb-2">{check.description}</p>
                    <div className="flex items-center gap-4 text-xs muted">
                      <span>
                        <span className="font-semibold text-success">{passingPages}</span> passing
                      </span>
                      <span>
                        <span className="font-semibold text-danger">{failingPages}</span> failing
                      </span>
                      <span className="subtle">
                        of {totalPages} pages
                      </span>
                    </div>
                    {check.why_it_matters && (
                      <div className="mt-2 text-xs subtle border-l-2 border-blue-200 pl-3">
                        <strong>Why it matters:</strong> {check.why_it_matters}
                      </div>
                    )}
                  </div>
                  <div className="ml-4 text-right">
                    <div className={`text-2xl font-bold ${getCheckScoreColor(avgScore)}`}>
                      {Math.round(avgScore)}
                    </div>
                    <div className="text-xs subtle">avg score</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pages with Issues */}
        <div className="bg-surface-1 rounded-lg border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold ">
              Impacted Pages ({pagesWithIssues.length})
            </h2>
            <p className="text-sm muted">
              Pages scoring below 60 on checks in this category
            </p>
          </div>
          
          {pagesWithIssues.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className=" font-medium mb-1">All pages passing!</p>
              <p className="subtle text-sm">No issues found in this category</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="ui">
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Failing Checks</th>
                    <th>Avg Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagesWithIssues.map((page) => {
                    const avgPageScore = page.failingChecks.length > 0
                      ? Math.round(page.failingChecks.reduce((sum, c) => sum + c.score, 0) / page.failingChecks.length)
                      : 0;
                    
                    return (
                      <tr key={page.id} className="hover:bg-surface-2">
                        <td className="px-6 py-4 text-sm  max-w-md">
                          <a 
                            href={page.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="hover:text-brand break-all"
                          >
                            {page.url}
                          </a>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {page.failingChecks.slice(0, 5).map((check) => (
                              <span 
                                key={check.id}
                                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-danger-soft text-danger"
                                title={CRITERIA_BY_ID.get(check.id)?.title || check.id}
                              >
                                {check.id}
                              </span>
                            ))}
                            {page.failingChecks.length > 5 && (
                              <span className="text-xs subtle">
                                +{page.failingChecks.length - 5} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`font-semibold ${getCheckScoreColor(avgPageScore)}`}>
                            {avgPageScore}
                          </span>
                          <span className="subtle text-xs ml-1">
                            ({page.failingChecks.length} issue{page.failingChecks.length !== 1 ? 's' : ''})
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            to={`/audits/${id}/pages/${page.id}`}
                            className="text-brand hover:text-brand"
                          >
                            View Details →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

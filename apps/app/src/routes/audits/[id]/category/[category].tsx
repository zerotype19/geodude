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

        {/* Criteria in this Category */}
        <div className="card card-body mb-8">
          <h2 className="section-title mb-2">
            Criteria in This Category
          </h2>
          <p className="text-sm muted mb-4">
            Click any criterion to learn more about it and how to optimize
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {checksInCategory.map(check => {
              const breakdown = checkBreakdown.find(b => b.check.id === check.id);
              const avgScore = breakdown?.avgScore || 0;
              
              return (
                <Link
                  key={check.id}
                  to={`/score-guide/${check.id}`}
                  className="card card-body hover:shadow-xl transition-all group flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-sm mb-1 group-hover:text-brand transition-colors">
                        {check.title}
                      </h3>
                      <p className="text-xs muted line-clamp-2">
                        {check.why_it_matters}
                      </p>
                    </div>
                    {breakdown && (
                      <div className="ml-3 text-right flex-shrink-0">
                        <div className={`text-xl font-bold ${getCheckScoreColor(avgScore)}`}>
                          {Math.round(avgScore)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs flex-wrap mt-auto">
                    <span className="tag">{check.id}</span>
                    {check.scope === 'page' ? (
                      <span className="pill pill-brand">Page-Level</span>
                    ) : (
                      <span className="pill pill-success">Site-Level</span>
                    )}
                    {check.impact_level && (
                      <span className={`pill ${
                        check.impact_level === 'High' ? 'pill-danger' : 
                        check.impact_level === 'Medium' ? 'pill-warn' : 
                        'pill-success'
                      }`}>
                        {check.impact_level}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Score Breakdown Table */}
        <div className="card card-body mb-8">
          <h2 className="section-title mb-2">
            Score Breakdown by Criterion
          </h2>
          <p className="text-sm muted mb-4">
            Average performance across all pages for each criterion (0-100 scale)
          </p>
          {checkBreakdown.length === 0 ? (
            <p className="subtle text-sm">No page-level checks defined for this category.</p>
          ) : (
            <div className="table-wrap">
              <table className="ui">
                <thead>
                  <tr>
                    <th>Criterion</th>
                    <th className="text-center">Avg Score</th>
                    <th className="text-center">Passing</th>
                    <th className="text-center">Failing</th>
                    <th className="text-right">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {checkBreakdown
                    .sort((a, b) => a.avgScore - b.avgScore) // Worst first
                    .map(({ check, avgScore, passingPages, failingPages, totalPages }) => (
                      <tr key={check.id}>
                        <td>
                          <Link 
                            to={`/score-guide/${check.id}`}
                            className="flex flex-col hover:text-brand"
                          >
                            <span className="font-medium">{check.title}</span>
                            <span className="tag">{check.id}</span>
                          </Link>
                        </td>
                        <td className="text-center">
                          <div className="flex flex-col items-center">
                            <span className={`text-2xl font-bold ${getCheckScoreColor(avgScore)}`}>
                              {Math.round(avgScore)}
                            </span>
                            {getStatusBadge(avgScore)}
                          </div>
                        </td>
                        <td className="text-center">
                          <span className="text-success font-semibold">{passingPages}</span>
                          <span className="text-xs subtle ml-1">pages</span>
                        </td>
                        <td className="text-center">
                          <span className="text-danger font-semibold">{failingPages}</span>
                          <span className="text-xs subtle ml-1">pages</span>
                        </td>
                        <td className="text-right">
                          <span className={`pill ${
                            check.impact_level === 'High' ? 'pill-danger' : 
                            check.impact_level === 'Medium' ? 'pill-warn' : 
                            'pill-success'
                          }`}>
                            {check.impact_level || 'Medium'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Impacted Pages */}
        <div className="card">
          <div className="card-header">
            <h2 className="section-title">
              Impacted Pages ({pagesWithIssues.length})
            </h2>
            <p className="text-sm muted mt-1">
              Pages with at least one criterion scoring below 60
            </p>
          </div>
          
          {pagesWithIssues.length === 0 ? (
            <div className="card-body text-center py-12">
              <div className="text-4xl mb-2">🎉</div>
              <p className="font-medium mb-1">All pages passing!</p>
              <p className="subtle text-sm">No issues found in this category</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="ui">
                <thead>
                  <tr>
                    <th>Page URL</th>
                    <th className="text-center">Issues</th>
                    <th className="text-center">Avg Score</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagesWithIssues.map((page) => {
                    const avgPageScore = page.failingChecks.length > 0
                      ? Math.round(page.failingChecks.reduce((sum, c) => sum + c.score, 0) / page.failingChecks.length)
                      : 0;
                    
                    return (
                      <tr key={page.id}>
                        <td className="max-w-md">
                          <a 
                            href={page.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-brand hover:underline break-all text-sm"
                          >
                            {page.url}
                          </a>
                        </td>
                        <td className="text-center">
                          <span className="text-danger font-semibold text-lg">
                            {page.failingChecks.length}
                          </span>
                          <span className="text-xs subtle ml-1">failing</span>
                        </td>
                        <td className="text-center">
                          <span className={`text-lg font-bold ${getCheckScoreColor(avgPageScore)}`}>
                            {avgPageScore}
                          </span>
                        </td>
                        <td className="text-right">
                          <Link
                            to={`/audits/${id}/pages/${page.id}`}
                            className="btn-ghost"
                          >
                            View Page Details →
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

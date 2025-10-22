import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet } from '/src/lib/api';
import CheckPill from '/src/components/CheckPill';
import { CRITERIA_BY_CATEGORY } from '/src/content/criteriaV2';

interface CategoryScore {
  category: string;
  score: number;
  weight_total: number;
  checks_count: number;
}

interface CheckResult {
  id: string;
  score: number;
  weight: number;
  evidence: {
    found: boolean;
    details: string;
    snippets?: string[];
  };
}

interface Page {
  id: string;
  url: string;
  status_code: number;
  aeo_score?: number;
  geo_score?: number;
  checks_json?: string;
}

interface Audit {
  id: string;
  root_url: string;
  category_scores?: CategoryScore[];
}

// Category emoji map
const CATEGORY_EMOJIS: Record<string, string> = {
  'Content & Clarity': '📝',
  'Structure & Organization': '🏗️',
  'Authority & Trust': '🛡️',
  'Technical Foundations': '⚙️',
  'Crawl & Discoverability': '🔍',
  'Experience & Performance': '⚡'
};

// Category descriptions
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

  const categoryName = SLUG_TO_CATEGORY[category || ''] || '';
  const categorySlug = category || '';

  const emoji = CATEGORY_EMOJIS[categoryName] || '📊';
  const description = CATEGORY_DESCRIPTIONS[categoryName] || '';

  // Get checks for this category
  const checksInCategory = CRITERIA_BY_CATEGORY[categoryName as keyof typeof CRITERIA_BY_CATEGORY] || [];

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
        apiGet<{ pages: Page[] }>(`/api/audits/${id}/pages`)
      ]);
      setAudit(auditData);
      setPages(pagesData.pages || []);
    } catch (error) {
      console.error('Failed to fetch category data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate category breakdown by check
  const getCheckBreakdown = () => {
    return checksInCategory.map(check => {
      let totalScore = 0;
      let count = 0;
      let passingPages = 0;
      let failingPages = 0;

      pages.forEach(page => {
        if (page.checks_json) {
          try {
            const checks = JSON.parse(page.checks_json) as CheckResult[];
            const checkResult = checks.find(c => c.id === check.id);
            if (checkResult) {
              totalScore += checkResult.score;
              count++;
              if (checkResult.score >= 2) {
                passingPages++;
              } else {
                failingPages++;
              }
            }
          } catch {}
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

  // Get pages that have issues in this category
  const getPagesWithIssues = () => {
    return pages
      .map(page => {
        if (!page.checks_json) return null;
        try {
          const checks = JSON.parse(page.checks_json) as CheckResult[];
          const failingChecks = checks.filter(check => 
            checksInCategory.some(c => c.id === check.id) && check.score < 3
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
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (score >= 40) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getCheckScoreColor = (score: number) => {
    if (score >= 2.5) return 'text-green-600';
    if (score >= 1.5) return 'text-yellow-600';
    if (score >= 0.5) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link 
            to={`/audits/${id}`} 
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to Audit Overview
          </Link>
        </div>

        {/* Category Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4 flex-1">
              <span className="text-4xl">{emoji}</span>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{categoryName}</h1>
                <p className="text-gray-600 mb-3">{description}</p>
                <div className="text-sm text-gray-500 mb-4">
                  {audit?.root_url && (
                    <span>
                      Analyzing: <span className="font-medium text-gray-700">{audit.root_url}</span>
                    </span>
                  )}
                </div>
                
                {/* Learn More Link */}
                <Link
                  to={`/score-guide#${categorySlug}`}
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  📖 Learn how to fix these issues
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>
              </div>
            </div>
            {categoryScore && (
              <div className={`px-6 py-3 rounded-lg border ${getScoreColor(categoryScore.score)} font-bold text-3xl`}>
                {Math.round(categoryScore.score)}
              </div>
            )}
          </div>
        </div>

        {/* Check Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Category Score Breakdown
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Performance on each check within this category
          </p>
          <div className="space-y-3">
            {checkBreakdown.length === 0 ? (
              <p className="text-gray-500 text-sm">No checks defined for this category.</p>
            ) : (
              checkBreakdown.map(({ check, avgScore, passingPages, failingPages, totalPages }) => (
                <div 
                  key={check.id} 
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {check.id}
                      </span>
                      <h3 className="font-medium text-gray-900">{check.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{check.description}</p>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-green-600">
                        ✓ {passingPages} passing
                      </span>
                      <span className="text-red-600">
                        ✗ {failingPages} failing
                      </span>
                      <span className="text-gray-500">
                        of {totalPages} pages
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className={`text-2xl font-bold ${getCheckScoreColor(avgScore)}`}>
                      {avgScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">avg score</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pages with Issues */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Impacted Pages ({pagesWithIssues.length})
            </h2>
            <p className="text-sm text-gray-600">
              Pages that have failing checks in this category
            </p>
          </div>
          
          {pagesWithIssues.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-gray-900 font-medium mb-1">All pages passing!</p>
              <p className="text-gray-500 text-sm">No issues found in this category</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Failing Checks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Issues
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pagesWithIssues.map((page) => (
                    <tr key={page.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                        <a href={page.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                          {page.url}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {page.failingChecks.map((check) => (
                            <CheckPill 
                              key={check.id}
                              code={check.id} 
                              weight={check.weight} 
                              score={Math.round(check.score)}
                              alwaysShowLabel={false}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className="text-red-600 font-medium">
                          {page.failingChecks.length} issue{page.failingChecks.length !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          to={`/audits/${id}/pages/${page.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


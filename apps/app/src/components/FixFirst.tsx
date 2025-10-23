import React, { useState } from 'react';
import { Card, CardBody } from './ui/Card';
import { Badge } from './ui/Badge';
import CheckPill from './CheckPill';
import AICitedBadge from './AICitedBadge';
import { useCitedPages } from '../hooks/useCitedPages';

interface FixItem {
  id: string;
  name: string;
  category: string;
  impact_level: 'High' | 'Medium' | 'Low';
  weight: number;
  score: number;
  page_url?: string;
  page_title?: string;
  page_h1?: string;
  details?: Record<string, any>;
  evidence?: string[];
  why_it_matters?: string;
  how_to_fix?: string;
  examples?: string;
  quick_fixes?: string;
  common_issues?: string;
  official_docs?: string;
  learn_more_links?: string;
}

interface FixFirstProps {
  fixes: FixItem[];
  auditId: string;
}

export default function FixFirst({ fixes, auditId }: FixFirstProps) {
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [expandedFixes, setExpandedFixes] = useState<Set<string>>(new Set());
  const { getCitationCount, isCited } = useCitedPages(auditId);

  if (!fixes || fixes.length === 0) {
    return (
      <Card>
        <CardBody>
          <h2 className="section-title mb-2">Fix First</h2>
          <p className="text-sm muted">
            Great news! All checks are passing well. No critical fixes needed.
          </p>
        </CardBody>
      </Card>
    );
  }

  // Group fixes by page URL
  const fixesByPage = fixes.reduce((acc, fix) => {
    const pageKey = fix.page_url || 'Site-Level Issues';
    if (!acc[pageKey]) {
      acc[pageKey] = {
        url: fix.page_url,
        title: fix.page_title,
        fixes: []
      };
    }
    acc[pageKey].fixes.push(fix);
    return acc;
  }, {} as Record<string, { url?: string; title?: string; fixes: FixItem[] }>);

  // Sort pages: AI-cited pages first, then by high-impact issues, then by total issues
  const sortedPages = Object.entries(fixesByPage).sort(([aUrl, aData], [bUrl, bData]) => {
    // Priority 1: AI-cited pages come first
    const aCited = aData.url ? isCited(aData.url) : false;
    const bCited = bData.url ? isCited(bData.url) : false;
    if (aCited !== bCited) return bCited ? 1 : -1;
    
    // Priority 2: High-impact issue count
    const aHighCount = aData.fixes.filter(f => f.impact_level === 'High').length;
    const bHighCount = bData.fixes.filter(f => f.impact_level === 'High').length;
    if (aHighCount !== bHighCount) return bHighCount - aHighCount;
    
    // Priority 3: Total issue count
    return bData.fixes.length - aData.fixes.length;
  });

  const togglePage = (pageUrl: string) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(pageUrl)) {
      newExpanded.delete(pageUrl);
    } else {
      newExpanded.add(pageUrl);
    }
    setExpandedPages(newExpanded);
  };

  const toggleFix = (fixId: string) => {
    const newExpanded = new Set(expandedFixes);
    if (newExpanded.has(fixId)) {
      newExpanded.delete(fixId);
    } else {
      newExpanded.add(fixId);
    }
    setExpandedFixes(newExpanded);
  };

  const formatCurrentState = (details: Record<string, any> | undefined, evidence: string[] | undefined) => {
    if (!details && !evidence) return null;
    
    // Extract meaningful current state from details
    const parts: string[] = [];
    if (details) {
      if (details.current_title) parts.push(`Current: "${details.current_title}"`);
      if (details.current_h1) parts.push(`H1: "${details.current_h1}"`);
      if (details.current_value) parts.push(`Current: "${details.current_value}"`);
      if (details.message) parts.push(details.message);
      if (details.found !== undefined) parts.push(`Found: ${details.found}`);
      if (details.expected !== undefined) parts.push(`Expected: ${details.expected}`);
    }
    if (evidence && evidence.length > 0) {
      parts.push(...evidence.slice(0, 2));
    }
    
    return parts.length > 0 ? parts.join(' | ') : null;
  };

  return (
    <Card>
      <CardBody>
        <h2 className="section-title mb-2">Fix First</h2>
        <p className="text-sm muted mb-4">
          Priority issues organized by page • AI-cited pages shown first • Fix these to improve your score and strengthen your AI visibility
        </p>

        <div className="space-y-3">
          {sortedPages.map(([pageKey, pageData]) => {
            const isPageExpanded = expandedPages.has(pageKey);
            const highCount = pageData.fixes.filter(f => f.impact_level === 'High').length;
            const mediumCount = pageData.fixes.filter(f => f.impact_level === 'Medium').length;
            const lowCount = pageData.fixes.filter(f => f.impact_level === 'Low').length;
            const citationCount = pageData.url ? getCitationCount(pageData.url) : 0;

            return (
              <div key={pageKey} className="card overflow-hidden">
                {/* Page Header */}
                <button
                  onClick={() => togglePage(pageKey)}
                  className="w-full px-4 py-3 bg-surface-1 hover:bg-surface-2 transition-colors text-left border-b border-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {pageData.url ? (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium subtle uppercase tracking-wide">URL:</span>
                            <div className="text-sm font-medium text-brand truncate">
                              {pageData.url}
                            </div>
                            {citationCount > 0 && (
                              <AICitedBadge citationCount={citationCount} />
                            )}
                          </div>
                          {pageData.title && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium subtle uppercase tracking-wide flex-shrink-0">Title:</span>
                              <div className="text-xs muted truncate">
                                {pageData.title}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm font-medium">Site-Level Issues</div>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs subtle">
                          {pageData.fixes.length} issue{pageData.fixes.length !== 1 ? 's' : ''}
                        </span>
                        {highCount > 0 && <Badge variant="danger">{highCount} High</Badge>}
                        {mediumCount > 0 && <Badge variant="warn">{mediumCount} Medium</Badge>}
                        {lowCount > 0 && <Badge variant="success">{lowCount} Low</Badge>}
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 subtle transition-transform flex-shrink-0 ${isPageExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Page Issues (Collapsible) */}
                {isPageExpanded && (
                  <div className="p-4 space-y-3 bg-surface-1">
                    {pageData.fixes.map((fix, index) => {
                      const isFixExpanded = expandedFixes.has(`${pageKey}-${fix.id}`);
                      const impactVariant = fix.impact_level === 'High' ? 'danger' : fix.impact_level === 'Medium' ? 'warn' : 'success';
                      const currentState = formatCurrentState(fix.details, fix.evidence);
                      
                      return (
                        <div
                          key={`${pageKey}-${fix.id}`}
                          className="card hover:border-brand transition-all overflow-hidden"
                        >
                          {/* Issue Header */}
                          <button
                            onClick={() => toggleFix(`${pageKey}-${fix.id}`)}
                            className="w-full p-4 hover:bg-surface-2 transition-colors text-left"
                          >
                            <div className="flex items-start gap-3">
                              {/* Priority number within page */}
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand text-brand-foreground font-bold flex items-center justify-center text-sm">
                                {index + 1}
                              </div>

                              <div className="flex-1 min-w-0">
                                {/* Issue name and category */}
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <h3 className="text-sm font-bold">{fix.name}</h3>
                                  <span className="tag">{fix.category}</span>
                                  <Badge variant={impactVariant}>{fix.impact_level}</Badge>
                                </div>

                                {/* Current State */}
                                {currentState && (
                                  <div className="mb-2">
                                    <span className="text-xs font-semibold muted">Current State: </span>
                                    <span className="text-xs muted">{currentState}</span>
                                  </div>
                                )}

                                {/* Score preview */}
                                <div className="text-xs subtle">
                                  Score: {Math.round(fix.score)} | Weight: {fix.weight}
                                </div>
                              </div>

                              {/* Expand/Collapse Icon */}
                              <svg
                                className={`w-5 h-5 subtle transition-transform flex-shrink-0 ${isFixExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>

                          {/* Expanded Fix Details */}
                          {isFixExpanded && (
                            <div className="px-4 pb-4 space-y-3 border-t border-border bg-surface-2">
                              {/* Why it matters */}
                              {fix.why_it_matters && (
                                <div className="card-muted rounded-xl p-3">
                                  <h4 className="font-bold text-xs mb-1">Why This Matters</h4>
                                  <p className="text-xs leading-relaxed">
                                    {fix.why_it_matters}
                                  </p>
                                </div>
                              )}

                              {/* How to fix */}
                              {fix.how_to_fix && (
                                <div className="card-muted rounded-xl p-3">
                                  <h4 className="font-bold text-xs mb-1">How to Fix</h4>
                                  <p className="text-xs leading-relaxed whitespace-pre-line">
                                    {fix.how_to_fix}
                                  </p>
                                </div>
                              )}

                              {/* Quick fixes */}
                              {fix.quick_fixes && (
                                <div className="card-muted rounded-xl p-3">
                                  <h4 className="font-bold text-xs mb-1">Quick Fixes</h4>
                                  <p className="text-xs leading-relaxed">
                                    {fix.quick_fixes}
                                  </p>
                                </div>
                              )}

                              {/* Examples */}
                              {fix.examples && (
                                <div className="card-muted rounded-xl p-3">
                                  <h4 className="font-bold text-xs mb-1">Example</h4>
                                  <pre className="text-xs bg-surface-1 rounded p-2 overflow-x-auto border border-border font-mono whitespace-pre-wrap">
                                    {fix.examples}
                                  </pre>
                                </div>
                              )}

                              {/* Official docs */}
                              {fix.official_docs && (
                                <div className="card-muted rounded-xl p-3">
                                  <h4 className="font-bold text-xs mb-1">Learn More</h4>
                                  <a
                                    href={fix.official_docs}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-brand hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Official Documentation →
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs subtle">
            <strong>Tip:</strong> Fix high-impact issues first for the biggest score improvement. Click any page to see its specific issues and recommended fixes.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

import React, { useState } from 'react';
import { Card, CardBody } from './ui/Card';
import { Badge } from './ui/Badge';
import CheckPill from './CheckPill';

interface FixItem {
  id: string;
  name: string;
  category: string;
  impact_level: 'High' | 'Medium' | 'Low';
  weight: number;
  score: number;
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
}

export default function FixFirst({ fixes }: FixFirstProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedFixes, setExpandedFixes] = useState<Set<string>>(new Set());

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

  // Group fixes by category
  const fixesByCategory = fixes.reduce((acc, fix) => {
    if (!acc[fix.category]) {
      acc[fix.category] = [];
    }
    acc[fix.category].push(fix);
    return acc;
  }, {} as Record<string, FixItem[]>);

  // Sort categories by total impact (High Impact items count first)
  const sortedCategories = Object.entries(fixesByCategory).sort(([, aFixes], [, bFixes]) => {
    const aHighCount = aFixes.filter(f => f.impact_level === 'High').length;
    const bHighCount = bFixes.filter(f => f.impact_level === 'High').length;
    if (aHighCount !== bHighCount) return bHighCount - aHighCount;
    return bFixes.length - aFixes.length;
  });

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
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

  return (
    <Card>
      <CardBody>
        <h2 className="section-title mb-2">Fix First</h2>
        <p className="text-sm muted mb-4">
          Top priority improvements organized by category
        </p>

        <div className="space-y-3">
          {sortedCategories.map(([category, categoryFixes]) => {
            const isExpanded = expandedCategories.has(category);
            const highCount = categoryFixes.filter(f => f.impact_level === 'High').length;
            const mediumCount = categoryFixes.filter(f => f.impact_level === 'Medium').length;
            const lowCount = categoryFixes.filter(f => f.impact_level === 'Low').length;

            return (
              <div key={category} className="card overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-4 py-3 bg-surface-2 hover:bg-surface-3 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{category}</span>
                    <span className="text-sm subtle">
                      {categoryFixes.length} issue{categoryFixes.length !== 1 ? 's' : ''}
                    </span>
                    {highCount > 0 && <Badge variant="danger">{highCount} High</Badge>}
                    {mediumCount > 0 && <Badge variant="warn">{mediumCount} Medium</Badge>}
                    {lowCount > 0 && <Badge variant="success">{lowCount} Low</Badge>}
                  </div>
                  <svg
                    className={`w-5 h-5 subtle transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

              {/* Category Fixes (Collapsible) */}
              {isExpanded && (
                <div className="p-4 space-y-3 bg-surface-1">
                  {categoryFixes.map((fix, index) => {
                    const isFixExpanded = expandedFixes.has(fix.id);
                    const impactVariant = fix.impact_level === 'High' ? 'danger' : fix.impact_level === 'Medium' ? 'warn' : 'success';
                    
                    return (
                      <div
                        key={fix.id}
                        className="card hover:border-brand transition-all overflow-hidden"
                      >
                        {/* Fix Header */}
                        <button
                          onClick={() => toggleFix(fix.id)}
                          className="w-full p-4 hover:bg-surface-2 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            {/* Priority number within category */}
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand text-brand-foreground font-bold flex items-center justify-center text-sm">
                              {index + 1}
                            </div>

                            <div className="flex-1 min-w-0 text-left">
                              {/* Check name and pill */}
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <CheckPill code={fix.id} score={fix.score} weight={fix.weight} />
                                <h3 className="text-sm font-bold">{fix.name}</h3>
                              </div>

                              {/* Impact and weight */}
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Badge variant={impactVariant}>{fix.impact_level} Impact</Badge>
                                <span className="text-xs subtle">
                                  Weight: {fix.weight} | Score: {Math.round(fix.score)}
                                </span>
                              </div>

                              {/* Why it matters - preview */}
                              {fix.why_it_matters && !isFixExpanded && (
                                <p className="text-xs muted leading-relaxed line-clamp-2">
                                  {fix.why_it_matters}
                                </p>
                              )}
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
                              <div className="card-muted p-3">
                                <h4 className="font-bold text-xs mb-1">
                                  Why This Matters
                                </h4>
                                <p className="text-xs muted leading-relaxed">
                                  {fix.why_it_matters}
                                </p>
                              </div>
                            )}

                            {/* How to fix */}
                            {fix.how_to_fix && (
                              <div className="card-muted p-3">
                                <h4 className="font-bold text-xs mb-1">
                                  How to Fix
                                </h4>
                                <p className="text-xs muted leading-relaxed whitespace-pre-line">
                                  {fix.how_to_fix}
                                </p>
                              </div>
                            )}

                            {/* Quick fixes */}
                            {fix.quick_fixes && (
                              <div className="card-muted p-3">
                                <h4 className="font-bold text-xs mb-1">
                                  Quick Fixes
                                </h4>
                                <p className="text-xs muted leading-relaxed">
                                  {fix.quick_fixes}
                                </p>
                              </div>
                            )}

                            {/* Examples */}
                            {fix.examples && (
                              <div className="card-muted p-3">
                                <h4 className="font-bold text-xs mb-1">
                                  Example
                                </h4>
                                <pre className="text-xs bg-surface-1 rounded p-2 overflow-x-auto border border-border font-mono">
                                  {fix.examples}
                                </pre>
                              </div>
                            )}

                            {/* Common issues */}
                            {fix.common_issues && (
                              <div className="card-muted p-3">
                                <h4 className="font-bold text-xs mb-1">
                                  Common Issues
                                </h4>
                                <p className="text-xs muted leading-relaxed">
                                  {fix.common_issues}
                                </p>
                              </div>
                            )}

                            {/* Official docs */}
                            {fix.official_docs && (
                              <div className="card-muted p-3">
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
                                {fix.learn_more_links && (
                                  <p className="text-xs muted mt-2 pt-2 border-t border-border">
                                    {fix.learn_more_links}
                                  </p>
                                )}
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
            <strong>Tip:</strong> Focus on High Impact items first for maximum improvement to your Optiview score.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

import React from 'react';

export type CheckCategory =
  | 'Content & Clarity'
  | 'Structure & Organization'
  | 'Authority & Trust'
  | 'Technical Foundations'
  | 'Crawl & Discoverability'
  | 'Experience & Performance';

interface CategoryScore {
  category: string;
  score: number;
  weight_total?: number;
  checks_count?: number;
}

interface CategorySectionProps {
  category: CheckCategory;
  score?: CategoryScore;
  description?: string;
  children: React.ReactNode;
}

// Category icon map - using Tailwind/Heroicons-style SVG
const CATEGORY_ICONS: Record<CheckCategory, JSX.Element> = {
  'Content & Clarity': (
    <svg className="w-8 h-8 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  'Structure & Organization': (
    <svg className="w-8 h-8 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  'Authority & Trust': (
    <svg className="w-8 h-8 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  ),
  'Technical Foundations': (
    <svg className="w-8 h-8 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v6m0 6v6M23 12h-6m-6 0H1"/>
    </svg>
  ),
  'Crawl & Discoverability': (
    <svg className="w-8 h-8 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  'Experience & Performance': (
    <svg className="w-8 h-8 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
};

// Category descriptions
export const CATEGORY_DESCRIPTIONS: Record<CheckCategory, string> = {
  'Content & Clarity': 'Clear, complete answers that assistants can quote.',
  'Structure & Organization': 'Pages and links arranged so people and parsers "get it."',
  'Authority & Trust': 'Visible expertise and evidence to earn citations.',
  'Technical Foundations': 'Schema and semantics that explain meaning to machines.',
  'Crawl & Discoverability': 'Make sure crawlers and AIs can reach and render it.',
  'Experience & Performance': 'Fast, readable, accessible everywhere.'
};

export default function CategorySection({
  category,
  score,
  description,
  children
}: CategorySectionProps) {
  const displayIcon = CATEGORY_ICONS[category];
  const displayDescription = description || CATEGORY_DESCRIPTIONS[category];
  
  const scoreColor = score && score.score >= 80 ? 'text-success' : 
                     score && score.score >= 50 ? 'text-warn' : 
                     'text-danger';

  return (
    <section className="mb-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-shrink-0 p-2 bg-brand/10 rounded-lg">{displayIcon}</div>
            <h2 className="text-2xl font-bold ">
              {category}
            </h2>
            {score && (
              <span className={`text-3xl font-bold ${scoreColor}`}>
                {score.score}%
              </span>
            )}
          </div>
          <p className="muted text-sm max-w-3xl">
            {displayDescription}
          </p>
        </div>
      </div>

      {/* Score Bar */}
      {score && (
        <div className="mb-6">
          <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                score.score >= 80 ? 'bg-success-soft0' :
                score.score >= 50 ? 'bg-warn-soft0' :
                'bg-danger-soft0'
              }`}
              style={{ width: `${score.score}%` }}
            />
          </div>
          <div className="mt-1 text-xs subtle">
            {score.checks_count} checks • Total weight: {score.weight_total}
          </div>
        </div>
      )}

      {/* Checks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </section>
  );
}


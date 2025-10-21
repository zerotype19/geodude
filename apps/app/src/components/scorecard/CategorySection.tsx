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
  emoji?: string;
  description?: string;
  children: React.ReactNode;
}

// Category emoji map
const CATEGORY_EMOJIS: Record<CheckCategory, string> = {
  'Content & Clarity': '📝',
  'Structure & Organization': '🏗️',
  'Authority & Trust': '🛡️',
  'Technical Foundations': '⚙️',
  'Crawl & Discoverability': '🔍',
  'Experience & Performance': '⚡'
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
  emoji,
  description,
  children
}: CategorySectionProps) {
  const displayEmoji = emoji || CATEGORY_EMOJIS[category];
  const displayDescription = description || CATEGORY_DESCRIPTIONS[category];
  
  const scoreColor = score && score.score >= 80 ? 'text-green-600' : 
                     score && score.score >= 50 ? 'text-yellow-600' : 
                     'text-red-600';

  return (
    <section className="mb-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{displayEmoji}</span>
            <h2 className="text-2xl font-bold text-gray-900">
              {category}
            </h2>
            {score && (
              <span className={`text-3xl font-bold ${scoreColor}`}>
                {score.score}%
              </span>
            )}
          </div>
          <p className="text-gray-600 text-sm max-w-3xl">
            {displayDescription}
          </p>
        </div>
      </div>

      {/* Score Bar */}
      {score && (
        <div className="mb-6">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                score.score >= 80 ? 'bg-green-500' :
                score.score >= 50 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${score.score}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-gray-500">
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


import React from 'react';
import { Link, useParams } from 'react-router-dom';

interface CategoryScore {
  category: string;
  score: number;
  weight_total: number;
  checks_count: number;
}

interface CategoryScoreCardProps {
  categoryScore: CategoryScore;
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

export default function CategoryScoreCard({ categoryScore }: CategoryScoreCardProps) {
  const { id } = useParams<{ id: string }>();
  const { category, score, checks_count } = categoryScore;
  const emoji = CATEGORY_EMOJIS[category] || '📊';
  const description = CATEGORY_DESCRIPTIONS[category] || '';

  // Create URL-friendly category slug
  // "Content & Clarity" -> "content-clarity"
  const categorySlug = category.toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-');

  // Color coding based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (score >= 40) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const scoreColor = getScoreColor(score);
  const progressColor = getProgressColor(score);

  return (
    <Link 
      to={`/audits/${id}/category/${categorySlug}`}
      className="block bg-white rounded-lg border border-gray-200 p-5 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{emoji}</span>
            <h3 className="text-base font-semibold text-gray-900">{category}</h3>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
        </div>
        <div className={`ml-4 px-3 py-1.5 rounded-lg border ${scoreColor} font-bold text-lg min-w-[60px] text-center`}>
          {Math.round(score)}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${progressColor}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{checks_count} checks</span>
        <span className="text-blue-600 font-medium">View breakdown →</span>
      </div>
    </Link>
  );
}


import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from './ui/Badge';

interface CategoryScore {
  category: string;
  score: number;
  weight_total: number;
  checks_count: number;
}

interface CategoryScoreCardProps {
  categoryScore: CategoryScore;
}

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
  const description = CATEGORY_DESCRIPTIONS[category] || '';

  // Create URL-friendly category slug
  const categorySlug = category.toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-');

  // Badge variant based on score
  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warn';
    return 'danger';
  };

  const getScoreGlow = (score: number): string => {
    if (!Number.isFinite(score)) return '';
    if (score >= 85) return 'shadow-[0_0_0_3px_rgba(34,197,94,0.15)] border-success/30';
    if (score >= 60) return 'shadow-[0_0_0_3px_rgba(251,191,36,0.15)] border-warn/30';
    return 'shadow-[0_0_0_3px_rgba(239,68,68,0.15)] border-danger/30';
  };

  const badgeVariant = getScoreBadge(score);

  return (
    <Link 
      to={`/audits/${id}/category/${categorySlug}`}
      className={`card card-body hover:shadow-lg transition-all cursor-pointer ${getScoreGlow(score)}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="section-title mb-1">{category}</h3>
          <p className="text-sm muted leading-relaxed">{description}</p>
        </div>
        <Badge variant={badgeVariant} tone="pill">
          <span className="text-lg font-bold">{Math.round(score)}</span>
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="bar mb-3">
        <span style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="subtle">{checks_count} checks</span>
        <span className="text-brand font-medium">View breakdown →</span>
      </div>
    </Link>
  );
}


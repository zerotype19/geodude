import { getChecksByCategory, CATEGORY_ORDER, CHECKS_V2 } from '../content/checksV2';
import CheckPill from './CheckPill';

interface CheckCategoriesProps {
  scores?: Record<string, { score: number; weight: number }>;
}

// Category descriptions matching the score guide
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Content & Clarity': 'Clear, complete answers that assistants can quote.',
  'Structure & Organization': 'Pages and links arranged so people and parsers "get it."',
  'Authority & Trust': 'Visible expertise and evidence to earn citations.',
  'Technical Foundations': 'Schema and semantics that explain meaning to machines.',
  'Crawl & Discoverability': 'Make sure crawlers and AIs can reach and render it.',
  'Experience & Performance': 'Fast, readable, accessible everywhere.'
};

// Category icons matching the score guide
const CATEGORY_ICONS: Record<string, string> = {
  'Content & Clarity': '',
  'Structure & Organization': '️',
  'Authority & Trust': '️',
  'Technical Foundations': '️',
  'Crawl & Discoverability': '',
  'Experience & Performance': ''
};

export default function CheckCategories({ scores = {} }: CheckCategoriesProps) {
  const checksByCategory = getChecksByCategory();

  return (
    <div className="bg-surface-1 shadow rounded-lg">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-medium ">Check Categories</h2>
        <p className="text-sm muted">All AEO/GEO checks organized by category</p>
      </div>
      <div className="p-6 space-y-6">
        {CATEGORY_ORDER.map(category => {
          const checks = checksByCategory[category] || [];
          if (checks.length === 0) return null;

          return (
            <div key={category} className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold ">
                  {CATEGORY_ICONS[category] && <span className="mr-2">{CATEGORY_ICONS[category]}</span>}
                  {category}
                </h4>
                <p className="text-xs subtle mt-0.5">
                  {CATEGORY_DESCRIPTIONS[category]}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {checks.map(check => {
                  const checkScore = scores[check.id];
                  return (
                    <CheckPill 
                      key={check.id} 
                      code={check.id}
                      score={checkScore?.score}
                      weight={checkScore?.weight}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/**
 * Category Section for Score Guide
 * 
 * Displays criteria grouped by category (Business view)
 */

import { CriterionMeta } from '../../content/criteriaV2';
import CriteriaCard from './CriteriaCard';

interface CategorySectionProps {
  title: string;
  icon: string;
  description: string;
  criteria: CriterionMeta[];
}

// Icon mapping for categories
const CATEGORY_ICONS: Record<string, JSX.Element> = {
  "Content & Clarity": (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  "Structure & Organization": (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  "Authority & Trust": (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  ),
  "Technical Foundations": (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v6m0 6v6M23 12h-6m-6 0H1"/>
    </svg>
  ),
  "Crawl & Discoverability": (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  "Experience & Performance": (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
};

export default function CategorySection({ title, icon, description, criteria }: CategorySectionProps) {
  // Create URL-friendly ID for anchor links
  const categoryId = title.toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-');
  
  return (
    <section id={categoryId} className="scroll-mt-20">
      {/* Category Header Card */}
      <div className="card card-body mb-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-3 bg-brand/10 rounded-xl text-brand">
            {CATEGORY_ICONS[title]}
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-bold mb-2">{title}</h2>
            <p className="text-lg muted">{description}</p>
            <div className="mt-3 text-sm text-brand font-medium">
              {criteria.length} checks in this category
            </div>
          </div>
        </div>
      </div>
      
      {/* Criteria Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-16">
        {criteria.map((criterion) => (
          <CriteriaCard key={criterion.id} criterion={criterion} />
        ))}
      </div>
    </section>
  );
}


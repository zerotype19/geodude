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

export default function CategorySection({ title, icon, description, criteria }: CategorySectionProps) {
  // Create URL-friendly ID for anchor links
  const categoryId = title.toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-');
  
  return (
    <section id={categoryId} className="mb-12 scroll-mt-20">
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2">{title}</h2>
        <p className="text-lg muted">{description}</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {criteria.map((criterion) => (
          <CriteriaCard key={criterion.id} criterion={criterion} />
        ))}
      </div>
    </section>
  );
}


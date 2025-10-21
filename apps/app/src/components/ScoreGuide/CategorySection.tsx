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
  return (
    <section className="mb-12">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">{icon}</span>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h2>
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-400 ml-14">{description}</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {criteria.map((criterion) => (
          <CriteriaCard key={criterion.id} criterion={criterion} />
        ))}
      </div>
    </section>
  );
}


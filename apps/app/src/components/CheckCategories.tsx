import { CHECK_GROUPS } from '../content/checks';
import CheckPill from './CheckPill';

interface CheckCategoriesProps {
  scores?: Record<string, { score: number; weight: number }>;
}

export default function CheckCategories({ scores = {} }: CheckCategoriesProps) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Check Categories</h2>
        <p className="text-sm text-gray-600">All AEO/GEO checks organized by category</p>
      </div>
      <div className="p-6 space-y-6">
        {CHECK_GROUPS.map(group => (
          <div key={group.title} className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">{group.title}</h4>
              <p className="text-xs text-gray-500 mt-0.5">{group.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {group.codes.map(code => {
                const checkScore = scores[code];
                return (
                  <CheckPill 
                    key={code} 
                    code={code}
                    score={checkScore?.score}
                    weight={checkScore?.weight}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


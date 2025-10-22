/**
 * Criteria Card for Score Guide
 * 
 * Displays individual criterion with metadata and references
 */

import { Link } from 'react-router-dom';
import { CriterionMeta } from '../../content/criteriaV2';
import PreviewBadge from '../PreviewBadge';

interface CriteriaCardProps {
  criterion: CriterionMeta;
}

// Map criterion IDs to slug URLs for detailed pages
const SLUG_MAP: Record<string, string> = {
  'A1': 'answer-first-design',
  'A2': 'author-identity',
  'A3': 'faq-schema',
  'A4': 'breadcrumb-schema',
  'A5': 'org-schema',
  'A6': 'product-schema',
  'A7': 'citations-outbound',
  'A8': 'html-semantic',
  'A9': 'e-e-a-t-signals',
  'A10': 'content-depth',
  'A11': 'content-freshness',
  'A12': 'multimedia-support',
  'G1': 'ai-meta-tags',
  'G2': 'og-metadata',
  'G3': 'title-h1-sync',
  'G4': 'text-entity-density',
  'G5': 'query-focused-content',
  'G6': 'render-parity',
  'G7': 'crawlability',
  'G8': 'natural-language',
  'G9': 'passage-extraction'
};

export default function CriteriaCard({ criterion }: CriteriaCardProps) {
  const impactColors = {
    High: 'bg-red-100 text-red-800',
    Medium: 'bg-yellow-100 text-yellow-800',
    Low: 'bg-green-100 text-green-800'
  };

  const slug = SLUG_MAP[criterion.id];
  const CardWrapper = slug ? Link : 'div';
  const cardProps = slug ? { to: `/score-guide/${slug}` } : {};

  return (
    <CardWrapper 
      {...cardProps}
      className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow block"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-gray-100 text-gray-700">
              {criterion.id}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${impactColors[criterion.impact]}`}>
              {criterion.impact}
            </span>
            {criterion.preview && <PreviewBadge />}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {criterion.title}
          </h3>
        </div>
        <span className="text-sm font-medium text-gray-500">
          W{criterion.weight}
        </span>
      </div>

      {/* Description (includes why it matters) */}
      <div className="bg-blue-50 rounded-lg p-3 mb-3 border border-blue-100">
        <p className="text-sm text-gray-700 leading-relaxed">
          {criterion.description}
        </p>
      </div>

      {/* References */}
      {criterion.references && criterion.references.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500">Supported by:</span>
          {criterion.references.map((ref, idx) => (
            <a
              key={idx}
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {ref.label} ↗
            </a>
          ))}
        </div>
      )}
      
      {/* View Details Link */}
      {slug && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            View interactive examples →
          </span>
        </div>
      )}
    </CardWrapper>
  );
}


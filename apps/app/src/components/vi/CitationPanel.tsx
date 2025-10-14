import React from 'react';

export interface GroupedCitation {
  rank: number;
  title: string;
  ref_url: string;
  link_text?: string;
  ref_domain: string;
  was_audited: boolean;
  captured_at: string;
}

export interface GroupedPrompt {
  intent_id: string;
  source: string;
  kind: 'branded' | 'non_branded';
  prompt_text: string;
  prompt_reason: string;
  citations: GroupedCitation[];
}

export interface CitationPanelProps {
  prompt: GroupedPrompt | null;
  domain: string;
}

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  } catch {
    return 'Unknown';
  }
};

const getFaviconUrl = (domain: string): string => {
  return `/api/favicon?u=${encodeURIComponent(domain)}`;
};

export default function CitationPanel({ prompt, domain }: CitationPanelProps) {
  if (!prompt) {
    return (
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <div className="text-center text-gray-500">
          <div className="text-lg mb-2">📄</div>
          <div>Select a prompt to view citations</div>
          <div className="text-sm mt-1">Choose from the prompts on the left</div>
        </div>
      </div>
    );
  }

  if (prompt.citations.length === 0) {
    return (
      <div className="bg-white border rounded-lg shadow-sm">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-medium text-gray-900">Citations for:</h3>
          <p className="text-sm text-gray-600 mt-1">"{prompt.prompt_text}"</p>
        </div>
        <div className="p-6 text-center text-gray-500">
          <div className="text-lg mb-2">🔍</div>
          <div>No citations found</div>
          <div className="text-sm mt-1">Try a broader or different query</div>
        </div>
      </div>
    );
  }

  // Group citations by audited vs competitor
  const auditedCitations = prompt.citations.filter(c => c.was_audited);
  const competitorCitations = prompt.citations.filter(c => !c.was_audited);

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="font-medium text-gray-900">Citations for:</h3>
        <p className="text-sm text-gray-600 mt-1">"{prompt.prompt_text}"</p>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-xs text-gray-500">
            {prompt.citations.length} total citation{prompt.citations.length !== 1 ? 's' : ''}
          </span>
          {auditedCitations.length > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
              {auditedCitations.length} from your site
            </span>
          )}
          {competitorCitations.length > 0 && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
              {competitorCitations.length} competitors
            </span>
          )}
        </div>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        {/* Audited domain citations first */}
        {auditedCitations.map((citation, index) => (
          <CitationItem 
            key={`audited-${citation.rank}-${index}`}
            citation={citation} 
            domain={domain}
            isAudited={true}
          />
        ))}
        
        {/* Competitor citations */}
        {competitorCitations.map((citation, index) => (
          <CitationItem 
            key={`competitor-${citation.rank}-${index}`}
            citation={citation} 
            domain={domain}
            isAudited={false}
          />
        ))}
      </div>
    </div>
  );
}

function CitationItem({ citation, domain, isAudited }: { 
  citation: GroupedCitation; 
  domain: string; 
  isAudited: boolean; 
}) {
  return (
    <div className="p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <img 
            src={getFaviconUrl(citation.ref_domain)} 
            alt="" 
            className="w-4 h-4"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <a 
              href={citation.ref_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline line-clamp-2"
            >
              {citation.title}
            </a>
            
            <span className={`
              px-2 py-1 rounded-full text-xs font-medium flex-shrink-0
              ${isAudited 
                ? 'bg-green-100 text-green-700' 
                : 'bg-orange-100 text-orange-700'
              }
            `}>
              {isAudited ? 'Your Site' : 'Competitor'}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium">{citation.ref_domain}</span>
            <span>•</span>
            <span>Rank #{citation.rank}</span>
            <span>•</span>
            <span>{formatDate(citation.captured_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

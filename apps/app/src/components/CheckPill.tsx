import { getCheckMeta } from "../content/checks";
import { ID_TO_SLUG } from "../content/score-guide/checks";

type Props = {
  code: string;
  weight?: number;
  score?: number; // 0..3
  compact?: boolean;
  showGuideLink?: boolean;
  alwaysShowLabel?: boolean; // Force label to show even on mobile
  auditId?: string; // For deep-linking context
  pageId?: string; // For deep-linking context
};

export default function CheckPill({ 
  code, 
  weight, 
  score, 
  compact = false,
  showGuideLink = true,
  alwaysShowLabel = false,
  auditId,
  pageId
}: Props) {
  const meta = getCheckMeta(code);
  
  // Color by score (0-3 scale)
  const color =
    score === 3 ? "bg-green-100 text-green-800 border-green-200"
  : score === 2 ? "bg-amber-100 text-amber-800 border-amber-200"
  : score === 1 ? "bg-orange-100 text-orange-800 border-orange-200"
  : score === 0 ? "bg-red-100 text-red-800 border-red-200"
  : "bg-gray-100 text-gray-700 border-gray-200"; // no score provided

  const handleClick = (e: React.MouseEvent) => {
    if (showGuideLink) {
      e.preventDefault();
      // Build deep-link with audit context
      const slug = ID_TO_SLUG[code];
      if (slug) {
        let url = `/score-guide/${slug}#examples`;
        if (auditId && pageId) {
          url += `?from=audits&check=${code}&auditId=${auditId}&pageId=${pageId}`;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        // Fallback to old anchor system if slug not found
        window.open(`/score-guide${meta.guideAnchor}`, '_blank', 'noopener,noreferrer');
      }
    }
  };

  // Determine label visibility class
  const labelClass = alwaysShowLabel 
    ? "truncate max-w-[180px]" // Always show
    : "hidden sm:inline truncate max-w-[180px]"; // Hide on mobile

  return (
    <div className="group relative inline-block">
      <span 
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border cursor-pointer transition-all hover:shadow-md ${color}`}
        onClick={handleClick}
      >
        {/* Plain English label first - user-friendly */}
        <span className="font-medium">{meta.label}</span>
      </span>
      
      {/* Hover tooltip - positioned above to avoid card clipping */}
      <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-[9999] hidden group-hover:block w-72 bg-gray-900 text-white text-xs rounded-lg shadow-xl p-3 pointer-events-none">
        <div className="font-semibold mb-1">{meta.label} ({code})</div>
        <div className="opacity-90 mb-2">{meta.description}</div>
        <div className="opacity-70 text-[11px] space-y-0.5">
          <div>Category: {meta.category}</div>
          {weight && <div>Weight: {weight}</div>}
          {typeof score === "number" && <div>Score: {score}/3</div>}
        </div>
        
        {/* G4: Add Google-Extended note */}
        {code === 'G4' && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="font-medium mb-1">Google-Extended (Training Access)</div>
            <div className="opacity-80 text-[11px] mb-2">
              Controls whether Google may use your content for AI model training (separate from normal Googlebot crawling). 
              Blocking Google-Extended does NOT affect Google Search indexing or AI Overviews visibility.
            </div>
            <pre className="rounded bg-gray-800 p-2 text-[10px] overflow-x-auto text-green-300">
{`User-agent: Google-Extended
Disallow: /`}
            </pre>
          </div>
        )}
        
        {showGuideLink && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <span className="text-blue-300 text-[11px]">Click to open scoring guide →</span>
          </div>
        )}
        
        {/* Arrow pointer */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-gray-900 transform rotate-45"></div>
      </div>
    </div>
  );
}


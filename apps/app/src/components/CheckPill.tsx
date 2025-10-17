import { getCheckMeta } from "../content/checks";

type Props = {
  code: string;
  weight?: number;
  score?: number; // 0..3
  compact?: boolean;
  showGuideLink?: boolean;
  alwaysShowLabel?: boolean; // Force label to show even on mobile
};

export default function CheckPill({ 
  code, 
  weight, 
  score, 
  compact = false,
  showGuideLink = true,
  alwaysShowLabel = false 
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
      window.open(`/score-guide${meta.guideAnchor}`, '_blank');
    }
  };

  // Determine label visibility class
  const labelClass = alwaysShowLabel 
    ? "truncate max-w-[180px]" // Always show
    : "hidden sm:inline truncate max-w-[180px]"; // Hide on mobile

  return (
    <div className="group relative inline-block">
      <span 
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs border cursor-pointer transition-all hover:shadow-sm ${color}`}
        onClick={handleClick}
      >
        <span className="font-semibold">{code}</span>
        {!compact && <span className={labelClass}>{meta.label}</span>}
        {typeof score === "number" && (
          <span className="opacity-70 ml-0.5">· {score}/3</span>
        )}
        {typeof weight === "number" && (
          <span className="opacity-70 text-[10px]">w{weight}</span>
        )}
      </span>
      
      {/* Hover tooltip */}
      <div className="absolute left-0 top-full mt-2 z-50 hidden group-hover:block w-72 bg-gray-900 text-white text-xs rounded-lg shadow-xl p-3 pointer-events-none">
        <div className="font-semibold mb-1">{meta.label} ({code})</div>
        <div className="opacity-90 mb-2">{meta.description}</div>
        <div className="opacity-70 text-[11px] space-y-0.5">
          <div>Category: {meta.category}</div>
          {weight && <div>Weight: {weight}</div>}
          {typeof score === "number" && <div>Score: {score}/3</div>}
        </div>
        {showGuideLink && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <span className="text-blue-300 text-[11px]">Click to open scoring guide →</span>
          </div>
        )}
        
        {/* Arrow pointer */}
        <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
      </div>
    </div>
  );
}


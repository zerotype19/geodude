import { renderParityLabel } from '../constants/thresholds';

type Props = {
  ratio: number; // 0-1 where 1 = perfect parity (100% content in static HTML)
};

export default function RenderParityPanel({ ratio }: Props) {
  const { emoji, label, hint, severity } = renderParityLabel(ratio);
  const pct = Math.round(ratio * 100);
  
  const borderColor = 
    severity === 'success' ? 'border-green-200' :
    severity === 'warning' ? 'border-amber-200' :
    'border-red-200';
  
  const bgColor = 
    severity === 'success' ? 'bg-green-50' :
    severity === 'warning' ? 'bg-amber-50' :
    'bg-red-50';

  return (
    <div className={`mt-4 rounded-lg border-2 ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-center gap-2 font-medium text-gray-900 mb-2">
        <span className="text-lg">{emoji}</span>
        <span>HTML vs Rendered DOM</span>
        <span className="ml-auto text-xs font-semibold rounded-full bg-white border border-gray-300 px-3 py-1">
          {pct}% parity
        </span>
      </div>
      
      <div className="text-sm text-gray-700 mb-3">
        <strong>{label}</strong> — {hint}
      </div>
      
      {/* Visual bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div 
          className={`h-full transition-all ${
            severity === 'success' ? 'bg-green-500' :
            severity === 'warning' ? 'bg-amber-500' :
            'bg-red-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      
      <div className="text-xs text-gray-600 bg-white rounded p-2 border border-gray-200">
        <strong>Tip:</strong> Ensure summary block and JSON-LD are present in server HTML. 
        Avoid deferring them to post-load JavaScript. Test with <code className="bg-gray-100 px-1 rounded">curl</code> or 
        "View Source" — if it's blank, AI crawlers can't see it.
      </div>
      
      {/* Show AEO/GEO penalty info if low */}
      {ratio < 0.5 && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <div className="text-xs text-gray-700">
            <strong>Score Impact:</strong>
            <ul className="mt-1 space-y-1 ml-4 list-disc">
              {ratio < 0.3 && (
                <li>AEO: -5 point site penalty (content/schema not visible in static HTML)</li>
              )}
              <li>GEO: {ratio < 0.3 ? '-10' : '-5'} point site penalty (LLM crawlers likely miss key content)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}


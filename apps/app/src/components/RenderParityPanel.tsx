import { renderParityLabel } from '../constants/thresholds';

type Props = {
  ratio: number; // 0-1 where 1 = perfect parity (100% content in static HTML)
};

export default function RenderParityPanel({ ratio }: Props) {
  const { emoji, label, hint, severity } = renderParityLabel(ratio);
  const pct = Math.round(ratio * 100);
  
  const borderColor = 
    severity === 'success' ? 'border-success' :
    severity === 'warning' ? 'border-warn' :
    'border-danger';
  
  const bgColor = 
    severity === 'success' ? 'bg-success-soft' :
    severity === 'warning' ? 'bg-warn-soft' :
    'bg-danger-soft';

  return (
    <div className={`mt-4 rounded-lg border-2 ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-center gap-2 font-medium  mb-2">
        <span className="text-lg">{emoji}</span>
        <span>HTML vs Rendered DOM</span>
        <span className="ml-auto text-xs font-semibold rounded-full bg-surface-1 border border-border px-3 py-1">
          {pct}% parity
        </span>
      </div>
      
      <div className="text-sm muted mb-3">
        <strong>{label}</strong> - {hint}
      </div>
      
      {/* Visual bar */}
      <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden mb-3">
        <div 
          className={`h-full transition-all ${
            severity === 'success' ? 'bg-success-soft0' :
            severity === 'warning' ? 'bg-warn-soft0' :
            'bg-danger-soft0'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      
      <div className="text-xs muted bg-surface-1 rounded p-2 border border-border">
        <strong>Tip:</strong> Ensure summary block and JSON-LD are present in server HTML. 
        Avoid deferring them to post-load JavaScript. Test with <code className="bg-surface-2 px-1 rounded">curl</code> or 
        "View Source" - if it's blank, AI crawlers can't see it.
      </div>
      
      {/* Show AEO/GEO penalty info if low */}
      {ratio < 0.5 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-xs muted">
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


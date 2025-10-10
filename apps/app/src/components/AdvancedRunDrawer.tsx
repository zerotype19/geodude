import { useState } from "react";

interface AdvancedRunDrawerProps {
  open: boolean;
  onClose: () => void;
  onRun: (opts: { maxPages?: number; include?: string[]; exclude?: string[] }) => void;
  initial?: { maxPages?: number; include?: string[]; exclude?: string[] };
}

export default function AdvancedRunDrawer({ 
  open, 
  onClose, 
  onRun, 
  initial 
}: AdvancedRunDrawerProps) {
  const [maxPages, setMaxPages] = useState(initial?.maxPages ?? 100);
  const [include, setInclude] = useState((initial?.include ?? []).join('\n'));
  const [exclude, setExclude] = useState((initial?.exclude ?? []).join('\n'));

  const submit = () => {
    onRun({
      maxPages,
      include: include.split('\n').map(s => s.trim()).filter(Boolean),
      exclude: exclude.split('\n').map(s => s.trim()).filter(Boolean),
    });
  };

  if (!open) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        style={{
          background: 'white',
          width: '680px',
          maxWidth: '95vw',
          borderRadius: 12,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>
          Advanced Audit Options
        </h3>

        <div>
          <label 
            htmlFor="maxPages"
            style={{ 
              display: 'block', 
              fontSize: 14, 
              marginBottom: 8,
              color: '#475569',
              fontWeight: 500,
            }}
          >
            Max pages (10–200)
          </label>
          <input
            id="maxPages"
            type="number"
            min={10}
            max={200}
            value={maxPages}
            onChange={(e) => setMaxPages(parseInt(e.target.value || '100', 10))}
            style={{
              width: 128,
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              padding: '8px 12px',
              color: '#1e293b',
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
            }}
          />
        </div>

        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          <div>
            <label 
              htmlFor="include"
              style={{ 
                display: 'block', 
                fontSize: 14, 
                marginBottom: 8,
                color: '#475569',
                fontWeight: 500,
              }}
            >
              Include (regex per line, optional)
            </label>
            <textarea
              id="include"
              value={include}
              onChange={(e) => setInclude(e.target.value)}
              placeholder="^/$&#10;^/blog/.*&#10;^/docs/.*"
              style={{
                width: '100%',
                height: 128,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#1e293b',
                fontSize: 13,
                fontFamily: 'Monaco, Consolas, monospace',
                resize: 'vertical',
              }}
            />
            <p style={{ 
              fontSize: 12, 
              color: '#64748b', 
              marginTop: 6, 
              marginBottom: 0 
            }}>
              Only keep URLs matching any include pattern.
            </p>
          </div>

          <div>
            <label 
              htmlFor="exclude"
              style={{ 
                display: 'block', 
                fontSize: 14, 
                marginBottom: 8,
                color: '#475569',
                fontWeight: 500,
              }}
            >
              Exclude (regex per line, optional)
            </label>
            <textarea
              id="exclude"
              value={exclude}
              onChange={(e) => setExclude(e.target.value)}
              placeholder="^/tag/.*&#10;^/author/.*&#10;\\?.*utm_.*"
              style={{
                width: '100%',
                height: 128,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#1e293b',
                fontSize: 13,
                fontFamily: 'Monaco, Consolas, monospace',
                resize: 'vertical',
              }}
            />
            <p style={{ 
              fontSize: 12, 
              color: '#64748b', 
              marginTop: 6, 
              marginBottom: 0 
            }}>
              Drop URLs matching any exclude pattern.
            </p>
          </div>
        </div>

        <div 
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
            marginTop: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: 6,
              background: 'white',
              border: '1px solid #e2e8f0',
              color: '#475569',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            style={{
              padding: '10px 20px',
              borderRadius: 6,
              background: '#3b82f6',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Run Audit
          </button>
        </div>
      </div>
    </div>
  );
}


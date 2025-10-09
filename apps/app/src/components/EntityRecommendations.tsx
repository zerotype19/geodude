import { useState } from 'react';

interface Props {
  auditId: string;
  orgName: string;
  recommendations: {
    sameAs_missing: boolean;
    suggestions: string[];
    jsonld_snippet: string;
  };
}

export default function EntityRecommendations({ auditId, orgName, recommendations }: Props) {
  const [applied, setApplied] = useState(() => {
    return localStorage.getItem(`entity_applied_${auditId}`) === 'true';
  });

  const handleMarkApplied = () => {
    const newState = !applied;
    setApplied(newState);
    localStorage.setItem(`entity_applied_${auditId}`, String(newState));
  };

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(recommendations.jsonld_snippet);
      alert('JSON-LD snippet copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!recommendations.sameAs_missing) {
    return null;
  }

  return (
    <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
      <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>🔗</span>
        Entity Graph Recommendations
      </h3>
      
      <p style={{ opacity: 0.9 }}>
        Your Organization schema is missing <code>sameAs</code> links. 
        Add these authoritative profiles to improve AI visibility:
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {recommendations.suggestions.map((url, idx) => {
          const domain = new URL(url).hostname.replace('www.', '');
          const icon = domain.includes('linkedin') ? '💼' :
                       domain.includes('crunchbase') ? '📊' :
                       domain.includes('github') ? '💻' :
                       domain.includes('wikidata') ? '📚' : '🔗';
          
          return (
            <a 
              key={idx}
              href={url} 
              target="_blank" 
              rel="noreferrer"
              style={{
                padding: '6px 12px',
                background: '#1e293b',
                borderRadius: 8,
                border: '1px solid #334155',
                textDecoration: 'none',
                color: '#93c5fd',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{icon}</span>
              {domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)}
            </a>
          );
        })}
      </div>

      <h4 style={{ marginTop: 16, marginBottom: 8 }}>Copy-Paste JSON-LD Snippet</h4>
      <pre style={{
        background: '#0f1115',
        padding: 12,
        borderRadius: 8,
        overflow: 'auto',
        fontSize: 13,
        border: '1px solid #334155'
      }}>
        {recommendations.jsonld_snippet}
      </pre>

      <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
        <button 
          onClick={handleCopySnippet}
          style={{
            background: '#3b82f6',
            border: 'none',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          📋 Copy JSON-LD
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={applied} 
            onChange={handleMarkApplied}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: 14 }}>Mark as applied</span>
        </label>

        {applied && (
          <span style={{ color: '#10b981', fontSize: 14 }}>✅ Applied</span>
        )}
      </div>
    </div>
  );
}


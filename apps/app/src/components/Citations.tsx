import { useEffect, useState } from "react";
import { getCitations, type Citation } from "../services/api";

interface Props {
  auditId: string;
  citations?: Citation[];
}

export default function Citations({ auditId, citations: initialCitations }: Props) {
  const [citations, setCitations] = useState<Citation[]>(initialCitations || []);
  const [loading, setLoading] = useState(!initialCitations || initialCitations.length === 0);

  useEffect(() => {
    if (!initialCitations || initialCitations.length === 0) {
      // Try to fetch from dedicated endpoint
      getCitations(auditId).then((data) => {
        setCitations(data.items);
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    }
  }, [auditId, initialCitations]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 48 }}>Loading citations...</div>;
  }
  if (!citations || citations.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: 48, 
        opacity: 0.7 
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
        <h3 style={{ margin: '0 0 8px 0' }}>No Citations Yet</h3>
        <p style={{ margin: 0, fontSize: 14 }}>
          Your domain hasn't appeared in AI answer sources. 
          Check back after implementing entity graph recommendations.
        </p>
      </div>
    );
  }

  // Group by query
  const byQuery = citations.reduce((acc, c) => {
    if (!acc[c.query]) acc[c.query] = [];
    acc[c.query].push(c);
    return acc;
  }, {} as Record<string, Citation[]>);

  return (
    <div>
      <p style={{ marginTop: 0, opacity: 0.9, fontSize: 14 }}>
        Found {citations.length} citation{citations.length !== 1 ? 's' : ''} 
        where your domain appears in Bing search results:
      </p>
      
      {Object.entries(byQuery).map(([query, results]) => (
        <div key={query} style={{ marginBottom: 24 }}>
          <h4 style={{ 
            margin: '12px 0 8px 0', 
            fontSize: 14, 
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span className="pill info">Bing</span>
            Query: "{query}"
          </h4>
          
          <div style={{ paddingLeft: 16 }}>
            {results.map((citation, idx) => {
              const urlObj = new URL(citation.url);
              return (
                <div 
                  key={idx} 
                  style={{ 
                    padding: 12, 
                    background: '#1a1b1e', 
                    borderRadius: 8,
                    marginBottom: 8,
                    border: '1px solid #2a2b2e'
                  }}
                >
                  <a 
                    href={citation.url} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ 
                      fontWeight: 500, 
                      fontSize: 15,
                      textDecoration: 'none',
                      color: '#93c5fd'
                    }}
                  >
                    {citation.title || citation.url}
                  </a>
                  <div style={{ 
                    fontSize: 12, 
                    opacity: 0.6, 
                    marginTop: 4
                  }}>
                    {urlObj.hostname}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}


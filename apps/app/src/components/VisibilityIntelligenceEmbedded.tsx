import React, { useEffect, useState } from 'react';

interface RankingRow {
  week_start: string;
  assistant: string;
  domain: string;
  domain_rank: number;
  mentions_count: number;
  share_pct: number;
  rank_change: number;
}

interface CitationRow {
  assistant: string;
  source_domain: string;
  url: string;
  occurred_at: string;
  source_type: string;
  title?: string;
  snippet?: string;
}

interface VisibilityIntelligenceEmbeddedProps {
  auditId: string;
  domain: string;
}

const assistants = ["perplexity", "chatgpt_search", "claude"] as const;
type Assistant = typeof assistants[number];

export default function VisibilityIntelligenceEmbedded({ auditId, domain }: VisibilityIntelligenceEmbeddedProps) {
  const [assistant, setAssistant] = useState<Assistant>("perplexity");
  const [rankings, setRankings] = useState<RankingRow[]>([]);
  const [citations, setCitations] = useState<CitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rankingsPage, setRankingsPage] = useState(1);
  const [citationsPage, setCitationsPage] = useState(1);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    
    const fetchData = async () => {
      try {
        const [rankingsRes, citationsRes] = await Promise.all([
          fetch(`https://api.optiview.ai/api/visibility/rankings?assistant=${assistant}&period=7d&limit=100`).then(r => r.json()),
          fetch(`https://api.optiview.ai/api/visibility/citations/recent?domain=${encodeURIComponent(domain)}&limit=50&assistant=${assistant}`).then(r => r.json())
        ]);
        
        if (!mounted) return;
        
        // Handle rankings response
        if (rankingsRes && 'rankings' in rankingsRes) {
          setRankings(rankingsRes.rankings || []);
        } else {
          setRankings([]);
        }
        
        // Handle citations response
        if (Array.isArray(citationsRes)) {
          setCitations(citationsRes || []);
        } else {
          setCitations([]);
        }
      } catch (error) {
        console.error('Error fetching visibility data:', error);
        if (mounted) {
          setError('Failed to load visibility data. Please try again.');
          setRankings([]);
          setCitations([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    fetchData();
    return () => { mounted = false; };
  }, [assistant, auditId]);

  const kpi = {
    uniqueDomains: new Set(rankings.map(r => r.domain)).size,
    totalMentions: rankings.reduce((s, r) => s + (r.mentions_count || 0), 0)
  };

  const getAssistantColor = (assistant: string) => {
    switch (assistant) {
      case 'perplexity': return '#10b981';
      case 'chatgpt_search': return '#3b82f6';
      case 'claude': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '18px', color: '#64748b' }}>Loading visibility data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        background: '#fef2f2', 
        border: '1px solid #fecaca', 
        borderRadius: '8px', 
        padding: '16px',
        color: '#991b1b'
      }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>AI Visibility Intelligence</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {assistants.map(a => (
            <button
              key={a}
              onClick={() => setAssistant(a)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                background: assistant === a ? getAssistantColor(a) : 'white',
                color: assistant === a ? 'white' : '#64748b',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: assistant === a ? '600' : '500',
                transition: 'all 0.2s'
              }}
              title={a.replace('_', ' ')}
            >
              {a.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ 
          background: 'white', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '16px', 
          flex: 1,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Unique Domains (7d)</div>
          <div style={{ fontSize: '32px', fontWeight: '600', color: '#1e293b' }}>
            {kpi.uniqueDomains}
          </div>
        </div>
        <div style={{ 
          background: 'white', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '16px', 
          flex: 1,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Mentions (7d)</div>
          <div style={{ fontSize: '32px', fontWeight: '600', color: '#1e293b' }}>
            {kpi.totalMentions}
          </div>
        </div>
        <div style={{ 
          background: 'white', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '16px', 
          flex: 1,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Assistants</div>
          <div style={{ fontSize: '32px', fontWeight: '600', color: '#1e293b' }}>
            {assistants.length}
          </div>
        </div>
      </div>

      {/* Rankings + Citations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Rankings Table */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              Top Domains — {assistant.replace('_', ' ')}
            </h4>
            <button
              onClick={() => {
                const url = `https://api.optiview.ai/api/visibility/rankings/export?assistant=${assistant}&period=7d&format=csv&limit=100`;
                window.open(url, '_blank');
              }}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              📥 CSV
            </button>
          </div>
          {rankings.length > 0 ? (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#475569' }}>#</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#475569' }}>DOMAIN</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#475569' }}>MENTIONS</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#475569' }}>% SHARE</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.slice(0, 25).map((row, index) => (
                    <tr key={index} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: '600' }}>
                        {row.domain_rank}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {row.domain}
                          {row.domain === domain && (
                            <span style={{ 
                              background: '#dbeafe', 
                              color: '#1e40af', 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontSize: '10px',
                              fontWeight: '500'
                            }}>
                              YOU
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        {row.mentions_count}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        {row.share_pct?.toFixed(1) || '0.0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ 
              padding: '24px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '14px'
            }}>
              No rankings data available for {assistant.replace('_', ' ')} yet.
            </div>
          )}
        </div>

        {/* Recent Citations */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '600' }}>
            Recent Citations
          </h4>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {citations.length > 0 ? (
              <div>
                {citations.slice(0, 20).map((citation, index) => (
                  <div key={index} style={{ 
                    padding: '12px 0', 
                    borderTop: index > 0 ? '1px solid #f1f5f9' : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: getAssistantColor(citation.assistant),
                      flexShrink: 0,
                      marginTop: '6px'
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px', lineHeight: '1.4' }}>
                        <a 
                          href={citation.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: '#3b82f6', textDecoration: 'none' }}
                        >
                          {citation.title || citation.url}
                        </a>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                        {citation.source_domain} • {formatDate(citation.occurred_at)}
                      </div>
                      {citation.snippet && (
                        <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.3' }}>
                          {citation.snippet.slice(0, 100)}...
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <span style={{ 
                        background: '#f3f4f6', 
                        color: '#6b7280', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        fontSize: '10px'
                      }}>
                        {citation.assistant}
                      </span>
                      <span style={{ 
                        background: '#e0e7ff', 
                        color: '#4338ca', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        fontSize: '10px'
                      }}>
                        {citation.source_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ 
                padding: '24px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '14px'
              }}>
                No recent citations from {assistant.replace('_', ' ')} yet.
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Footer Info */}
      <div style={{ 
        background: '#fef3c7', 
        border: '1px solid #f59e0b', 
        borderRadius: '8px', 
        padding: '16px',
        marginTop: '24px'
      }}>
        <p style={{ margin: 0, color: '#92400e', fontSize: '14px' }}>
          <strong>💡 Pro Tip:</strong> Each AI assistant forms its own unique ecosystem of citations. 
          Perplexity favors SEO content, ChatGPT Search cites tech platforms, and Claude references development resources.
        </p>
      </div>
    </div>
  );
}

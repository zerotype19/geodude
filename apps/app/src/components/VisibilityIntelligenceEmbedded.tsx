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

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    
    const fetchData = async () => {
      try {
        const [rankingsRes, citationsRes] = await Promise.all([
          fetch(`https://api.optiview.ai/api/visibility/rankings?assistant=${assistant}&period=7d&limit=25`).then(r => r.json()),
          fetch(`https://api.optiview.ai/api/visibility/citations/recent?projectId=${auditId}&limit=25&assistant=${assistant}`).then(r => r.json())
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
          borderRadius: '8px', 
          padding: '16px', 
          flex: 1,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e40af' }}>
            {kpi.uniqueDomains}
          </div>
          <div style={{ fontSize: '14px', color: '#64748b' }}>Domains Tracked</div>
        </div>
        <div style={{ 
          background: 'white', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px', 
          padding: '16px', 
          flex: 1,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#059669' }}>
            {kpi.totalMentions}
          </div>
          <div style={{ fontSize: '14px', color: '#64748b' }}>Total Mentions</div>
        </div>
        <div style={{ 
          background: 'white', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px', 
          padding: '16px', 
          flex: 1,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#dc2626' }}>
            {citations.length}
          </div>
          <div style={{ fontSize: '14px', color: '#64748b' }}>Recent Citations</div>
        </div>
      </div>

      {/* Rankings Table */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '600' }}>
          Top Domains in {assistant.replace('_', ' ')} (Last 7 Days)
        </h4>
        {rankings.length > 0 ? (
          <div style={{ 
            background: 'white', 
            border: '1px solid #e2e8f0', 
            borderRadius: '8px', 
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#475569' }}>RANK</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#475569' }}>DOMAIN</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#475569' }}>MENTIONS</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#475569' }}>SHARE %</th>
                </tr>
              </thead>
              <tbody>
                {rankings.slice(0, 10).map((row, index) => (
                  <tr key={index} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600' }}>
                      #{row.domain_rank}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%', 
                          background: getAssistantColor(row.assistant) 
                        }} />
                        {row.domain}
                        {row.domain === domain && (
                          <span style={{ 
                            background: '#dbeafe', 
                            color: '#1e40af', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '12px',
                            fontWeight: '500'
                          }}>
                            YOUR DOMAIN
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px' }}>
                      {row.mentions_count}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px' }}>
                      {row.share_pct?.toFixed(1) || '0.0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ 
            background: '#f8fafc', 
            border: '1px solid #e2e8f0', 
            borderRadius: '8px', 
            padding: '24px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            No rankings data available for {assistant.replace('_', ' ')} yet.
          </div>
        )}
      </div>

      {/* Recent Citations */}
      <div>
        <h4 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '600' }}>
          Recent Citations from {assistant.replace('_', ' ')}
        </h4>
        {citations.length > 0 ? (
          <div style={{ 
            background: 'white', 
            border: '1px solid #e2e8f0', 
            borderRadius: '8px', 
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {citations.slice(0, 20).map((citation, index) => (
              <div key={index} style={{ 
                padding: '12px 16px', 
                borderTop: index > 0 ? '1px solid #f1f5f9' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: getAssistantColor(citation.assistant),
                  flexShrink: 0
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '2px' }}>
                    <a 
                      href={citation.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#3b82f6', textDecoration: 'none' }}
                    >
                      {citation.title || citation.url}
                    </a>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {citation.source_domain} • {formatDate(citation.occurred_at)}
                    {citation.source_type && (
                      <span style={{ 
                        background: '#f3f4f6', 
                        color: '#6b7280', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        marginLeft: '8px',
                        fontSize: '11px'
                      }}>
                        {citation.source_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ 
            background: '#f8fafc', 
            border: '1px solid #e2e8f0', 
            borderRadius: '8px', 
            padding: '24px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            No recent citations from {assistant.replace('_', ' ')} yet.
          </div>
        )}
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

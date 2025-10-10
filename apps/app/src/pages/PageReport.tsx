import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { getAuditPage, getPageRecommendations, getAuditCitations, b64u, type PageRecommendations, type Citation, type CitationType } from '../services/api';
import IssuesTable from '../components/IssuesTable';
import { StatCard } from '../components/StatCard';

type TabType = 'overview' | 'recommendations';

export default function PageReport() {
  const { auditId = '', encoded = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabParam = searchParams.get('tab') as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(activeTabParam || 'overview');
  
  const target = useMemo(() => {
    try {
      return b64u.dec(encoded);
    } catch {
      return '';
    }
  }, [encoded]);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  
  const [recs, setRecs] = useState<PageRecommendations | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsErr, setRecsErr] = useState<string | null>(null);
  
  const [citations, setCitations] = useState<Citation[]>([]);
  const [citationsLoading, setCitationsLoading] = useState(false);
  const [citationsTotal, setCitationsTotal] = useState(0);

  useEffect(() => {
    if (!target) {
      setErr('Invalid page URL');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);
    getAuditPage(auditId, target)
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [auditId, target]);
  
  // Fetch citations for this page
  useEffect(() => {
    if (!auditId || !target) return;
    
    // Extract pathname from target URL
    let pathname = '/';
    try {
      pathname = new URL(target).pathname.replace(/\/+$/, '') || '/';
    } catch {
      // If target is already a path, use as-is
      pathname = target.replace(/\/+$/, '') || '/';
    }
    
    setCitationsLoading(true);
    getAuditCitations(auditId, { path: pathname, pageSize: 5 })
      .then(res => {
        setCitations(res.items);
        setCitationsTotal(res.total);
      })
      .catch(err => {
        console.error('Failed to load citations:', err);
      })
      .finally(() => setCitationsLoading(false));
  }, [auditId, target]);
  
  // Fetch recommendations when tab is active
  useEffect(() => {
    if (activeTab !== 'recommendations' || !auditId || !target || recs) return;
    
    const ctrl = new AbortController();
    setRecsLoading(true);
    setRecsErr(null);
    
    getPageRecommendations(auditId, target, ctrl.signal)
      .then(setRecs)
      .catch(e => {
        if (e.name !== 'AbortError') {
          setRecsErr(e.message || 'Failed to load recommendations');
        }
      })
      .finally(() => setRecsLoading(false));
    
    return () => ctrl.abort();
  }, [activeTab, auditId, target, recs]);
  
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  if (loading) return <div style={{padding: '40px', textAlign: 'center'}}>Loading page report…</div>;
  if (err) return <div style={{padding: '40px', textAlign: 'center', color: '#ef4444'}}>Error: {err}</div>;
  if (!data) return null;

  const p = data.page;
  
  const badge = (ok: boolean, label: string) => (
    <span className="pill" style={{
      background: ok ? '#d1fae5' : '#fee2e2',
      color: ok ? '#065f46' : '#991b1b'
    }}>
      {ok ? '✓ ' : '✕ '}{label}
    </span>
  );

  const renderTypeBadge = (type: CitationType) => {
    const styles = {
      AEO: { background: '#8b5cf6', color: 'white' },
      GEO: { background: '#3b82f6', color: 'white' },
      Organic: { background: '#10b981', color: 'white' }
    }[type];

    return (
      <span 
        className="pill" 
        style={{ 
          ...styles,
          marginLeft: 12,
          flexShrink: 0
        }}
      >
        {type}
      </span>
    );
  };

  const formatUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.pathname + u.search + u.hash;
    } catch {
      return url;
    }
  };

  const short = formatUrl(p.url);
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Simple toast notification
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: #10b981; color: white;
        padding: 12px 16px; border-radius: 8px; font-size: 14px; z-index: 9999;
      `;
      toast.textContent = `${label} copied!`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    });
  };
  
  const openSchemaValidator = (json: unknown) => {
    const raw = JSON.stringify(json, null, 2);
    const url = `https://validator.schema.org/#url=data:application/json,${encodeURIComponent(raw)}`;
    window.open(url, '_blank', 'noreferrer');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
        <Link to={`/a/${auditId}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
          ← Back to Audit
        </Link>
        <div style={{ opacity: 0.4 }}>•</div>
        <a href={p.url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14 }}>
          {short}
        </a>
      </div>

      <h1>Page Report</h1>
      <div style={{ color: '#64748b', marginBottom: 24, fontSize: 15 }}>
        {p.title || 'Untitled'} — {p.statusCode || '-'} status
      </div>

      {/* StatCards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 16
      }}>
        <StatCard 
          label="Word Count" 
          value={p.words ?? "—"} 
          tone={(p.words ?? 0) >= 300 ? "good" : (p.words ?? 0) >= 120 ? "warn" : "bad"} 
          sub="Rendered text" 
        />
        <StatCard 
          label="Has H1" 
          value={p.hasH1 ? "Yes" : "No"} 
          tone={p.hasH1 ? "good" : "bad"} 
        />
        <StatCard 
          label="JSON-LD" 
          value={p.jsonLdCount ?? 0} 
          tone={(p.jsonLdCount ?? 0) > 0 ? "good" : "bad"} 
        />
        <StatCard 
          label="FAQ (page)" 
          value={p.faqOnPage ? "Yes" : "—"} 
          tone={p.faqOnPage ? "good" : "neutral"} 
        />
      </div>

      <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {badge(p.score_hints.word_ok, 'Content ≥120 words')}
        {badge(p.score_hints.has_h1, 'H1 present')}
        {badge(p.score_hints.has_json_ld, 'JSON-LD present')}
        {badge(p.score_hints.faq_ok, 'FAQ present')}
      </div>
      
      {/* Tabs */}
      <div className="tabs-container" style={{ marginTop: 24 }}>
        <button
          onClick={() => handleTabChange('overview')}
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
        >
          Overview
        </button>
        <button
          onClick={() => handleTabChange('recommendations')}
          className={`tab-button ${activeTab === 'recommendations' ? 'active' : ''}`}
        >
          Recommendations
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="tab-content">
          <h2 style={{ margin: '0 0 16px', fontSize: '24px', color: '#1e293b' }}>
            Issues on this page ({data.issues.length})
          </h2>
          {data.issues.length > 0 ? (
            <IssuesTable issues={data.issues} />
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: '#10b981' }}>
              No issues found on this page! 🎉
            </div>
          )}
          
          {/* Citations Panel */}
          <h2 style={{ margin: '32px 0 16px', fontSize: '24px', color: '#1e293b' }}>
            Citations ({citationsTotal})
          </h2>
          {citationsLoading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
              Loading citations...
            </div>
          ) : citations.length > 0 ? (
            <>
              <div style={{ marginBottom: 16 }}>
                {citations.map((citation, idx) => {
                  const urlObj = new URL(citation.url);
                  
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        padding: 12, 
                        background: 'white', 
                        borderRadius: 8,
                        marginBottom: 8,
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <a 
                          href={citation.url} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ 
                            fontWeight: 500, 
                            fontSize: 15,
                            textDecoration: 'none',
                            color: '#3b82f6'
                          }}
                        >
                          {citation.title || citation.url}
                        </a>
                        <div style={{ 
                          fontSize: 12, 
                          color: '#64748b', 
                          marginTop: 4
                        }}>
                          {urlObj.hostname} • via {citation.engine}
                        </div>
                      </div>
                      {renderTypeBadge(citation.type)}
                    </div>
                  );
                })}
              </div>
              {citationsTotal > 5 && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <Link
                    to={`/a/${auditId}?tab=citations&path=${encodeURIComponent(target.replace(/\/+$/, '') || '/')}`}
                    style={{
                      display: 'inline-block',
                      padding: '10px 20px',
                      background: '#3b82f6',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    View all {citationsTotal} citations for this page →
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
              No citations found for this page yet.
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'recommendations' && (
        <div className="tab-content">
          {recsLoading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Loading recommendations...
            </div>
          )}
          
          {recsErr && (
            <div style={{
              padding: '16px',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: 8,
              marginBottom: 16
            }}>
              <strong>Error:</strong> {recsErr}
              <button
                onClick={() => {
                  setRecsErr(null);
                  setRecs(null);
                }}
                style={{
                  marginLeft: 12,
                  padding: '4px 8px',
                  background: 'white',
                  border: '1px solid #991b1b',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Retry
              </button>
            </div>
          )}
          
          {recs && !recsLoading && (
            <div>
              {/* Header: Detected intent + Priority */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>Detected Intent</div>
                  <span style={{
                    padding: '6px 12px',
                    background: '#dbeafe',
                    color: '#1e40af',
                    borderRadius: 6,
                    fontSize: 16,
                    fontWeight: 600
                  }}>
                    {recs.inferredType}
                  </span>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>Priority</div>
                  <span style={{
                    padding: '6px 12px',
                    background: recs.priority === 'high' ? '#fee2e2' : recs.priority === 'medium' ? '#fed7aa' : '#d1fae5',
                    color: recs.priority === 'high' ? '#991b1b' : recs.priority === 'medium' ? '#9a3412' : '#065f46',
                    borderRadius: 6,
                    fontSize: 16,
                    fontWeight: 600,
                    textTransform: 'capitalize'
                  }}>
                    {recs.priority}
                  </span>
                </div>
              </div>
              
              {/* Rationale */}
              <div style={{ 
                padding: '12px 16px', 
                background: '#f3f4f6', 
                borderRadius: 8,
                marginBottom: 24,
                fontSize: 14,
                color: '#374151'
              }}>
                {recs.rationale}
              </div>
              
              {/* Missing Schemas */}
              {recs.missingSchemas.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>Missing Schemas</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {recs.missingSchemas.map(schema => (
                      <span key={schema} style={{
                        padding: '4px 12px',
                        background: '#dbeafe',
                        color: '#1e40af',
                        borderRadius: 16,
                        fontSize: 14
                      }}>
                        {schema}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Suggested JSON-LD */}
              {recs.suggestedJsonLd.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 18, color: '#1e293b', fontWeight: 600 }}>Suggested JSON-LD</h3>
                  {recs.suggestedJsonLd.map((suggestion, idx) => (
                    <div key={idx} style={{
                      marginBottom: 16,
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{
                        padding: '12px 16px',
                        background: '#f8fafc',
                        borderBottom: '1px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <strong style={{ color: '#1e293b', fontSize: 14 }}>@type: {suggestion.type}</strong>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(suggestion.json, null, 2), 'JSON-LD')}
                            style={{
                              padding: '6px 12px',
                              background: '#667eea',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontSize: 13
                            }}
                          >
                            Copy JSON
                          </button>
                          <button
                            onClick={() => openSchemaValidator(suggestion.json)}
                            style={{
                              padding: '6px 12px',
                              background: 'white',
                              color: '#667eea',
                              border: '1px solid #667eea',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontSize: 13
                            }}
                          >
                            Validate
                          </button>
                        </div>
                      </div>
                      <pre style={{
                        padding: 16,
                        margin: 0,
                        background: '#0f172a',
                        color: '#f1f5f9',
                        fontSize: 13,
                        lineHeight: 1.6,
                        overflow: 'auto',
                        maxHeight: 400,
                        fontFamily: 'Monaco, Consolas, "Courier New", monospace'
                      }}>
                        {JSON.stringify(suggestion.json, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Copy Blocks */}
              {recs.copyBlocks.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 18, color: '#1e293b', fontWeight: 600 }}>Content Suggestions</h3>
                  {recs.copyBlocks.map((block, idx) => (
                    <div key={idx} style={{
                      marginBottom: 12,
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: 'white'
                    }}>
                      <div style={{
                        padding: '12px 16px',
                        background: '#f8fafc',
                        borderBottom: '1px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <strong style={{ color: '#1e293b', fontSize: 14 }}>{block.label}</strong>
                        <button
                          onClick={() => copyToClipboard(block.content, block.label)}
                          style={{
                            padding: '6px 12px',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 13
                          }}
                        >
                          Copy
                        </button>
                      </div>
                      <div style={{
                        padding: 16,
                        fontSize: 14,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        color: '#334155',
                        background: '#fefefe'
                      }}>
                        {block.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {!recs && !recsLoading && !recsErr && (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <p style={{ color: '#475569', fontSize: 16, margin: '0 0 8px' }}>We didn't detect a strong intent.</p>
              <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>
                Consider adding clearer headings or more structured content.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


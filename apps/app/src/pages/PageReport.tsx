import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { getAuditPage, getPageRecommendations, b64u, type PageRecommendations } from '../services/api';
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
    <span style={{
      padding: '4px 8px',
      borderRadius: 12,
      marginRight: 8,
      background: ok ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
      color: ok ? 'rgb(16,185,129)' : 'rgb(239,68,68)',
      fontSize: 12,
      fontWeight: 600
    }}>
      {label}{ok ? ' ✓' : ' ✕'}
    </span>
  );

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
    <div style={{ maxWidth: 1060, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
        <Link to={`/a/${auditId}`}>← Back to Audit</Link>
        <div style={{ opacity: 0.5 }}>•</div>
        <a href={p.url} target="_blank" rel="noreferrer" style={{ color: '#667eea' }}>
          {short}
        </a>
      </div>

      <h1 style={{ margin: '8px 0 6px', fontSize: '32px' }}>Page Report</h1>
      <div style={{ opacity: 0.7, marginBottom: 16 }}>
        {p.title || 'Untitled'} — {p.statusCode || '-'} status
      </div>
      
      {/* Tabs */}
      <div style={{ 
        borderBottom: '1px solid #e5e7eb', 
        marginBottom: 24,
        display: 'flex',
        gap: 24
      }}>
        <button
          onClick={() => handleTabChange('overview')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 0',
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 500,
            color: activeTab === 'overview' ? '#667eea' : '#6b7280',
            borderBottom: activeTab === 'overview' ? '2px solid #667eea' : 'none',
            marginBottom: -1
          }}
        >
          Overview
        </button>
        <button
          onClick={() => handleTabChange('recommendations')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 0',
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 500,
            color: activeTab === 'recommendations' ? '#667eea' : '#6b7280',
            borderBottom: activeTab === 'recommendations' ? '2px solid #667eea' : 'none',
            marginBottom: -1
          }}
        >
          Recommendations
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
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

      <div style={{ margin: '12px 0 24px' }}>
        {badge(p.score_hints.word_ok, 'Content ≥120 words')}
        {badge(p.score_hints.has_h1, 'H1 present')}
        {badge(p.score_hints.has_json_ld, 'JSON-LD present')}
        {badge(p.score_hints.faq_ok, 'FAQ present')}
      </div>

      {activeTab === 'overview' && (
        <>
          <h2 style={{ margin: '16px 0', fontSize: '24px' }}>
            Issues on this page ({data.issues.length})
          </h2>
          {data.issues.length > 0 ? (
            <IssuesTable issues={data.issues} />
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: '#10b981' }}>
              No issues found on this page! 🎉
            </div>
          )}
        </>
      )}
      
      {activeTab === 'recommendations' && (
        <div>
          {recsLoading && (
            <div style={{ padding: '40px', textAlign: 'center' }}>
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
                  <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 4 }}>Detected Intent</div>
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
                  <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 4 }}>Priority</div>
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
                  <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>Suggested JSON-LD</h3>
                  {recs.suggestedJsonLd.map((suggestion, idx) => (
                    <div key={idx} style={{
                      marginBottom: 16,
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        padding: '12px 16px',
                        background: '#f9fafb',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <strong>@type: {suggestion.type}</strong>
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
                        background: '#1f2937',
                        color: '#e5e7eb',
                        fontSize: 13,
                        lineHeight: 1.6,
                        overflow: 'auto',
                        maxHeight: 400
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
                  <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>Content Suggestions</h3>
                  {recs.copyBlocks.map((block, idx) => (
                    <div key={idx} style={{
                      marginBottom: 12,
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        padding: '12px 16px',
                        background: '#f9fafb',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <strong>{block.label}</strong>
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
                        whiteSpace: 'pre-wrap'
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
              color: '#6b7280'
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <p>We didn't detect a strong intent.</p>
              <p style={{ fontSize: 14, opacity: 0.8 }}>
                Consider adding clearer headings or more structured content.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


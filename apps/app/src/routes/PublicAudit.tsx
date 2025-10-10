import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAudit, rerunAudit, type Audit } from "../services/api";
import ScoreCard from "../components/ScoreCard";
import IssuesTable from "../components/IssuesTable";
import PagesTable from "../components/PagesTable";
import EntityRecommendations from "../components/EntityRecommendations";
import Citations from "../components/Citations";

export default function PublicAudit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scores' | 'issues' | 'pages' | 'citations'>('scores');
  const [rerunning, setRerunning] = useState(false);
  
  const hasApiKey = useMemo(() => !!localStorage.getItem('ov_api_key'), []);

  useEffect(() => {
    (async () => {
      try { 
        if (id) setAudit(await getAudit(id)); 
      } catch (e: any) { 
        setError(e?.message || "Failed to load"); 
      }
    })();
  }, [id]);

  async function handleRerun() {
    if (!id) return;
    try {
      setRerunning(true);
      const result = await rerunAudit(id);
      
      // Show success message before navigating
      const newAuditUrl = `/a/${result.id}`;
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 9999;
        font-size: 14px;
        max-width: 400px;
      `;
      notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">✓ New audit started!</div>
        <div style="opacity: 0.9;">Redirecting to audit ${result.id}...</div>
      `;
      document.body.appendChild(notification);
      
      // Navigate after brief delay to show notification
      setTimeout(() => {
        navigate(newAuditUrl);
      }, 800);
    } catch (e: any) {
      const isRateLimit = e?.message?.includes('Rate limit') || e?.message?.includes('429');
      const message = isRateLimit 
        ? 'Daily audit budget reached. Try again after 00:00 UTC.'
        : e?.message || 'Re-run failed';
      
      // Show error notification
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 9999;
        font-size: 14px;
        max-width: 400px;
        cursor: pointer;
      `;
      notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">✕ Re-run Failed</div>
        <div style="opacity: 0.9;">${message}</div>
        <div style="margin-top: 8px; font-size: 12px; opacity: 0.8;">Click to dismiss</div>
      `;
      notification.onclick = () => notification.remove();
      document.body.appendChild(notification);
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => notification.remove(), 5000);
      
      setRerunning(false);
    }
  }

  if (error) return <div className="card">{error}</div>;
  if (!audit) return <div className="card">Loading…</div>;

  return (
    <>
      {/* Header with Re-run button */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: 16 
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Audit Report</h1>
          {audit.domain && (
            <p style={{ margin: '4px 0 0', fontSize: 14, opacity: 0.7 }}>
              {audit.domain}
            </p>
          )}
        </div>
        {hasApiKey && (
          <button
            onClick={handleRerun}
            disabled={rerunning}
            style={{
              padding: '8px 16px',
              background: rerunning ? '#64748b' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: rerunning ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
            title="Start a fresh audit for this property"
          >
            {rerunning ? (
              <>
                <span style={{ 
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}>
                  <style>{`
                    @keyframes spin {
                      to { transform: rotate(360deg); }
                    }
                  `}</style>
                </span>
                <span>Re-running…</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Re-run Audit</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="row">
        <ScoreCard title="Overall" value={audit.scores.total}/>
        
        <div style={{ flex: 1 }}>
          <ScoreCard title="Crawlability" value={audit.scores.crawlability}/>
          {audit.scores.breakdown?.crawlability && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 12,
                background: audit.scores.breakdown.crawlability.robotsTxtFound ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
                color: audit.scores.breakdown.crawlability.robotsTxtFound ? '#10b981' : '#ef4444',
              }}>
                robots.txt {audit.scores.breakdown.crawlability.robotsTxtFound ? '✓' : '✗'}
              </span>
              <span style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 12,
                background: audit.scores.breakdown.crawlability.sitemapOk ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
                color: audit.scores.breakdown.crawlability.sitemapOk ? '#10b981' : '#ef4444',
              }}>
                sitemap {audit.scores.breakdown.crawlability.sitemapOk ? '✓' : '✗'}
              </span>
              <span style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 12,
                background: 'rgba(100,116,139,.15)',
                color: '#64748b',
              }} title="AI bots allowed">
                AI bots: {Object.values(audit.scores.breakdown.crawlability.aiBots).filter(Boolean).length}/{Object.keys(audit.scores.breakdown.crawlability.aiBots).length}
              </span>
            </div>
          )}
        </div>
        
        <div style={{ flex: 1 }}>
          <ScoreCard title="Structured" value={audit.scores.structured}/>
          {audit.scores.breakdown?.structured && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 12,
                background: audit.scores.breakdown.structured.faqSite ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
                color: audit.scores.breakdown.structured.faqSite ? '#10b981' : '#ef4444',
              }}>
                FAQ on site {audit.scores.breakdown.structured.faqSite ? '✓' : '✗'}
              </span>
              <span style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 12,
                background: 'rgba(56,189,248,.15)',
                color: '#38bdf8',
              }}>
                JSON-LD {Math.round(audit.scores.breakdown.structured.jsonLdCoveragePct)}%
              </span>
              {audit.scores.breakdown.structured.schemaTypes.length > 0 && (
                <span style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 12,
                  background: 'rgba(99,102,241,.15)',
                  color: '#6366f1',
                }} title={audit.scores.breakdown.structured.schemaTypes.join(', ')}>
                  Schemas: {audit.scores.breakdown.structured.schemaTypes.length}
                </span>
              )}
            </div>
          )}
        </div>
        
        <ScoreCard title="Answerability" value={audit.scores.answerability}/>
        <ScoreCard title="Trust" value={audit.scores.trust}/>
      </div>

      {audit.entity_recommendations && (
        <EntityRecommendations
          auditId={audit.id}
          orgName={audit.domain || 'Organization'}
          recommendations={audit.entity_recommendations}
        />
      )}

      <div style={{display:'flex', gap:12, marginTop:16, marginBottom:8}}>
        {(['scores', 'issues', 'pages', 'citations'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              background: activeTab === tab ? '#3b82f6' : '#1e293b',
              border: 'none',
              color: activeTab === tab ? 'white' : '#94a3b8',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'scores' && (
          <div>
            <h3 style={{marginTop:0}}>Score Breakdown</h3>
            <p style={{opacity:0.8}}>Overall score: {Math.max(0, Math.min(100, Math.round(audit.scores.total || 0)))}%</p>
          </div>
        )}
        {activeTab === 'issues' && (
          <>
            <h3 style={{marginTop:0}}>Issues</h3>
            <IssuesTable issues={audit.issues || []}/>
          </>
        )}
        {activeTab === 'pages' && (
          <>
            <h3 style={{marginTop:0}}>Pages</h3>
            <PagesTable pages={audit.pages || []}/>
          </>
        )}
        {activeTab === 'citations' && (
          <>
            <h3 style={{marginTop:0}}>Citations</h3>
            <Citations auditId={id!} citations={audit.citations}/>
          </>
        )}
      </div>
    </>
  );
}


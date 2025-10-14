import { useState, useEffect } from "react";
import { useApiKey } from "../hooks/useApiKey";
import { startAudit, getAudit, type Audit } from "../services/api";
import { Link } from "react-router-dom";
import ScoreCard from "../components/ScoreCard";
import IssuesTable from "../components/IssuesTable";
import PagesTable from "../components/PagesTable";
import EntityRecommendations from "../components/EntityRecommendations";
import Citations from "../components/Citations";
import VisibilityIntelligenceEmbedded from "../components/VisibilityIntelligenceEmbedded";
import AdvancedRunDrawer from "../components/AdvancedRunDrawer";

export default function Dashboard() {
  const { apiKey, save, clear } = useApiKey();
  const [url, setUrl] = useState(""); // Demo mode: just enter a URL
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scores' | 'issues' | 'pages' | 'citations' | 'visibility'>('scores');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [recentAudits, setRecentAudits] = useState<Array<{id: string; url: string; timestamp: number}>>([]);
  const [advancedOpts, setAdvancedOpts] = useState<{
    maxPages?: number;
    include?: string[];
    exclude?: string[];
  }>(() => {
    try {
      return JSON.parse(localStorage.getItem('auditAdvanced') || '{}');
    } catch {
      return {};
    }
  });

  // Load recent audits from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentAudits');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Filter out invalid entries (missing id, url, or timestamp)
        const valid = parsed.filter((a: any) => 
          a && 
          typeof a.id === 'string' && 
          typeof a.url === 'string' && 
          typeof a.timestamp === 'number' && 
          a.timestamp > 0
        );
        setRecentAudits(valid);
        // Clean up localStorage if we filtered anything out
        if (valid.length !== parsed.length) {
          localStorage.setItem('recentAudits', JSON.stringify(valid));
        }
      }
    } catch {
      setRecentAudits([]);
      localStorage.removeItem('recentAudits');
    }
  }, []);

  async function runAudit() {
    setError(null); 
    setLoading(true);
    setShowAdvanced(false);
    
    // Normalize URL
    let normalizedUrl = url.trim();
    if (normalizedUrl && !normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    if (!normalizedUrl) {
      setError("Please enter a URL");
      setLoading(false);
      return;
    }
    
    try {
      const { id } = await startAudit({
        url: normalizedUrl, // Demo mode: pass URL directly, no property_id needed
        maxPages: advancedOpts.maxPages,
        filters: {
          include: advancedOpts.include,
          exclude: advancedOpts.exclude,
        },
      });
      const full = await getAudit(id);
      setAudit(full);
      
      // Save to recent audits with metadata
      try {
        const stored = localStorage.getItem('recentAudits');
        const existing: Array<{id: string; url: string; timestamp: number}> = stored ? JSON.parse(stored) : [];
        const newAudit = { id, url: normalizedUrl, timestamp: Date.now() };
        const updated = [newAudit, ...existing.filter((a) => a.id !== id)].slice(0, 20); // Keep last 20
        localStorage.setItem('recentAudits', JSON.stringify(updated));
        setRecentAudits(updated);
      } catch {}
      
      // copy share link to clipboard for convenience
      const share = `${location.origin}/a/${id}`;
      try { 
        await navigator.clipboard.writeText(share); 
      } catch {}
    } catch (e: any) {
      setError(e?.message || "Failed to run audit");
    } finally {
      setLoading(false);
    }
  }

  function handleAdvancedRun(opts: { maxPages?: number; include?: string[]; exclude?: string[] }) {
    setAdvancedOpts(opts);
    localStorage.setItem('auditAdvanced', JSON.stringify(opts));
    runAudit();
  }

  useEffect(() => {
    // Keep localStorage in sync
    localStorage.setItem('auditAdvanced', JSON.stringify(advancedOpts));
  }, [advancedOpts]);

  return (
    <>
      <h1>Optiview — AI SEO Audit & Visibility Intelligence</h1>
      
      {import.meta.env.VITE_FEATURE_PHASE5_ANALYTICS === "true" && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', color: 'white', marginBottom: '24px' }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            🚀 New: Visibility Intelligence v1.0
          </div>
          <div style={{ fontSize: 14, marginBottom: 16, opacity: 0.9 }}>
            Track how AI assistants (Perplexity, ChatGPT Search, Claude) reference your content with real-time citations, 0-100 visibility scores, and competitive rankings.
          </div>
          <Link 
            to="/insights/visibility" 
            style={{ 
              display: 'inline-block', 
              background: 'white', 
              color: '#3b82f6', 
              padding: '8px 16px', 
              borderRadius: '6px', 
              textDecoration: 'none', 
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            Explore Visibility Intelligence →
          </Link>
        </div>
      )}

      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#475569' }}>
          Enter a website URL to audit
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input 
            placeholder="yoursite.com" 
            value={url} 
            onChange={e => setUrl(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && !loading && runAudit()}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: 16,
              border: '2px solid #e2e8f0',
              borderRadius: 8
            }}
          />
          <button 
            onClick={runAudit} 
            disabled={loading}
            style={{
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              background: loading ? '#94a3b8' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? "Running..." : "Run Audit"}
          </button>
          <button 
            onClick={() => setShowAdvanced(true)} 
            disabled={loading}
            style={{
              padding: '12px 16px',
              fontSize: 14,
              background: loading ? '#f8fafc' : 'white',
              color: loading ? '#cbd5e1' : '#475569',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            Advanced...
          </button>
        </div>
        {audit?.id && (
          <div style={{ marginTop: 16, padding: 12, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6 }}>
            <span style={{ color: '#166534', fontSize: 14 }}>
              ✓ Share link copied: <code style={{ background: 'white', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>{`${location.origin}/a/${audit.id}`}</code>
            </span>
          </div>
        )}
        {error && (
          <div style={{ marginTop: 16, padding: 12, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, color: '#991b1b' }}>
            {error}
          </div>
        )}
      </div>

      <AdvancedRunDrawer
        open={showAdvanced}
        onClose={() => setShowAdvanced(false)}
        onRun={handleAdvancedRun}
        initial={advancedOpts}
      />

      {/* Recent Audits */}
      <div className="card" style={{ marginTop: 24 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Recent Audits</h2>
        {recentAudits.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentAudits.map((audit) => (
              <Link
                key={audit.id}
                to={`/a/${audit.id}`}
                style={{
                  padding: '12px 16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div>
                  <div style={{ color: '#3b82f6', fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
                    {audit.url}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 12, fontFamily: 'Monaco, Consolas, monospace' }}>
                    {audit.id}
                  </div>
                </div>
                <div style={{ color: '#64748b', fontSize: 12 }}>
                  {new Date(audit.timestamp).toLocaleDateString()} {new Date(audit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
            No recent audits. Run an audit above to see it appear here.
          </p>
        )}
      </div>

      {audit && (
        <>
          <div className="row">
            <ScoreCard title="Overall" value={audit.scores.total}/>
            <ScoreCard title="Crawlability" value={audit.scores.crawlabilityPct || (audit.scores.crawlability / 42 * 100)}/>
            <ScoreCard title="Structured" value={audit.scores.structuredPct || (audit.scores.structured / 30 * 100)}/>
            <ScoreCard title="Answerability" value={audit.scores.answerabilityPct || (audit.scores.answerability / 20 * 100)}/>
            <ScoreCard title="Trust" value={audit.scores.trustPct || (audit.scores.trust / 10 * 100)}/>
          </div>

          {audit.entity_recommendations && (
            <EntityRecommendations
              auditId={audit.id}
              orgName={audit.domain || 'Organization'}
              recommendations={audit.entity_recommendations}
            />
          )}

          <div className="tabs-container" style={{ marginTop: 24 }}>
            {(['scores', 'issues', 'pages', 'citations'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`tab-button ${activeTab === tab ? 'active' : ''}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
            {import.meta.env.VITE_FEATURE_PHASE5_ANALYTICS === "true" && (
              <button
                onClick={() => setActiveTab('visibility')}
                className={`tab-button ${activeTab === 'visibility' ? 'active' : ''}`}
              >
                Visibility Intelligence
              </button>
            )}
          </div>

          <div className="tab-content">
            {activeTab === 'scores' && (
              <div>
                <h3 style={{ marginTop: 0 }}>Score Breakdown</h3>
                <p style={{ color: '#64748b' }}>Overall score: {Math.max(0, Math.min(100, Math.round(audit.scores.total || 0)))}%</p>
              </div>
            )}
            {activeTab === 'issues' && (
              <IssuesTable issues={audit.issues || []}/>
            )}
            {activeTab === 'pages' && (
              <PagesTable pages={audit.pages || []} auditId={audit.id}/>
            )}
            {activeTab === 'citations' && (
              <Citations auditId={audit.id} citations={audit.citations}/>
            )}
            {activeTab === 'visibility' && import.meta.env.VITE_FEATURE_PHASE5_ANALYTICS === "true" && (
              <VisibilityIntelligenceEmbedded auditId={audit.id} domain={audit.domain || audit.url} />
            )}
          </div>
        </>
      )}
    </>
  );
}


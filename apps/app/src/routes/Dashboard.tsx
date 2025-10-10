import { useState, useEffect } from "react";
import { useApiKey } from "../hooks/useApiKey";
import { startAudit, getAudit, type Audit } from "../services/api";
import { Link } from "react-router-dom";
import ScoreCard from "../components/ScoreCard";
import IssuesTable from "../components/IssuesTable";
import PagesTable from "../components/PagesTable";
import EntityRecommendations from "../components/EntityRecommendations";
import Citations from "../components/Citations";
import AdvancedRunDrawer from "../components/AdvancedRunDrawer";

export default function Dashboard() {
  const { apiKey, save, clear } = useApiKey();
  const [propertyId, setPropertyId] = useState("prop_demo");
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scores' | 'issues' | 'pages' | 'citations'>('scores');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [recentAudits, setRecentAudits] = useState<string[]>([]);
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
        setRecentAudits(parsed);
      } else {
        // Pre-populate with a known test audit for convenience
        const defaultAudits = ['aud_1760106208554_tfmderif4'];
        setRecentAudits(defaultAudits);
        localStorage.setItem('recentAudits', JSON.stringify(defaultAudits));
      }
    } catch {
      setRecentAudits([]);
    }
  }, []);

  async function runAudit() {
    setError(null); 
    setLoading(true);
    setShowAdvanced(false);
    
    try {
      const { id } = await startAudit({
        property_id: propertyId,
        apiKey,
        maxPages: advancedOpts.maxPages,
        filters: {
          include: advancedOpts.include,
          exclude: advancedOpts.exclude,
        },
      });
      const full = await getAudit(id);
      setAudit(full);
      
      // Save to recent audits
      try {
        const stored = localStorage.getItem('recentAudits');
        const existing = stored ? JSON.parse(stored) : [];
        const updated = [id, ...existing.filter((aid: string) => aid !== id)].slice(0, 10); // Keep last 10
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
      <h1>Optiview — Dashboard</h1>
      
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#475569' }}>API Key</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                placeholder="prj_live_..." 
                value={apiKey} 
                onChange={e => save(e.target.value)} 
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: 'Monaco, Consolas, monospace'
                }}
              />
              <button 
                onClick={clear}
                style={{
                  padding: '8px 16px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                Clear
              </button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#475569' }}>Property ID</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                value={propertyId} 
                onChange={e => setPropertyId(e.target.value)} 
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: 'Monaco, Consolas, monospace'
                }}
              />
              <button 
                onClick={runAudit} 
                disabled={!apiKey || loading}
                style={{
                  padding: '8px 16px',
                  background: (!apiKey || loading) ? '#cbd5e1' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: (!apiKey || loading) ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                {loading ? "Running..." : "Run Audit"}
              </button>
              <button 
                onClick={() => setShowAdvanced(true)} 
                disabled={!apiKey || loading}
                style={{
                  padding: '8px 16px',
                  background: (!apiKey || loading) ? '#f8fafc' : 'white',
                  color: (!apiKey || loading) ? '#cbd5e1' : '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  cursor: (!apiKey || loading) ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                Advanced...
              </button>
            </div>
          </div>
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
            {recentAudits.map((auditId) => (
              <Link
                key={auditId}
                to={`/a/${auditId}`}
                style={{
                  padding: '12px 16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  textDecoration: 'none',
                  color: '#3b82f6',
                  fontSize: 14,
                  fontFamily: 'Monaco, Consolas, monospace',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                <span>{auditId}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
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
            <ScoreCard title="Crawlability" value={audit.scores.crawlability}/>
            <ScoreCard title="Structured" value={audit.scores.structured}/>
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
          </div>
        </>
      )}
    </>
  );
}


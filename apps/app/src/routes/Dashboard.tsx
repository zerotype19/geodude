import { useState } from "react";
import { useApiKey } from "../hooks/useApiKey";
import { startAudit, getAudit, type Audit } from "../services/api";
import ScoreCard from "../components/ScoreCard";
import IssuesTable from "../components/IssuesTable";
import PagesTable from "../components/PagesTable";
import EntityRecommendations from "../components/EntityRecommendations";
import Citations from "../components/Citations";

export default function Dashboard() {
  const { apiKey, save, clear } = useApiKey();
  const [propertyId, setPropertyId] = useState("prop_demo");
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scores' | 'issues' | 'pages' | 'citations'>('scores');

  async function runAudit() {
    setError(null); 
    setLoading(true);
    
    try {
      const { id } = await startAudit(propertyId, apiKey);
      const full = await getAudit(id);
      setAudit(full);
      
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

  return (
    <>
      <div className="card">
        <div className="row" style={{alignItems:"center"}}>
          <div>
            <div>API Key</div>
            <div style={{display:"flex",gap:8,marginTop:6}}>
              <input 
                placeholder="x-api-key" 
                value={apiKey} 
                onChange={e => save(e.target.value)} 
                style={{minWidth:300}}
              />
              <button onClick={clear}>Clear</button>
            </div>
          </div>
          <div>
            <div>Property ID</div>
            <div style={{display:"flex",gap:8,marginTop:6}}>
              <input 
                value={propertyId} 
                onChange={e => setPropertyId(e.target.value)} 
              />
              <button 
                onClick={runAudit} 
                disabled={!apiKey || loading}
              >
                {loading ? "Running..." : "Run Audit"}
              </button>
            </div>
          </div>
        </div>
        {audit?.id && (
          <div style={{marginTop:8}}>
            Share link copied: <code>{`${location.origin}/a/${audit.id}`}</code>
          </div>
        )}
        {error && <div style={{marginTop:8, color:"#fca5a5"}}>{error}</div>}
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
                <p style={{opacity:0.8}}>Overall score: {Math.round((audit.scores.total || 0) * 100)}%</p>
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
                <Citations auditId={audit.id} citations={audit.citations}/>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}


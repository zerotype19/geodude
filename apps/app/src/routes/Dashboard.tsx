import { useState } from "react";
import { useApiKey } from "../hooks/useApiKey";
import { startAudit, getAudit, type Audit } from "../services/api";
import ScoreCard from "../components/ScoreCard";
import IssuesTable from "../components/IssuesTable";
import PagesTable from "../components/PagesTable";

export default function Dashboard() {
  const { apiKey, save, clear } = useApiKey();
  const [propertyId, setPropertyId] = useState("prop_demo");
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState<string | null>(null);

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

          <div className="card">
            <h3 style={{marginTop:0}}>Issues</h3>
            <IssuesTable issues={audit.issues || []}/>
          </div>

          <div className="card">
            <h3 style={{marginTop:0}}>Pages</h3>
            <PagesTable pages={audit.pages || []}/>
          </div>
        </>
      )}
    </>
  );
}


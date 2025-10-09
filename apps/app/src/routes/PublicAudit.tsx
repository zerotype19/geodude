import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getAudit, type Audit } from "../services/api";
import ScoreCard from "../components/ScoreCard";
import IssuesTable from "../components/IssuesTable";
import PagesTable from "../components/PagesTable";
import EntityRecommendations from "../components/EntityRecommendations";
import Citations from "../components/Citations";

export default function PublicAudit() {
  const { id } = useParams();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scores' | 'issues' | 'pages' | 'citations'>('scores');

  useEffect(() => {
    (async () => {
      try { 
        if (id) setAudit(await getAudit(id)); 
      } catch (e: any) { 
        setError(e?.message || "Failed to load"); 
      }
    })();
  }, [id]);

  if (error) return <div className="card">{error}</div>;
  if (!audit) return <div className="card">Loading…</div>;

  return (
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
            <Citations auditId={id!} citations={audit.citations}/>
          </>
        )}
      </div>
    </>
  );
}


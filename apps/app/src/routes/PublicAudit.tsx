import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getAudit, type Audit } from "../services/api";
import ScoreCard from "../components/ScoreCard";
import IssuesTable from "../components/IssuesTable";
import PagesTable from "../components/PagesTable";
import EntityRecommendations from "../components/EntityRecommendations";

export default function PublicAudit() {
  const { id } = useParams();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      <div className="card">
        <h3 style={{marginTop:0}}>Issues</h3>
        <IssuesTable issues={audit.issues || []}/>
      </div>

      <div className="card">
        <h3 style={{marginTop:0}}>Pages</h3>
        <PagesTable pages={audit.pages || []}/>
      </div>
    </>
  );
}


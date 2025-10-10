export default function ScoreCard({ title, value }: { title: string; value: number }) {
  // Backend returns 0-100 already, just clamp and format
  const pct = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  
  return (
    <div className="card" style={{minWidth:180}}>
      <div style={{color: '#64748b', fontSize:13, marginBottom: 8}}>{title}</div>
      <div style={{fontSize:32, fontWeight:700, color: '#1e293b'}}>
        {pct}<span style={{fontSize:18}}>%</span>
      </div>
    </div>
  );
}


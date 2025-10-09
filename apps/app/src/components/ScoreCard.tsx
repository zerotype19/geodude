export default function ScoreCard({ title, value }: { title: string; value: number }) {
  const pct = Math.round((value ?? 0) * 100);
  
  return (
    <div className="card" style={{minWidth:180}}>
      <div style={{opacity:.8, fontSize:13}}>{title}</div>
      <div style={{fontSize:32, fontWeight:700}}>
        {pct}<span style={{fontSize:18}}>%</span>
      </div>
    </div>
  );
}


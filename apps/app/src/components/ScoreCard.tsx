export default function ScoreCard({ title, value }: { title: string; value: number }) {
  // Backend returns 0-100 already, just clamp and format
  const pct = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  
  // Color coding based on score thresholds
  const getScoreColor = (score: number): { bg: string; text: string; border: string } => {
    if (score > 70) return { 
      bg: 'rgba(16, 185, 129, 0.1)', 
      text: '#10b981', 
      border: '#10b981' 
    }; // Green - Excellent (>70%)
    if (score >= 40) return { 
      bg: 'rgba(251, 191, 36, 0.1)', 
      text: '#f59e0b', 
      border: '#f59e0b' 
    }; // Orange - Good (40-70%)
    return { 
      bg: 'rgba(239, 68, 68, 0.1)', 
      text: '#ef4444', 
      border: '#ef4444' 
    }; // Red - Needs Work (<40%)
  };
  
  const colors = getScoreColor(pct);
  
  return (
    <div className="card" style={{
      minWidth: 180,
      background: colors.bg,
      borderLeft: `4px solid ${colors.border}`
    }}>
      <div style={{color: '#64748b', fontSize:13, marginBottom: 8}}>{title}</div>
      <div style={{fontSize:32, fontWeight:700, color: colors.text}}>
        {pct}<span style={{fontSize:18}}>%</span>
      </div>
    </div>
  );
}


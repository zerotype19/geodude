interface Citation {
  engine: string;
  query: string;
  url: string;
  title: string | null;
  cited_at: number;
}

interface Props {
  citations: Citation[];
}

export default function Citations({ citations }: Props) {
  if (!citations || citations.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: 48, 
        opacity: 0.7 
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
        <h3 style={{ margin: '0 0 8px 0' }}>No Citations Yet</h3>
        <p style={{ margin: 0, fontSize: 14 }}>
          Your domain hasn't appeared in AI answer sources. 
          Check back after implementing entity graph recommendations.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ marginTop: 0, opacity: 0.9, fontSize: 14 }}>
        Found {citations.length} citation{citations.length !== 1 ? 's' : ''} where your domain appears in AI sources:
      </p>
      
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: 8, borderBottom: '1px solid #1f2937', textAlign: 'left' }}>Engine</th>
            <th style={{ padding: 8, borderBottom: '1px solid #1f2937', textAlign: 'left' }}>Query</th>
            <th style={{ padding: 8, borderBottom: '1px solid #1f2937', textAlign: 'left' }}>URL</th>
            <th style={{ padding: 8, borderBottom: '1px solid #1f2937', textAlign: 'left' }}>When</th>
          </tr>
        </thead>
        <tbody>
          {citations.map((citation, idx) => (
            <tr key={idx}>
              <td style={{ padding: 8, borderBottom: '1px solid #1f2937' }}>
                <span className="pill info">{citation.engine}</span>
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #1f2937', fontSize: 14 }}>
                {citation.query}
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #1f2937', fontSize: 14 }}>
                <a href={citation.url} target="_blank" rel="noreferrer">
                  {citation.title || citation.url}
                </a>
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #1f2937', fontSize: 13, opacity: 0.7 }}>
                {new Date(citation.cited_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


import type { AuditIssue } from "../services/api";

function badge(sev: string) {
  const s = sev.toLowerCase();
  if (s.startsWith("crit")) {
    return <span className="pill high">{sev}</span>;
  }
  if (s.startsWith("warn")) {
    return <span className="pill warn">{sev}</span>;
  }
  return <span className="pill info">{sev}</span>;
}

function formatUrl(url?: string) {
  if (!url) return "-";
  try {
    const u = new URL(url);
    return u.pathname + u.search + u.hash;
  } catch {
    return url;
  }
}

export default function IssuesTable({ issues }: { issues: AuditIssue[] }) {
  if (!issues?.length) return <div>No issues 🎉</div>;
  
  return (
    <table style={{ width: "100%", fontSize: "14px" }}>
      <thead>
        <tr>
          <th style={{ width: "100px" }}>Severity</th>
          <th style={{ width: "120px" }}>Category</th>
          <th>Message</th>
          <th style={{ width: "250px" }}>Page</th>
        </tr>
      </thead>
      <tbody>
        {issues.map((i, idx) => (
          <tr key={idx}>
            <td>{badge(i.severity)}</td>
            <td style={{ textTransform: "capitalize" }}>{i.category}</td>
            <td>{i.message}</td>
            <td style={{ fontSize: "12px", wordBreak: "break-all" }}>
              {i.url ? (
                <a 
                  href={i.url} 
                  target="_blank" 
                  rel="noreferrer"
                  title={i.url}
                  style={{ color: "#667eea" }}
                >
                  {formatUrl(i.url)}
                </a>
              ) : (
                <span style={{ color: "#999" }}>—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}


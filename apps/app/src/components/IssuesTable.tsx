import type { AuditIssue } from "../services/api";

function badge(sev: string) {
  const cls = sev.toLowerCase().startsWith("crit") ? "pill high" :
              sev.toLowerCase().startsWith("warn") ? "pill warn" : "pill info";
  return <span className={cls}>{sev}</span>;
}

export default function IssuesTable({ issues }: { issues: AuditIssue[] }) {
  if (!issues?.length) return <div>No issues 🎉</div>;
  
  return (
    <table>
      <thead>
        <tr>
          <th>Severity</th>
          <th>Category</th>
          <th>Code</th>
          <th>Message</th>
          <th>Page</th>
        </tr>
      </thead>
      <tbody>
        {issues.map((i, idx) => (
          <tr key={idx}>
            <td>{badge(i.severity)}</td>
            <td>{i.category}</td>
            <td><code>{i.code}</code></td>
            <td>{i.message}</td>
            <td>
              {i.url ? (
                <a href={i.url} target="_blank" rel="noreferrer">open</a>
              ) : "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}


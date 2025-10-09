import { Link, useLocation } from "react-router-dom";
import type { AuditPage } from "../services/api";
import { b64u } from "../services/api";

function formatUrl(url: string) {
  try {
    const u = new URL(url);
    return u.pathname + u.search + u.hash;
  } catch {
    return url;
  }
}

export default function PagesTable({ pages }: { pages: AuditPage[] }) {
  const location = useLocation();
  // Extract audit ID from path: /a/:auditId
  const auditId = location.pathname.split('/')[2] || '';

  if (!pages?.length) return <div>No pages captured.</div>;
  
  return (
    <table>
      <thead>
        <tr>
          <th>URL</th>
          <th>Status</th>
          <th>Title</th>
          <th>JSON-LD</th>
          <th>FAQ</th>
        </tr>
      </thead>
      <tbody>
        {pages.map((p, idx) => (
          <tr key={idx}>
            <td style={{
              maxWidth: 420, 
              overflow: "hidden", 
              textOverflow: "ellipsis", 
              whiteSpace: "nowrap"
            }}>
              {auditId ? (
                <Link
                  to={`/a/${auditId}/p/${b64u.enc(p.url)}`}
                  title={p.url}
                  style={{ color: "#667eea" }}
                >
                  {formatUrl(p.url)}
                </Link>
              ) : (
                <a href={p.url} target="_blank" rel="noreferrer">{formatUrl(p.url)}</a>
              )}
            </td>
            <td>{p.http_status ?? "-"}</td>
            <td>{p.title ?? "-"}</td>
            <td>{p.jsonld_types ?? "-"}</td>
            <td>{p.has_faq ? "Yes" : "No"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}


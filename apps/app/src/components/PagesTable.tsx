import type { AuditPage } from "../services/api";

export default function PagesTable({ pages }: { pages: AuditPage[] }) {
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
              <a href={p.url} target="_blank" rel="noreferrer">{p.url}</a>
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


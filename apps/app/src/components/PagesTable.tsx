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
  
  // Only show FAQ column if any page has FAQPage JSON-LD
  const anyFaq = pages.some(p => p.faqOnPage === true);
  
  return (
    <table>
      <thead>
        <tr>
          <th>URL</th>
          <th title="HTTP status code. 0 = unknown (timeout/network error)">Status</th>
          <th>Title</th>
          <th style={{ textAlign: 'right' }}>Words</th>
          <th>JSON-LD</th>
          {anyFaq && (
            <th title="Only shows 'Yes' when this page has a FAQPage JSON-LD block. FAQ is primarily a site-level signal.">
              FAQ (page)
            </th>
          )}
          <th style={{ textAlign: 'right' }} title="Number of AI citations to this page">Cites</th>
          <th style={{ textAlign: 'right' }} title="Number of Brave AI answer citations to this page">AI (Brave)</th>
          <th style={{ textAlign: 'right' }} title="Real AI bot crawler hits in last 30 days">AI Hits</th>
        </tr>
      </thead>
      <tbody>
        {pages.map((p, idx) => {
          const words = p.words ?? 0;
          const tooltip = p.snippet 
            ? `${p.url}\n\nSnippet: ${p.snippet}` 
            : p.url;
          
          return (
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
                    title={tooltip}
                    style={{ color: "#667eea" }}
                  >
                    {formatUrl(p.url)}
                  </Link>
                ) : (
                  <a href={p.url} target="_blank" rel="noreferrer" title={tooltip}>
                    {formatUrl(p.url)}
                  </a>
                )}
              </td>
              <td>{p.statusCode ?? "—"}</td>
              <td style={{
                maxWidth: 300,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}>
                {p.title ?? "—"}
              </td>
              <td style={{ textAlign: 'right' }}>
                {typeof words === 'number' && words > 0 ? (
                  <span style={{ 
                    color: words < 120 ? '#ef4444' : words < 300 ? '#f59e0b' : '#10b981',
                    fontWeight: words < 120 ? 'bold' : 'normal'
                  }}>
                    {words}
                  </span>
                ) : (
                  <span style={{ color: '#999' }}>—</span>
                )}
              </td>
              <td>{p.jsonLdCount ?? 0}</td>
              {anyFaq && <td>{p.faqOnPage ? "Yes" : "—"}</td>}
              <td style={{ textAlign: 'right' }} className="tabular-nums">
                {(p.citationCount ?? 0) > 0 && auditId ? (
                  <Link
                    to={`/a/${auditId}?tab=citations&path=${encodeURIComponent(formatUrl(p.url))}`}
                    style={{ color: '#667eea', textDecoration: 'underline', cursor: 'pointer' }}
                    title="View citations to this page"
                  >
                    {p.citationCount}
                  </Link>
                ) : (
                  <span>{p.citationCount ?? 0}</span>
                )}
              </td>
              <td style={{ textAlign: 'right' }} className="tabular-nums">
                {(p.aiAnswers ?? 0) > 0 && auditId ? (
                  <Link
                    to={`/a/${auditId}?tab=citations&provider=Brave&isAIOffered=true&path=${encodeURIComponent(formatUrl(p.url))}`}
                    style={{ color: '#6366f1', textDecoration: 'underline', cursor: 'pointer' }}
                    title={
                      p.aiAnswerQueries?.length
                        ? `Cited by ${p.aiAnswers} Brave AI answer${p.aiAnswers === 1 ? '' : 's'}\n\nTop queries:\n${
                            p.aiAnswerQueries
                              .map((q: string, idx: number) => {
                                const m = p.aiAnswerMappings?.[idx];
                                const via = m?.reason
                                  ? (m.reason === 'title_fuzzy' ? 'title match' : m.reason)
                                  : '';
                                return `• ${q}${via ? ` (via ${via})` : ''}`;
                              })
                              .join('\n')
                          }`
                        : 'No Brave AI answers cited this page (yet)'
                    }
                  >
                    {p.aiAnswers}
                  </Link>
                ) : (
                  <span title={p.aiAnswers === 0 ? "No Brave AI answers cited this page (yet)" : undefined}>
                    {p.aiAnswers ?? 0}
                  </span>
                )}
              </td>
              <td style={{ textAlign: 'right' }} className="tabular-nums">
                <span style={{ 
                  color: (p.aiHits ?? 0) > 0 ? '#10b981' : '#6b7280',
                  fontWeight: (p.aiHits ?? 0) > 0 ? 'bold' : 'normal'
                }}>
                  {p.aiHits ?? 0}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}


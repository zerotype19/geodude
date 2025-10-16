import { Link, useLocation } from "react-router-dom";
import { useState, useMemo } from "react";
import type { AuditPage, Scores } from "../services/api";
import { b64u } from "../services/api";
import { isV21 } from "../lib/format";

function formatUrl(url: string) {
  try {
    const u = new URL(url);
    return u.pathname + u.search + u.hash;
  } catch {
    return url;
  }
}

export default function PagesTable({ pages, scores, auditId }: { pages: AuditPage[]; scores?: Scores; auditId?: string }) {
  const location = useLocation();
  const [sortBy, setSortBy] = useState<{ key: string; dir: 'asc' | 'desc' }>(() => 
    isV21(scores) ? { key: 'cites', dir: 'desc' } : { key: 'words', dir: 'desc' }
  );
  
  // Extract audit ID from path: /a/:auditId (fallback if not passed as prop)
  const auditIdFromPath = location.pathname.split('/')[2] || '';
  const finalAuditId = auditId || auditIdFromPath;

  if (!pages?.length) return <div>No pages captured.</div>;
  
  // Only show FAQ column if any page has FAQPage JSON-LD
  const anyFaq = pages.some(p => p.faqOnPage === true || p.schemaTypes?.includes('FAQPage'));
  
  const sortedPages = useMemo(() => {
    return [...pages].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy.key) {
        case 'cites':
          aVal = a.cites ?? a.citationCount ?? 0;
          bVal = b.cites ?? b.citationCount ?? 0;
          break;
        case 'words':
          aVal = a.words ?? 0;
          bVal = b.words ?? 0;
          break;
        case 'ai_hits':
          aVal = a.ai_hits ?? a.aiHits ?? 0;
          bVal = b.ai_hits ?? b.aiHits ?? 0;
          break;
        case 'title':
          aVal = a.title ?? '';
          bVal = b.title ?? '';
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortBy.dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortBy.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [pages, sortBy]);
  
  return (
    <table>
      <thead>
        <tr>
          <th>URL</th>
          <th title="HTTP status code. 0 = unknown (timeout/network error)">Status</th>
          <th 
            style={{ cursor: 'pointer' }}
            onClick={() => setSortBy(prev => ({ 
              key: 'title', 
              dir: prev.key === 'title' && prev.dir === 'asc' ? 'desc' : 'asc' 
            }))}
          >
            Title {sortBy.key === 'title' && (sortBy.dir === 'asc' ? '↑' : '↓')}
          </th>
          <th 
            style={{ textAlign: 'right', cursor: 'pointer' }}
            onClick={() => setSortBy(prev => ({ 
              key: 'words', 
              dir: prev.key === 'words' && prev.dir === 'asc' ? 'desc' : 'asc' 
            }))}
          >
            Words {sortBy.key === 'words' && (sortBy.dir === 'asc' ? '↑' : '↓')}
          </th>
          <th>JSON-LD</th>
          <th>FAQ</th>
          <th>EEAT</th>
          <th 
            style={{ textAlign: 'right', cursor: 'pointer' }}
            onClick={() => setSortBy(prev => ({ 
              key: 'cites', 
              dir: prev.key === 'cites' && prev.dir === 'asc' ? 'desc' : 'asc' 
            }))}
          >
            AI {sortBy.key === 'cites' && (sortBy.dir === 'asc' ? '↑' : '↓')}
          </th>
        </tr>
      </thead>
      <tbody>
        {sortedPages.map((p, idx) => {
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
                {finalAuditId ? (
                  <Link
                    to={`/a/${finalAuditId}/p/${b64u.enc(p.url)}`}
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
              <td>
                {p.jsonLdCount ?? 0}
              </td>
              <td>
                {(p.schemaTypes?.includes('FAQPage') || p.pageSignals?.faqSchema) ? (
                  <span style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: '#faf5ff',
                    color: '#7c3aed',
                    border: '1px solid #d8b4fe'
                  }}>
                    FAQ
                  </span>
                ) : (
                  <span style={{ color: '#9ca3af' }}>—</span>
                )}
              </td>
              <td style={{ fontSize: 12 }}>
                <span style={{ color: p.eeat?.hasAuthor ? '#10b981' : '#9ca3af' }}>Author</span>{' · '}
                <span style={{ color: p.eeat?.hasDates ? '#10b981' : '#9ca3af' }}>Dates</span>{' · '}
                <span style={{ color: p.eeat?.hasMetaDescription ? '#10b981' : '#9ca3af' }}>Meta</span>
              </td>
              <td style={{ textAlign: 'right' }} className="tabular-nums">
                <div style={{ fontSize: 12 }}>
                  <div>
                    <span className="mr-2">Cites: {p.cites ?? p.citationCount ?? 0}</span>
                    <span style={{ color: '#6b7280' }}>Hits: {p.ai_hits ?? p.aiHits ?? 0}</span>
                  </div>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}


import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAuditCitations, type Citation, type CitationType, type CitationCounts } from "../services/api";

interface Props {
  auditId: string;
  citations?: Citation[];
}

export default function Citations({ auditId }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  
  const urlTypeFilter = params.get('ct') as CitationType | null;
  const urlPathFilter = params.get('path') || params.get('filter') || ''; // Support both 'path' and legacy 'filter'
  
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<CitationCounts>({ AEO: 0, GEO: 0, Organic: 0 });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState<CitationType | null>(urlTypeFilter);
  const [pathFilter, setPathFilter] = useState(urlPathFilter);

  // Update URL when filters change
  useEffect(() => {
    const newParams = new URLSearchParams(location.search);
    
    // Preserve other params like 'tab'
    const currentTab = newParams.get('tab');
    newParams.delete('tab');
    newParams.delete('ct');
    newParams.delete('path');
    newParams.delete('filter');
    
    if (currentTab) newParams.set('tab', currentTab);
    if (typeFilter) newParams.set('ct', typeFilter);
    if (pathFilter) newParams.set('path', pathFilter);
    
    const newSearch = newParams.toString();
    const currentSearch = location.search.substring(1);
    
    if (newSearch !== currentSearch) {
      navigate(`${location.pathname}?${newSearch}`, { replace: true });
    }
  }, [typeFilter, pathFilter, location.pathname, location.search, navigate]);

  // Fetch citations when filters change
  useEffect(() => {
    setLoading(true);
    getAuditCitations(auditId, {
      type: typeFilter || undefined,
      path: pathFilter || undefined,
      page,
      pageSize
    })
      .then((data) => {
        setCitations(data.items);
        setTotal(data.total);
        setCounts(data.counts);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load citations:', error);
        setLoading(false);
      });
  }, [auditId, typeFilter, pathFilter, page, pageSize]);

  const handleTypeFilter = (type: CitationType | null) => {
    setTypeFilter(type);
    setPage(1); // Reset to first page
  };

  const handleClearPathFilter = () => {
    setPathFilter('');
    setPage(1);
  };

  if (loading && citations.length === 0) {
    return <div style={{ textAlign: 'center', padding: 48 }}>Loading citations...</div>;
  }

  if (!loading && citations.length === 0 && !typeFilter && !pathFilter) {
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

  // Group by query
  const byQuery = citations.reduce((acc, c) => {
    if (!acc[c.query]) acc[c.query] = [];
    acc[c.query].push(c);
    return acc;
  }, {} as Record<string, Citation[]>);

  const totalCitations = counts.AEO + counts.GEO + counts.Organic;
  const hasMore = total > page * pageSize;

  return (
    <div>
      {/* Count chips */}
      <div style={{ 
        display: 'flex', 
        gap: 12, 
        marginBottom: 16,
        flexWrap: 'wrap'
      }}>
        <div className="pill info" style={{ fontSize: 13 }}>
          Total: {totalCitations}
        </div>
        <div 
          className="pill" 
          style={{ 
            background: counts.AEO > 0 ? '#8b5cf6' : '#374151', 
            fontSize: 13 
          }}
        >
          AEO: {counts.AEO}
        </div>
        <div 
          className="pill" 
          style={{ 
            background: counts.GEO > 0 ? '#3b82f6' : '#374151', 
            fontSize: 13 
          }}
        >
          GEO: {counts.GEO}
        </div>
        <div 
          className="pill" 
          style={{ 
            background: counts.Organic > 0 ? '#10b981' : '#374151', 
            fontSize: 13 
          }}
        >
          Organic: {counts.Organic}
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        marginBottom: 16,
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => handleTypeFilter(null)}
          style={{
            padding: '6px 12px',
            fontSize: 13,
            fontWeight: typeFilter === null ? 600 : 400,
            cursor: 'pointer',
            background: typeFilter === null ? '#667eea' : '#2a2b2e',
            color: 'white',
            border: typeFilter === null ? '1px solid #667eea' : '1px solid #3a3b3e',
            borderRadius: 6,
            transition: 'all 0.2s'
          }}
        >
          All
        </button>
        <button
          onClick={() => handleTypeFilter('AEO')}
          style={{
            padding: '6px 12px',
            fontSize: 13,
            fontWeight: typeFilter === 'AEO' ? 600 : 400,
            cursor: 'pointer',
            background: typeFilter === 'AEO' ? '#8b5cf6' : '#2a2b2e',
            color: 'white',
            border: typeFilter === 'AEO' ? '1px solid #8b5cf6' : '1px solid #3a3b3e',
            borderRadius: 6,
            transition: 'all 0.2s'
          }}
        >
          AEO
        </button>
        <button
          onClick={() => handleTypeFilter('GEO')}
          style={{
            padding: '6px 12px',
            fontSize: 13,
            fontWeight: typeFilter === 'GEO' ? 600 : 400,
            cursor: 'pointer',
            background: typeFilter === 'GEO' ? '#3b82f6' : '#2a2b2e',
            color: 'white',
            border: typeFilter === 'GEO' ? '1px solid #3b82f6' : '1px solid #3a3b3e',
            borderRadius: 6,
            transition: 'all 0.2s'
          }}
        >
          GEO
        </button>
        <button
          onClick={() => handleTypeFilter('Organic')}
          style={{
            padding: '6px 12px',
            fontSize: 13,
            fontWeight: typeFilter === 'Organic' ? 600 : 400,
            cursor: 'pointer',
            background: typeFilter === 'Organic' ? '#10b981' : '#2a2b2e',
            color: 'white',
            border: typeFilter === 'Organic' ? '1px solid #10b981' : '1px solid #3a3b3e',
            borderRadius: 6,
            transition: 'all 0.2s'
          }}
        >
          Organic
        </button>
      </div>

      {/* Path filter chip */}
      {pathFilter && (
        <div style={{ 
          marginBottom: 16, 
          padding: '8px 12px', 
          background: '#2a2b2e', 
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid #3a3b3e'
        }}>
          <span style={{ fontSize: 14 }}>
            Filtered to page: <strong>{pathFilter}</strong>
          </span>
          <button
            onClick={handleClearPathFilter}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              cursor: 'pointer',
              background: '#1a1b1e',
              color: 'white',
              border: '1px solid #3a3b3e',
              borderRadius: 4
            }}
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Results summary */}
      <p style={{ marginTop: 0, marginBottom: 16, opacity: 0.7, fontSize: 14 }}>
        {citations.length === 0 ? (
          typeFilter ? (
            `No ${typeFilter} citations found${pathFilter ? ` for ${pathFilter}` : ''}.`
          ) : (
            `No citations found${pathFilter ? ` for ${pathFilter}` : ''}.`
          )
        ) : (
          <>
            Showing {citations.length} of {total} citation{total !== 1 ? 's' : ''} 
            {typeFilter && ` (${typeFilter})`}
            {pathFilter && ` for ${pathFilter}`}
          </>
        )}
      </p>
      
      {/* Citations grouped by query */}
      {Object.entries(byQuery).map(([query, results]) => {
        const engine = results[0]?.engine || 'search';
        return (
        <div key={query} style={{ marginBottom: 24 }}>
          <h4 style={{ 
            margin: '12px 0 8px 0', 
            fontSize: 14, 
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span className="pill info" style={{ textTransform: 'capitalize' }}>{engine}</span>
            Query: "{query}"
          </h4>
          
          <div style={{ paddingLeft: 16 }}>
            {results.map((citation, idx) => {
              const urlObj = new URL(citation.url);
              
              // Type badge colors
              let typeBadgeStyle = { background: '#10b981', color: 'white' }; // Organic
              if (citation.type === 'AEO') {
                typeBadgeStyle = { background: '#8b5cf6', color: 'white' };
              } else if (citation.type === 'GEO') {
                typeBadgeStyle = { background: '#3b82f6', color: 'white' };
              }
              
              return (
                <div 
                  key={idx} 
                  style={{ 
                    padding: 12, 
                    background: '#1a1b1e', 
                    borderRadius: 8,
                    marginBottom: 8,
                    border: '1px solid #2a2b2e',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <a 
                      href={citation.url} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ 
                        fontWeight: 500, 
                        fontSize: 15,
                        textDecoration: 'none',
                        color: '#93c5fd'
                      }}
                    >
                      {citation.title || citation.url}
                    </a>
                    <div style={{ 
                      fontSize: 12, 
                      opacity: 0.6, 
                      marginTop: 4
                    }}>
                      {urlObj.hostname}{urlObj.pathname !== '/' ? urlObj.pathname : ''}
                    </div>
                  </div>
                  <span 
                    className="pill" 
                    style={{ 
                      ...typeBadgeStyle,
                      fontSize: 11,
                      padding: '4px 8px',
                      marginLeft: 12,
                      flexShrink: 0
                    }}
                  >
                    {citation.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )})}
      
      {/* Pagination */}
      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: loading ? '#64748b' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Loading...' : `Load More (${total - page * pageSize} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}

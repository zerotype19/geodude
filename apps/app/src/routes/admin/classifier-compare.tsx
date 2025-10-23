/**
 * Admin Classifier Comparison View
 * Compares legacy vs v2 classification for any domain
 */

import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.optiview.ai';

export default function ClassifierCompare() {
  const [host, setHost] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!host) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/admin/classifier-compare?host=${encodeURIComponent(host)}`);
      const result = await response.json();

      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch comparison');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const copyJSON = () => {
    if (data) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      alert('JSON copied to clipboard');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Classifier Comparison (Legacy vs V2)</h1>

        {/* Input Form */}
        <div className="bg-surface-1 rounded-lg shadow-sm p-6 mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="Enter hostname (e.g., nike.com)"
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-brand focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
            />
            <button
              onClick={handleCompare}
              disabled={!host || loading}
              className="px-6 py-2 bg-brand text-white rounded-md hover:bg-brand disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Compare'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-danger-soft border border-danger text-danger px-4 py-3 rounded-md mb-8">
            {error}
          </div>
        )}

        {/* Comparison Results */}
        {data && !error && (
          <div className="space-y-6">
            {/* Summary Header */}
            <div className="bg-surface-1 rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{data.host}</h2>
                <div className="flex gap-2">
                  <a
                    href={`https://${data.host}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-brand-soft hover:bg-blue-200 text-brand rounded-md text-sm"
                  >
                    Open Site →
                  </a>
                  <button
                    onClick={copyJSON}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-md text-sm"
                  >
                    Copy JSON
                  </button>
                </div>
              </div>
            </div>

            {/* Side-by-Side Comparison */}
            <div className="grid grid-cols-2 gap-6">
              {/* Legacy */}
              <div className="bg-surface-1 rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4 text-neutral-600">Legacy Classification</h3>
                
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-neutral-500">Site Type</div>
                    <div className="font-mono bg-neutral-100 px-3 py-2 rounded mt-1">
                      {data.legacy?.site_type || 'null'}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-neutral-500">Industry</div>
                    <div className="font-mono bg-neutral-100 px-3 py-2 rounded mt-1">
                      {data.legacy?.industry || 'null'}
                    </div>
                  </div>
                </div>
              </div>

              {/* V2 */}
              <div className="bg-surface-1 rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4 text-brand">V2 Classification</h3>
                
                {data.v2?.error ? (
                  <div className="text-danger">{data.v2.error}</div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-neutral-500">Site Type</div>
                      <div className="font-mono bg-brand-soft px-3 py-2 rounded mt-1 flex justify-between items-center">
                        <span>{data.v2?.site_type?.value || 'null'}</span>
                        {data.v2?.site_type?.confidence && (
                          <span className="text-xs bg-brand-soft px-2 py-1 rounded">
                            {(data.v2.site_type.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-neutral-500">Industry</div>
                      <div className="font-mono bg-brand-soft px-3 py-2 rounded mt-1 flex justify-between items-center">
                        <span>{data.v2?.industry?.value || 'null'}</span>
                        {data.v2?.industry?.confidence && (
                          <span className="text-xs bg-brand-soft px-2 py-1 rounded">
                            {(data.v2.industry.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-neutral-500">Site Mode</div>
                      <div className="font-mono bg-brand-soft px-3 py-2 rounded mt-1">
                        {data.v2?.site_mode || 'null'}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-neutral-500">Brand Kind</div>
                      <div className="font-mono bg-brand-soft px-3 py-2 rounded mt-1">
                        {data.v2?.brand_kind || 'null'}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-neutral-500">Purpose</div>
                      <div className="font-mono bg-brand-soft px-3 py-2 rounded mt-1">
                        {data.v2?.purpose || 'null'}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-neutral-500">Language / Region</div>
                      <div className="font-mono bg-brand-soft px-3 py-2 rounded mt-1">
                        {data.v2?.lang || 'null'} / {data.v2?.region || 'null'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* V2 Additional Details */}
            {data.v2 && !data.v2.error && (
              <>
                {/* Signals Breakdown */}
                <div className="bg-surface-1 rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4">Signals Breakdown</h3>
                  <div className="grid grid-cols-5 gap-4">
                    {Object.entries(data.v2.signals || {}).map(([key, value]) => (
                      <div key={key} className="text-center">
                        <div className="text-2xl font-bold text-brand">{value as number}</div>
                        <div className="text-xs text-neutral-500 uppercase">{key}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Nav Terms */}
                {data.v2.nav_terms?.length > 0 && (
                  <div className="bg-surface-1 rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4">Nav Terms (Top 10)</h3>
                    <div className="flex flex-wrap gap-2">
                      {data.v2.nav_terms.slice(0, 10).map((term: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-neutral-100 rounded-full text-sm">
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* JSON-LD Types */}
                {data.v2.jsonld_types?.length > 0 && (
                  <div className="bg-surface-1 rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4">JSON-LD Types</h3>
                    <div className="flex flex-wrap gap-2">
                      {data.v2.jsonld_types.map((type: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-success-soft text-success rounded-full text-sm font-mono">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category Terms */}
                {data.v2.category_terms?.length > 0 && (
                  <div className="bg-surface-1 rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4">Category Terms</h3>
                    <div className="flex flex-wrap gap-2">
                      {data.v2.category_terms.map((term: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-purple-100 text-brand rounded-full text-sm">
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {data.v2.notes?.length > 0 && (
                  <div className="bg-warn-soft border border-warn rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-2 text-yellow-900">Notes</h3>
                    <ul className="list-disc pl-5 space-y-1 text-warn text-sm">
                      {data.v2.notes.map((note: string, i: number) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


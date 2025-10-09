import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.optiview.ai';

interface AuditScore {
  score_overall: number;
  score_crawlability: number;
  score_structured: number;
  score_answerability: number;
  score_trust: number;
}

interface AuditPage {
  url: string;
  status_code: number;
  title: string | null;
  h1: string | null;
  has_json_ld: number;
  has_faq: number;
  word_count: number;
  load_time_ms: number;
  error: string | null;
}

interface AuditIssue {
  page_url: string;
  issue_type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details: string | null;
}

interface AuditResult extends AuditScore {
  id: string;
  property_id: string;
  status: string;
  pages_crawled: number;
  pages_total: number;
  issues_count: number;
  started_at: string;
  completed_at: string;
  pages: AuditPage[];
  issues: AuditIssue[];
}

function App() {
  const [propertyId, setPropertyId] = useState('prop_demo');
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    setAudit(null);

    try {
      // Step 1: Start audit
      const startResponse = await fetch(`${API_BASE}/v1/audits/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ property_id: propertyId }),
      });

      if (!startResponse.ok) {
        throw new Error(`Audit failed: ${startResponse.statusText}`);
      }

      const startData = await startResponse.json();
      const auditId = startData.id;

      // Step 2: Fetch full audit details
      const detailsResponse = await fetch(`${API_BASE}/v1/audits/${auditId}`);
      
      if (!detailsResponse.ok) {
        throw new Error(`Failed to fetch audit: ${detailsResponse.statusText}`);
      }

      const auditData: AuditResult = await detailsResponse.json();
      setAudit(auditData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const ScoreGauge = ({ label, score, color }: { label: string; score: number; color: string }) => (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="transform -rotate-90 w-24 h-24">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 40}`}
            strokeDashoffset={`${2 * Math.PI * 40 * (1 - score)}`}
            className={color}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold">{Math.round(score * 100)}</span>
        </div>
      </div>
      <span className="mt-2 text-sm text-gray-600">{label}</span>
    </div>
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">Optiview Dashboard</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Audit Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Run Audit</h2>
          <div className="flex gap-4">
            <input
              type="text"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              placeholder="Property ID (e.g., prop_demo)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={runAudit}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Running...' : 'Run Audit'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-8">
            {error}
          </div>
        )}

        {/* Audit Results */}
        {audit && (
          <>
            {/* Scores */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-lg font-semibold mb-6">Audit Scores</h2>
              <div className="flex justify-around flex-wrap gap-6">
                <ScoreGauge 
                  label="Overall" 
                  score={audit.score_overall} 
                  color="text-purple-600" 
                />
                <ScoreGauge 
                  label="Crawlability" 
                  score={audit.score_crawlability} 
                  color="text-blue-600" 
                />
                <ScoreGauge 
                  label="Structured" 
                  score={audit.score_structured} 
                  color="text-green-600" 
                />
                <ScoreGauge 
                  label="Answerability" 
                  score={audit.score_answerability} 
                  color="text-yellow-600" 
                />
                <ScoreGauge 
                  label="Trust" 
                  score={audit.score_trust} 
                  color="text-red-600" 
                />
              </div>
              <div className="mt-6 text-sm text-gray-600">
                <p>Pages crawled: {audit.pages_crawled} / {audit.pages_total}</p>
                <p>Issues found: {audit.issues_count}</p>
              </div>
            </div>

            {/* Issues Table */}
            {audit.issues && audit.issues.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-8">
                <h2 className="text-lg font-semibold mb-4">Issues ({audit.issues.length})</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Severity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Message
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Page
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {audit.issues.map((issue, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(issue.severity)}`}>
                              {issue.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {issue.issue_type}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {issue.message}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">
                            {issue.page_url}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pages Table */}
            {audit.pages && audit.pages.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Pages ({audit.pages.length})</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          URL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Title
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          JSON-LD
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          FAQ
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Load Time
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {audit.pages.map((page, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 text-sm text-blue-600 truncate max-w-xs">
                            <a href={page.url} target="_blank" rel="noopener noreferrer">
                              {page.url}
                            </a>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              page.status_code === 200 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {page.status_code}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 truncate max-w-xs">
                            {page.title || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {page.has_json_ld ? '✅' : '❌'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {page.has_faq ? '✅' : '❌'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {page.load_time_ms}ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;


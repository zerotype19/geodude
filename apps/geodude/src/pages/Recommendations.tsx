import React, { useState, useEffect } from 'react';
import Shell from '../components/Shell';
import { useAuth } from '../contexts/AuthContext';

interface Evidence {
  source_slug?: string;
  source_name?: string;
  url?: string;
  referrals?: number;
  conversions?: number;
  conv_rate?: number;
  direct_count?: number;
  window?: string;
  avg_ttc_min?: number;
  count?: number;
}

interface Link {
  label: string;
  href: string;
}

interface Recommendation {
  rec_id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  impact_score: number;
  effort: 'low' | 'medium' | 'high';
  status: 'open' | 'dismissed' | 'resolved';
  evidence: Evidence;
  links: Link[];
  note?: string;
  created_at: string;
  updated_at: string;
}

interface RecommendationsResponse {
  items: Recommendation[];
  page: number;
  pageSize: number;
  total: number;
}

const API_BASE = 'https://api.optiview.ai';

const Recommendations: React.FC = () => {
  const { user, project } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    severity: '',
    type: '',
    q: '',
    window: '7d',
    sort: 'impact_desc'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0
  });
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  const fetchRecommendations = async () => {
    if (!project?.id) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        project_id: project.id,
        window: filters.window,
        status: filters.status,
        sort: filters.sort,
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString()
      });

      if (filters.severity) params.append('severity', filters.severity);
      if (filters.type) params.append('type', filters.type);
      if (filters.q) params.append('q', filters.q);

      const response = await fetch(`${API_BASE}/api/recommendations?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch recommendations: ${response.statusText}`);
      }

      const data: RecommendationsResponse = await response.json();
      setRecommendations(data.items);
      setPagination(prev => ({
        ...prev,
        total: data.total
      }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  };

  const updateRecommendationStatus = async (recId: string, status: string, note?: string) => {
    if (!project?.id) return;

    try {
      const response = await fetch(`${API_BASE}/api/recommendations/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          project_id: project.id,
          rec_id: recId,
          status,
          note
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.statusText}`);
      }

      // Refresh recommendations
      await fetchRecommendations();
      setShowDrawer(false);
      setSelectedRec(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const resetRecommendationStatus = async (recId: string) => {
    if (!project?.id) return;

    try {
      const response = await fetch(`${API_BASE}/api/recommendations/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          project_id: project.id,
          rec_id: recId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to reset status: ${response.statusText}`);
      }

      // Refresh recommendations
      await fetchRecommendations();
      setShowDrawer(false);
      setSelectedRec(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset status');
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [project?.id, filters, pagination.page]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'dismissed': return 'bg-gray-100 text-gray-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'R1': return 'No Visibility';
      case 'R2': return 'Weak Conversions';
      case 'R3': return 'Missing AI';
      case 'R4': return 'Slow TTC';
      case 'R5': return 'Pending Rules';
      default: return type;
    }
  };

  if (!user || !project) {
    return <div>Please log in to view recommendations.</div>;
  }

  return (
    <Shell>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recommendations</h1>
            <p className="text-gray-600">AI-driven insights to optimize your funnel performance</p>
          </div>
          <a
            href="/docs#recommendations"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View Documentation →
          </a>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="dismissed">Dismissed</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({...filters, severity: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Severity</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({...filters, type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Types</option>
                <option value="R1">No Visibility</option>
                <option value="R2">Weak Conversions</option>
                <option value="R3">Missing AI</option>
                <option value="R4">Slow TTC</option>
                <option value="R5">Pending Rules</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Window</label>
              <select
                value={filters.window}
                onChange={(e) => setFilters({...filters, window: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="7d">7 days</option>
                <option value="24h">24 hours</option>
                <option value="15m">15 minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort</label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters({...filters, sort: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="impact_desc">Impact (High to Low)</option>
                <option value="severity_desc">Severity (High to Low)</option>
                <option value="type_asc">Type (A to Z)</option>
                <option value="url_asc">URL (A to Z)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={filters.q}
                onChange={(e) => setFilters({...filters, q: e.target.value})}
                placeholder="Search URLs, sources..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="text-gray-600">Loading recommendations...</div>
          </div>
        )}

        {/* Empty State */}
        {!loading && recommendations.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="text-gray-600 mb-4">No recommendations found.</div>
            <p className="text-gray-500 text-sm">
              This is great! Your funnel performance looks optimized. 
              Recommendations will appear here when optimization opportunities are detected.
            </p>
            <a
              href="/docs#recommendations"
              className="inline-block mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Learn more about recommendations →
            </a>
          </div>
        )}

        {/* Recommendations Table */}
        {!loading && recommendations.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Impact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recommendations.map((rec) => (
                    <tr key={rec.rec_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {getTypeLabel(rec.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(rec.severity)}`}>
                          {rec.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{rec.title}</div>
                        <div className="text-sm text-gray-500 mt-1">{rec.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{rec.impact_score}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(rec.status)}`}>
                          {rec.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => {
                            setSelectedRec(rec);
                            setShowDrawer(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)} to{' '}
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} results
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page * pagination.pageSize >= pagination.total}
                    className="px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {showDrawer && selectedRec && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowDrawer(false)}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
            <div className="flex flex-col h-full">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900">Recommendation Details</h2>
                  <button
                    onClick={() => setShowDrawer(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Type & Severity</h3>
                    <div className="mt-1 flex space-x-2">
                      <span className="text-sm text-gray-600">{getTypeLabel(selectedRec.type)}</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(selectedRec.severity)}`}>
                        {selectedRec.severity}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Title</h3>
                    <p className="mt-1 text-sm text-gray-600">{selectedRec.title}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Description</h3>
                    <p className="mt-1 text-sm text-gray-600">{selectedRec.description}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Impact Score</h3>
                    <p className="mt-1 text-sm text-gray-600">{selectedRec.impact_score}/100</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Evidence</h3>
                    <pre className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      {JSON.stringify(selectedRec.evidence, null, 2)}
                    </pre>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Quick Links</h3>
                    <div className="mt-1 space-y-1">
                      {selectedRec.links.map((link, index) => (
                        <a
                          key={index}
                          href={link.href}
                          className="block text-sm text-blue-600 hover:text-blue-800"
                        >
                          {link.label} →
                        </a>
                      ))}
                    </div>
                  </div>
                  
                  {selectedRec.note && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Note</h3>
                      <p className="mt-1 text-sm text-gray-600">{selectedRec.note}</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-gray-200 space-y-2">
                {selectedRec.status === 'open' && (
                  <>
                    <button
                      onClick={() => updateRecommendationStatus(selectedRec.rec_id, 'resolved')}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700"
                    >
                      Mark as Resolved
                    </button>
                    <button
                      onClick={() => updateRecommendationStatus(selectedRec.rec_id, 'dismissed')}
                      className="w-full bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                    >
                      Dismiss
                    </button>
                  </>
                )}
                {selectedRec.status !== 'open' && (
                  <button
                    onClick={() => resetRecommendationStatus(selectedRec.rec_id)}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Reset to Open
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
};

export default Recommendations;

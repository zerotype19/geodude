import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';

interface ContentAsset {
  id: number;
  url: string;
  type: string;
  last_seen: string | null;
  events_15m: number;
  events_24h: number;
  ai_referrals_24h: number;
  by_source_24h: Array<{ slug: string; events: number }>;
  coverage_score: number;
}

interface ContentDetail {
  asset: { id: number; url: string; type: string };
  by_source: Array<{ slug: string; events: number }>;
  timeseries: Array<{ ts: string; events: number; ai_referrals: number }>;
  recent_events: Array<{ occurred_at: string; event_type: string; source: string; path: string }>;
}

const Content: React.FC = () => {
  const { user, project } = useAuth();
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState({
    window: '24h',
    q: '',
    type: '',
    aiOnly: false,
    page: 1,
    pageSize: 50
  });
  const [total, setTotal] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAsset, setNewAsset] = useState({ url: '', type: 'page' });
  const [assetDetails, setAssetDetails] = useState<Record<number, ContentDetail>>({});

  const API_BASE = import.meta.env.VITE_API_URL || 'https://api.optiview.ai';

  useEffect(() => {
    if (project?.id) {
      loadAssets();
    }
  }, [project?.id, filters]);

  const loadAssets = async () => {
    if (!project?.id) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        project_id: project.id,
        window: filters.window,
        q: filters.q,
        type: filters.type,
        aiOnly: filters.aiOnly.toString(),
        page: filters.page.toString(),
        pageSize: filters.pageSize.toString()
      });

      const response = await fetch(`${API_BASE}/api/content?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setAssets(data.items || []);
        setTotal(data.total || 0);
      } else {
        console.error('Failed to load content assets');
      }
    } catch (error) {
      console.error('Error loading content assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAssetDetail = async (assetId: number) => {
    if (assetDetails[assetId]) return; // Already loaded

    try {
      const response = await fetch(`${API_BASE}/api/content/${assetId}/detail?window=7d`, {
        credentials: 'include'
      });

      if (response.ok) {
        const detail = await response.json();
        setAssetDetails(prev => ({ ...prev, [assetId]: detail }));
      }
    } catch (error) {
      console.error('Error loading asset detail:', error);
    }
  };

  const toggleRowExpansion = (assetId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(assetId)) {
      newExpanded.delete(assetId);
    } else {
      newExpanded.add(assetId);
      loadAssetDetail(assetId);
    }
    setExpandedRows(newExpanded);
  };

  const handleAddAsset = async () => {
    if (!project?.id || !newAsset.url.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/api/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          project_id: project.id,
          property_id: 1, // TODO: Get from project properties
          url: newAsset.url,
          type: newAsset.type
        })
      });

      if (response.ok) {
        setShowAddModal(false);
        setNewAsset({ url: '', type: 'page' });
        loadAssets(); // Refresh the list
      }
    } catch (error) {
      console.error('Error creating asset:', error);
    }
  };

  const getCoverageBadge = (score: number) => {
    if (score < 34) return { label: 'Low', color: 'bg-red-100 text-red-800' };
    if (score < 67) return { label: 'Med', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'High', color: 'bg-green-100 text-green-800' };
  };

  const truncateUrl = (url: string) => {
    if (url.length <= 50) return url;
    return url.substring(0, 25) + '...' + url.substring(url.length - 20);
  };

  if (!project?.id) {
    return (
      <div className="p-6">
        <Card title="Content Assets">
          <div className="p-6 text-center text-gray-500">
            Please select a project to view content assets.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Assets</h1>
          <p className="text-gray-600">Track AI visibility and engagement across your content</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Content
        </button>
      </div>

      {/* Filters */}
      <Card title="Filters">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search URLs..."
                value={filters.q}
                onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="page">Page</option>
                <option value="article">Article</option>
                <option value="product">Product</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Window</label>
              <select
                value={filters.window}
                onChange={(e) => setFilters(prev => ({ ...prev, window: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="15m">Last 15 minutes</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.aiOnly}
                  onChange={(e) => setFilters(prev => ({ ...prev, aiOnly: e.target.checked, page: 1 }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">AI activity only</span>
              </label>
            </div>
          </div>
        </div>
      </Card>

      {/* Content Table */}
      <Card title={`Content Assets (${total} total)`}>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : assets.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p className="mb-4">No content assets found.</p>
              <p className="text-sm">Create your first content asset or check your installation configuration.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Seen</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">15m</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">24h</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI Referrals</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coverage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assets.map((asset) => {
                  const coverageBadge = getCoverageBadge(asset.coverage_score);
                  const isExpanded = expandedRows.has(asset.id);
                  
                  return (
                    <React.Fragment key={asset.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900" title={asset.url}>
                              {truncateUrl(asset.url)}
                            </span>
                            <button
                              onClick={() => navigator.clipboard.writeText(asset.url)}
                              className="text-gray-400 hover:text-gray-600"
                              title="Copy URL"
                            >
                              📋
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                          {asset.type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {asset.last_seen ? new Date(asset.last_seen).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {asset.events_15m}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {asset.events_24h}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {asset.ai_referrals_24h}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${coverageBadge.color}`}>
                            {coverageBadge.label} ({asset.coverage_score})
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => toggleRowExpansion(asset.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            {isExpanded ? 'Hide' : 'View'} Details
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-4">
                              {/* By Source Breakdown */}
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">By Source (24h)</h4>
                                <div className="flex flex-wrap gap-2">
                                  {asset.by_source_24h.length > 0 ? (
                                    asset.by_source_24h.map((source) => (
                                      <span
                                        key={source.slug}
                                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                                      >
                                        {source.slug}: {source.events}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-gray-500">No AI source activity</span>
                                  )}
                                </div>
                              </div>

                              {/* Recent Events */}
                              {assetDetails[asset.id] && (
                                <div>
                                  <h4 className="font-medium text-gray-900 mb-2">Recent Events</h4>
                                  <div className="space-y-2">
                                    {assetDetails[asset.id].recent_events.length > 0 ? (
                                      assetDetails[asset.id].recent_events.map((event, idx) => (
                                        <div key={idx} className="flex items-center space-x-4 text-sm text-gray-600">
                                          <span>{new Date(event.occurred_at).toLocaleString()}</span>
                                          <span className="capitalize">{event.event_type}</span>
                                          <span>via {event.source}</span>
                                          {event.path && <span>at {event.path}</span>}
                                        </div>
                                      ))
                                    ) : (
                                      <span className="text-gray-500">No recent events</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > filters.pageSize && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((filters.page - 1) * filters.pageSize) + 1} to {Math.min(filters.page * filters.pageSize, total)} of {total}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={filters.page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={filters.page * filters.pageSize >= total}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Content Asset</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/page"
                  value={newAsset.url}
                  onChange={(e) => setNewAsset(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newAsset.type}
                  onChange={(e) => setNewAsset(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="page">Page</option>
                  <option value="article">Article</option>
                  <option value="product">Product</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAsset}
                disabled={!newAsset.url.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Add Asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Content;

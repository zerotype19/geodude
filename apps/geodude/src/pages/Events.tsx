import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE, FETCH_OPTS } from '../config';
import Shell from '../components/Shell';
import { Activity, TrendingUp, Users, Eye, Clock, Download, RefreshCw } from 'lucide-react';

interface EventSummary {
  totals: {
    events: number;
    ai_influenced: number;
    ai_pct: number;
  };
  unique_pages?: number;
  by_class: Array<{
    class: string;
    count: number;
  }>;
  by_source: Array<{
    slug: string;
    name: string;
    count: number;
  }>;
  timeseries: Array<{
    ts: string;
    events: number;
    ai_referrals: number;
  }>;
}

interface RecentEvent {
  id: string;
  occurred_at: string;
  event_type: string;
  event_class: string;
  source_name?: string;
  path: string;
  user_agent?: string;
  referrer?: string;
  classification_reason?: string;
  classification_confidence?: number;
}

const Events: React.FC = () => {
  const { user, project } = useAuth();
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    window: '24h',
    page: 1,
    pageSize: 20
  });

  useEffect(() => {
    if (project?.id) {
      loadData();
    }
  }, [project?.id, filters.window, filters.page, filters.pageSize]);

  const loadData = async () => {
    if (!project?.id) return;

    setLoading(true);
    try {
      await Promise.all([
        fetchSummary(),
        fetchRecentEvents()
      ]);
    } catch (error) {
      console.error('Error loading events data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    if (!project?.id) return;

    try {
      const params = new URLSearchParams({
        project_id: project.id,
        window: filters.window
      });

      const response = await fetch(`${API_BASE}/api/events/summary?${params}`, FETCH_OPTS);

      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      } else {
        console.error('Failed to fetch events summary');
      }
    } catch (error) {
      console.error('Error fetching events summary:', error);
    }
  };

  const fetchRecentEvents = async () => {
    if (!project?.id) return;

    try {
      const params = new URLSearchParams({
        project_id: project.id,
        window: filters.window,
        page: filters.page.toString(),
        pageSize: filters.pageSize.toString()
      });

      const response = await fetch(`${API_BASE}/api/events/recent?${params}`, FETCH_OPTS);

      if (response.ok) {
        const data = await response.json();
        setRecentEvents(data.events || []);
      } else {
        console.error('Failed to fetch recent events');
      }
    } catch (error) {
      console.error('Error fetching recent events:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleExport = async () => {
    if (!project?.id) return;

    try {
      const params = new URLSearchParams({
        project_id: project.id,
        limit: '1000'
      });

      const response = await fetch(`${API_BASE}/api/events/export.csv?${params}`, FETCH_OPTS);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `events-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting events:', error);
    }
  };

  const getTrafficClassColor = (className: string): string => {
    switch (className) {
      case "crawler": return "bg-orange-100 text-orange-800 border-orange-200";
      case "human_via_ai": return "bg-blue-100 text-blue-800 border-blue-200";
      case "search": return "bg-green-100 text-green-800 border-green-200";
      case "direct_human": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getTrafficClassLabel = (className: string): string => {
    switch (className) {
      case "direct_human": return "Direct Human";
      case "human_via_ai": return "Human via AI";
      case "crawler": return "Crawler";
      case "search": return "Search";
      case "unknown": return "Unknown";
      default: return className;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Please sign in to view events</h1>
        </div>
      </div>
    );
  }

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Events</h1>
              <p className="mt-2 text-gray-600">
                Real-time view of all traffic and AI interactions
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleExport}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Window</label>
                <select
                  value={filters.window}
                  onChange={(e) => setFilters(prev => ({ ...prev, window: e.target.value, page: 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="15m">Last 15 minutes</option>
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Page Size</label>
                <select
                  value={filters.pageSize}
                  onChange={(e) => setFilters(prev => ({ ...prev, pageSize: parseInt(e.target.value), page: 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={10}>10 events</option>
                  <option value={20}>20 events</option>
                  <option value={50}>50 events</option>
                  <option value={100}>100 events</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Activity className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Events</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {summary.totals.events.toLocaleString()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">AI Influenced</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {summary.totals.ai_influenced.toLocaleString()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">AI Percentage</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {summary.totals.ai_pct.toFixed(1)}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Eye className="h-8 w-8 text-orange-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Unique Pages</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {summary.unique_pages?.toLocaleString() || '0'}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Traffic Breakdown */}
        {summary && summary.by_class && summary.by_class.length > 0 && (
          <Card className="mb-8">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Traffic Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {summary.by_class.map((cls) => (
                  <div key={cls.class} className="text-center">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getTrafficClassColor(cls.class)}`}>
                      {getTrafficClassLabel(cls.class)}
                    </div>
                    <div className="mt-2 text-2xl font-bold text-gray-900">
                      {cls.count.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {summary.totals.events > 0 ? ((cls.count / summary.totals.events) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Recent Events */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Recent Events</h3>
              <div className="text-sm text-gray-500">
                Showing {recentEvents.length} events
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading events...</p>
              </div>
            ) : recentEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No events found for the selected time window.</p>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Classification
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Source
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Path
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 text-gray-400 mr-2" />
                            {new Date(event.occurred_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.event_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTrafficClassColor(event.event_class)}`}>
                            {getTrafficClassLabel(event.event_class)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.source_name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="max-w-xs truncate" title={event.path}>
                            {event.path}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {recentEvents.length === filters.pageSize && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Load More
                </button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </Shell>
  );
};

export default Events;
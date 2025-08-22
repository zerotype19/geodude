import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE, FETCH_OPTS } from '../config';
import Shell from '../components/Shell';
import { Info, ChevronDown, ChevronRight, ExternalLink, Plus, Search, Filter } from 'lucide-react';

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

interface ContentSummary {
  totals: {
    content_assets: number;
    total_events: number;
    ai_referrals: number;
    ai_influenced: number;
  };
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

interface ContentDetail {
  asset: { id: number; url: string; type: string };
  by_source: Array<{ slug: string; events: number }>;
  timeseries: Array<{ ts: string; events: number; ai_referrals: number }>;
  recent_events: Array<{
    occurred_at: string;
    event_type: string;
    event_class: string;
    source_name?: string;
    path: string;
    debug?: string[];
    classification_reason?: string;
    classification_confidence?: number;
  }>;
}

// Traffic classification helper functions
function getTrafficClassColor(className: string): string {
  switch (className) {
    case "crawler": return "bg-orange-100 text-orange-800 border-orange-200";
    case "human_via_ai": return "bg-blue-100 text-blue-800 border-blue-200";
    case "search": return "bg-green-100 text-green-800 border-green-200";
    case "direct_human": return "bg-gray-100 text-gray-800 border-gray-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function getTrafficClassLabel(className: string): string {
  switch (className) {
    case "direct_human": return "Direct Human";
    case "human_via_ai": return "Human via AI";
    case "crawler": return "Crawler";
    case "search": return "Search";
    case "unknown": return "Unknown";
    default: return className;
  }
}

function getTrafficClassDescription(className: string): string {
  switch (className) {
    case "direct_human": return "No referrer, direct visits";
    case "human_via_ai": return "AI assistant referrers (ChatGPT, Claude, etc.)";
    case "crawler": return "Cloudflare verified bots and crawlers";
    case "search": return "Search engine referrers (Google, Bing, etc.)";
    case "unknown": return "Unclassified traffic";
    default: return "Traffic classification";
  }
}

// Content grouping and collapsing logic
interface GroupedContent {
  key: string;
  title: string;
  count: number;
  assets: ContentAsset[];
  isExpanded: boolean;
  totalEvents: number;
  totalAIReferrals: number;
  topSources: Array<{ slug: string; events: number }>;
}

const Content: React.FC = () => {
  const { user, project } = useAuth();
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [summary, setSummary] = useState<ContentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState({
    window: '24h',
    q: '',
    type: '',
    aiOnly: false,
    page: 1,
    pageSize: 50,
    groupBy: 'page', // 'page', 'domain', 'type', 'none'
    class: '', // traffic class filter
    source: '', // AI source filter
    botCategory: '' // bot category filter
  });
  const [total, setTotal] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAsset, setNewAsset] = useState({ url: '', type: 'page' });
  const [assetDetails, setAssetDetails] = useState<Record<number, ContentDetail>>({});
  const [addingAsset, setAddingAsset] = useState(false);
  const [addError, setAddError] = useState('');

  // Load window preference from localStorage
  useEffect(() => {
    if (project?.id) {
      const storageKey = `content_window_${project.id}`;
      const savedWindow = localStorage.getItem(storageKey);
      if (savedWindow && savedWindow !== filters.window) {
        setFilters(prev => ({ ...prev, window: savedWindow }));
      }
    }
  }, [project?.id]);

  // Save window preference to localStorage
  useEffect(() => {
    if (project?.id) {
      const storageKey = `content_window_${project.id}`;
      localStorage.setItem(storageKey, filters.window);
    }
  }, [project?.id, filters.window]);

  useEffect(() => {
    if (project?.id) {
      Promise.all([fetchSummary(), loadAssets()]);
    }
  }, [project?.id, filters.window, filters.q, filters.type, filters.aiOnly, filters.page, filters.pageSize, filters.groupBy, filters.class, filters.source, filters.botCategory]);

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
        throw new Error(`Summary API failed: ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  };

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

      // Add new AI detection filters
      if (filters.class) params.append("class", filters.class);
      if (filters.source) params.append("source", filters.source);
      if (filters.botCategory) params.append("botCategory", filters.botCategory);

      const response = await fetch(`${API_BASE}/api/content?${params}`, FETCH_OPTS);

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
      const response = await fetch(`${API_BASE}/api/content/${assetId}/detail?window=7d`, FETCH_OPTS);

      if (response.ok) {
        const detail = await response.json();
        setAssetDetails(prev => ({ ...prev, [assetId]: detail }));
      }
    } catch (error) {
      console.error('Error loading asset detail:', error);
    }
  };

  const toggleGroupExpansion = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
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

  // Filter handlers
  const handleClassFilter = (className: string) => {
    setFilters(prev => ({
      ...prev,
      class: className === filters.class ? '' : className,
      page: 1
    }));
  };

  const handleSourceFilter = (slug: string) => {
    setFilters(prev => ({
      ...prev,
      source: slug === filters.source ? '' : slug,
      page: 1
    }));
  };

  const handleBotCategoryFilter = (category: string) => {
    setFilters(prev => ({
      ...prev,
      botCategory: category === filters.botCategory ? '' : category,
      page: 1
    }));
  };

  // Group content assets to reduce row count
  const getGroupedContent = (): GroupedContent[] => {
    if (filters.groupBy === 'none') {
      return assets.map(asset => ({
        key: `asset_${asset.id}`,
        title: asset.url,
        count: 1,
        assets: [asset],
        isExpanded: expandedGroups.has(`asset_${asset.id}`),
        totalEvents: asset.events_24h,
        totalAIReferrals: asset.ai_referrals_24h,
        topSources: asset.by_source_24h.slice(0, 3)
      }));
    }

    if (filters.groupBy === 'page') {
      const groups: Record<string, GroupedContent> = {};

      assets.forEach(asset => {
        const url = new URL(asset.url);
        const canonicalUrl = asset.url;
        const displayTitle = url.pathname === '/' ? url.hostname : url.pathname;

        if (!groups[canonicalUrl]) {
          groups[canonicalUrl] = {
            key: `page_${canonicalUrl}`,
            title: displayTitle,
            count: 1,
            assets: [asset],
            isExpanded: expandedGroups.has(`page_${canonicalUrl}`),
            totalEvents: asset.events_24h,
            totalAIReferrals: asset.ai_referrals_24h,
            topSources: asset.by_source_24h.slice(0, 3)
          };
        } else {
          // This shouldn't happen with page grouping, but just in case
          groups[canonicalUrl].count++;
          groups[canonicalUrl].assets.push(asset);
          groups[canonicalUrl].totalEvents += asset.events_24h;
          groups[canonicalUrl].totalAIReferrals += asset.ai_referrals_24h;
        }
      });

      // Aggregate top sources across all assets in the group
      Object.values(groups).forEach(group => {
        const sourceMap: Record<string, number> = {};
        group.assets.forEach(asset => {
          asset.by_source_24h.forEach(source => {
            sourceMap[source.slug] = (sourceMap[source.slug] || 0) + source.events;
          });
        });

        group.topSources = Object.entries(sourceMap)
          .map(([slug, events]) => ({ slug, events }))
          .sort((a, b) => b.events - a.events)
          .slice(0, 3);
      });

      return Object.values(groups).sort((a, b) => b.totalEvents - a.totalEvents);
    }

    if (filters.groupBy === 'domain') {
      const groups: Record<string, GroupedContent> = {};

      assets.forEach(asset => {
        const domain = new URL(asset.url).hostname;
        const path = new URL(asset.url).pathname;

        if (!groups[domain]) {
          groups[domain] = {
            key: `domain_${domain}`,
            title: domain,
            count: 0,
            assets: [],
            isExpanded: expandedGroups.has(`domain_${domain}`),
            totalEvents: 0,
            totalAIReferrals: 0,
            topSources: []
          };
        }

        groups[domain].count++;
        groups[domain].assets.push(asset);
        groups[domain].totalEvents += asset.events_24h;
        groups[domain].totalAIReferrals += asset.ai_referrals_24h;
      });

      // Aggregate top sources across all assets in the group
      Object.values(groups).forEach(group => {
        const sourceMap: Record<string, number> = {};
        group.assets.forEach(asset => {
          asset.by_source_24h.forEach(source => {
            sourceMap[source.slug] = (sourceMap[source.slug] || 0) + source.events;
          });
        });

        group.topSources = Object.entries(sourceMap)
          .map(([slug, events]) => ({ slug, events }))
          .sort((a, b) => b.events - a.events)
          .slice(0, 3);
      });

      return Object.values(groups).sort((a, b) => b.totalEvents - a.totalEvents);
    }

    if (filters.groupBy === 'type') {
      const groups: Record<string, GroupedContent> = {};

      assets.forEach(asset => {
        if (!groups[asset.type]) {
          groups[asset.type] = {
            key: `type_${asset.type}`,
            title: `${asset.type.charAt(0).toUpperCase() + asset.type.slice(1)}s`,
            count: 0,
            assets: [],
            isExpanded: expandedGroups.has(`type_${asset.type}`),
            totalEvents: 0,
            totalAIReferrals: 0,
            topSources: []
          };
        }

        groups[asset.type].count++;
        groups[asset.type].assets.push(asset);
        groups[asset.type].totalEvents += asset.events_24h;
        groups[asset.type].totalAIReferrals += asset.ai_referrals_24h;
      });

      // Aggregate top sources
      Object.values(groups).forEach(group => {
        const sourceMap: Record<string, number> = {};
        group.assets.forEach(asset => {
          asset.by_source_24h.forEach(source => {
            sourceMap[source.slug] = (sourceMap[source.slug] || 0) + source.events;
          });
        });

        group.topSources = Object.entries(sourceMap)
          .map(([slug, events]) => ({ slug, events }))
          .sort((a, b) => b.events - a.events)
          .slice(0, 3);
      });

      return Object.values(groups).sort((a, b) => b.totalEvents - a.totalEvents);
    }

    return [];
  };

  // Get paginated grouped content
  const getPaginatedGroupedContent = (): GroupedContent[] => {
    const allGroups = getGroupedContent();
    const startIndex = (filters.page - 1) * filters.pageSize;
    const endIndex = startIndex + filters.pageSize;
    return allGroups.slice(startIndex, endIndex);
  };

  const groupedContent = getPaginatedGroupedContent();
  const allGroupedContent = getGroupedContent();
  const totalGroups = allGroupedContent.length;

  const handleAddAsset = async () => {
    if (!project?.id || !newAsset.url.trim()) return;

    const propertyId = project.primary_property?.id;
    if (!propertyId) {
      setAddError('No primary property found for project');
      return;
    }

    setAddingAsset(true);
    setAddError('');

    try {
      const response = await fetch(`${API_BASE}/api/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...FETCH_OPTS,
        body: JSON.stringify({
          project_id: project.id,
          property_id: propertyId,
          url: newAsset.url,
          type: newAsset.type
        })
      });

      if (response.ok) {
        setShowAddModal(false);
        setNewAsset({ url: '', type: 'page' });
        setAddError('');
        loadAssets(); // Refresh the list
      } else {
        const errorData = await response.json();
        setAddError(errorData.message || 'Failed to add content asset');
      }
    } catch (error) {
      setAddError('Network error occurred');
    } finally {
      setAddingAsset(false);
    }
  };

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Content Assets</h1>
              <p className="mt-2 text-gray-600">
                Track performance and AI traffic across all your content
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Hardened AI Detection System Badge */}
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                Hardened AI Detection System
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Content
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <div className="p-6">
            {/* Filter Info */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Content Filters</p>
                  <p className="mt-1">
                    Use these filters to narrow down your content assets. The <strong>AI Traffic Only</strong> filter shows only content that has received traffic from AI sources like Google's AI features, Bing AI, ChatGPT, and other AI assistants.
                  </p>
                </div>
              </div>
            </div>

            {/* Basic Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
              {/* Window Filter */}
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

              {/* Group By Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
                <select
                  value={filters.groupBy}
                  onChange={(e) => setFilters(prev => ({ ...prev, groupBy: e.target.value, page: 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="page">By Page</option>
                  <option value="domain">By Domain</option>
                  <option value="type">By Type</option>
                  <option value="none">No Grouping</option>
                </select>
              </div>

              {/* Page Size Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Page Size</label>
                <select
                  value={filters.pageSize}
                  onChange={(e) => setFilters(prev => ({ ...prev, pageSize: parseInt(e.target.value), page: 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={25}>25 groups</option>
                  <option value={50}>50 groups</option>
                  <option value={100}>100 groups</option>
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value, page: 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="page">Pages</option>
                  <option value="article">Articles</option>
                  <option value="product">Products</option>
                </select>
              </div>

              {/* AI Only Filter */}
              <div className="flex items-end">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, aiOnly: !prev.aiOnly, page: 1 }))}
                  className={`px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${filters.aiOnly
                    ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 border border-blue-600'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 hover:border-gray-300'
                    }`}
                >
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={filters.aiOnly}
                      onChange={() => { }} // Handled by button click
                      className="sr-only" // Hide the checkbox visually but keep it accessible
                    />
                    {filters.aiOnly && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    )}
                  </div>
                  <span>AI Traffic Only</span>
                  {filters.aiOnly && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Active
                    </span>
                  )}
                </button>
              </div>

              {/* Search */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search URLs</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search content URLs..."
                    value={filters.q}
                    onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value, page: 1 }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Advanced AI Detection Filters */}
            {summary && (
              <>
                {/* Traffic Classes */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Traffic Classes</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleClassFilter('')}
                      className={`px-3 py-1 rounded-full text-sm border ${!filters.class
                        ? "bg-blue-100 text-blue-800 border-blue-200"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                      All ({summary.totals.content_assets})
                    </button>
                    {summary.by_class.map((cls) => (
                      <button
                        key={cls.class}
                        onClick={() => handleClassFilter(cls.class)}
                        className={`px-3 py-1 rounded-full text-sm border ${filters.class === cls.class
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        title={getTrafficClassDescription(cls.class)}
                      >
                        {getTrafficClassLabel(cls.class)} ({cls.count})
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Sources */}
                {summary.by_source.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">AI Sources</h4>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSourceFilter('')}
                        className={`px-3 py-1 rounded-full text-sm border ${!filters.source
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                      >
                        All sources
                      </button>
                      {summary.by_source.map((source) => (
                        <button
                          key={source.slug}
                          onClick={() => handleSourceFilter(source.slug)}
                          className={`px-3 py-1 rounded-full text-sm border ${filters.source === source.slug
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                            }`}
                        >
                          {source.name} ({source.count})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bot Categories (if crawler class exists) */}
                {summary.by_class.some(cls => cls.class === 'crawler') && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Bot Categories</h4>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleBotCategoryFilter('')}
                        className={`px-3 py-1 rounded-full text-sm border ${!filters.botCategory
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                      >
                        All bot types
                      </button>
                      <button
                        onClick={() => handleBotCategoryFilter("ai_training")}
                        className={`px-3 py-1 rounded-full text-sm border ${filters.botCategory === "ai_training"
                          ? "bg-purple-100 text-purple-800 border-purple-200"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                      >
                        AI Training
                      </button>
                      <button
                        onClick={() => handleBotCategoryFilter("search_crawler")}
                        className={`px-3 py-1 rounded-full text-sm border ${filters.botCategory === "search_crawler"
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                      >
                        Search Crawler
                      </button>
                      <button
                        onClick={() => handleBotCategoryFilter("preview_bot")}
                        className={`px-3 py-1 rounded-full text-sm border ${filters.botCategory === "preview_bot"
                          ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                      >
                        Preview Bot
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Content Summary */}
        {!loading && (
          <div className="mb-4 flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>
                Showing {groupedContent.length} of {totalGroups} groups
                {filters.aiOnly && (
                  <span className="ml-2 text-blue-600 font-medium">
                    (AI Traffic Only)
                  </span>
                )}
              </span>
              {filters.aiOnly && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Filtered to show only content with AI referrals
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="font-medium">{total}</span> total content assets
            </div>
          </div>
        )}

        {/* Content Table */}
        <Card>
          <div className="overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading content assets...</p>
              </div>
            ) : groupedContent.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-600">No content assets found matching your criteria.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={`${filters.aiOnly ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Content
                      {filters.aiOnly && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          AI Only
                        </span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Traffic (24h)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AI Referrals
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Top Sources
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Activity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {groupedContent.map((group) => (
                    <React.Fragment key={group.key}>
                      {/* Group Row */}
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <button
                              onClick={() => toggleGroupExpansion(group.key)}
                              className="mr-2 text-gray-400 hover:text-gray-600"
                            >
                              {group.isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {group.title}
                                {group.count > 1 && (
                                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    {group.count} items
                                  </span>
                                )}
                              </div>
                              {filters.groupBy === 'page' ? (
                                <div className="text-sm text-gray-500 truncate max-w-md">
                                  {group.assets[0].url}
                                </div>
                              ) : group.count === 1 && (
                                <div className="text-sm text-gray-500 truncate max-w-md">
                                  {group.assets[0].url}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {group.totalEvents.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {group.totalAIReferrals.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {group.topSources.length > 0 ? (
                              group.topSources.map((source) => (
                                <span
                                  key={source.slug}
                                  className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                                >
                                  {source.slug}: {source.events}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-500 text-sm">No AI sources</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {group.assets[0].last_seen ? (
                            new Date(group.assets[0].last_seen).toLocaleDateString()
                          ) : (
                            'Never'
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          <button
                            onClick={() => toggleGroupExpansion(group.key)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            {group.isExpanded ? 'Hide' : 'View'} Details
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Group Content */}
                      {group.isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-4">
                              {/* Individual Assets */}
                              <div>
                                <h4 className="font-medium text-gray-900 mb-3">Content Items</h4>
                                <div className="grid gap-4">
                                  {group.assets.map((asset) => (
                                    <div key={asset.id} className="bg-white p-4 rounded-lg border border-gray-200">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-2">
                                            <span className="text-sm font-medium text-gray-900">
                                              {asset.type.charAt(0).toUpperCase() + asset.type.slice(1)}
                                            </span>
                                            <a
                                              href={asset.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:text-blue-900 text-sm flex items-center"
                                            >
                                              {asset.url}
                                              <ExternalLink className="h-3 w-3 ml-1" />
                                            </a>
                                          </div>
                                        </div>
                                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                                          <span>15m: {asset.events_15m}</span>
                                          <span>24h: {asset.events_24h}</span>
                                          <span>AI: {asset.ai_referrals_24h}</span>
                                        </div>
                                      </div>

                                      {/* AI Sources Breakdown */}
                                      {asset.by_source_24h.length > 0 && (
                                        <div className="mb-3">
                                          <h5 className="text-xs font-medium text-gray-700 mb-2">AI Sources (24h)</h5>
                                          <div className="flex flex-wrap gap-2">
                                            {asset.by_source_24h.map((source) => (
                                              <span
                                                key={source.slug}
                                                className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                                              >
                                                {source.slug}: {source.events}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Recent Events (if loaded) */}
                                      {assetDetails[asset.id] && (
                                        <div>
                                          <h5 className="text-xs font-medium text-gray-700 mb-2">Recent Events</h5>
                                          <div className="space-y-2">
                                            {assetDetails[asset.id].recent_events.slice(0, 5).map((event, idx) => (
                                              <div key={idx} className="flex items-center space-x-3 text-xs text-gray-600">
                                                <span>{new Date(event.occurred_at).toLocaleString()}</span>
                                                <span className="capitalize">{event.event_type}</span>
                                                <div className="flex items-center gap-2">
                                                  <span className={`px-2 py-1 rounded-full ${getTrafficClassColor(event.event_class)}`}>
                                                    {getTrafficClassLabel(event.event_class)}
                                                  </span>
                                                  {event.event_class !== 'unknown' && (
                                                    <div className="relative group">
                                                      <Info className="h-3 w-3 text-gray-400 cursor-help" />
                                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                                                        {getTrafficClassDescription(event.event_class)}
                                                        {event.classification_reason && (
                                                          <div className="mt-1 pt-1 border-t border-gray-700">
                                                            <strong>Reason:</strong> {event.classification_reason}
                                                          </div>
                                                        )}
                                                        {event.classification_confidence && (
                                                          <div className="mt-1 pt-1 border-t border-gray-700">
                                                            <strong>Confidence:</strong> {(event.classification_confidence * 100).toFixed(0)}%
                                                          </div>
                                                        )}
                                                        {event.debug && event.debug.length > 0 && (
                                                          <div className="mt-1 pt-1 border-t border-gray-700">
                                                            <strong>Debug:</strong> {event.debug.join(', ')}
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                                <span>via {event.source_name || 'unknown'}</span>
                                                {event.path && <span>at {event.path}</span>}
                                              </div>
                                            ))}
                                          </div>
                                          <button
                                            onClick={() => loadAssetDetail(asset.id)}
                                            className="mt-2 text-xs text-blue-600 hover:text-blue-900"
                                          >
                                            Load more events...
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalGroups > filters.pageSize && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((filters.page - 1) * filters.pageSize) + 1} to {Math.min(filters.page * filters.pageSize, totalGroups)} of {totalGroups} groups
                  <span className="text-gray-500 ml-2">({total} total content assets)</span>
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
                    disabled={filters.page * filters.pageSize >= totalGroups}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Add Content Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Add Content Asset</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                    <input
                      type="url"
                      value={newAsset.url}
                      onChange={(e) => setNewAsset(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://example.com/page"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={newAsset.type}
                      onChange={(e) => setNewAsset(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="page">Page</option>
                      <option value="article">Article</option>
                      <option value="product">Product</option>
                    </select>
                  </div>
                  {addError && (
                    <div className="text-red-600 text-sm">{addError}</div>
                  )}
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowAddModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddAsset}
                      disabled={addingAsset || !newAsset.url.trim()}
                      className="flex-1 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addingAsset ? 'Adding...' : 'Add Asset'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
};

export default Content;

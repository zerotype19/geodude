import React, { useEffect, useState } from 'react';

interface VIRun {
  id: string;
  project_id: string;
  audit_id?: string;
  domain: string;
  audited_url: string;
  hostname: string;
  started_at: string;
  finished_at?: string;
  mode: 'on_demand' | 'scheduled';
  intents_count: number;
  sources: string[];
  status: 'processing' | 'complete' | 'failed';
}

interface VISummary {
  overall_score: number;
  coverage: Record<string, number>;
  counts: {
    total_citations: number;
    unique_domains_7d: number;
    mentions_7d: number;
    assistants: number;
  };
  top_intents: Array<{ query: string; visibility_score: number }>;
  top_citations: Array<{ ref_domain: string; count: number }>;
}

interface VIResult {
  source: string;
  intent_id: string;
  query: string;
  visibility_score: number;
  rank?: number;
  occurred_at: string;
}

interface VICitation {
  ref_url: string;
  ref_domain: string;
  title?: string;
  snippet?: string;
  rank?: number;
  is_audited_domain: boolean;
  source: string;
  query: string;
}

interface VisibilityIntelligenceTabProps {
  auditId: string;
  domain: string;
  projectId?: string;
}

const assistants = ["perplexity", "chatgpt", "claude"] as const;
type Assistant = typeof assistants[number];

export default function VisibilityIntelligenceTab({ auditId, domain, projectId }: VisibilityIntelligenceTabProps) {
  const [assistant, setAssistant] = useState<Assistant>("perplexity");
  const [run, setRun] = useState<VIRun | null>(null);
  const [summary, setSummary] = useState<VISummary | null>(null);
  const [results, setResults] = useState<VIResult[]>([]);
  const [citations, setCitations] = useState<VICitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [polling, setPolling] = useState(false);

  // Poll for results when run is processing
  useEffect(() => {
    if (!run || run.status !== 'processing' || polling) return;

    setPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        await fetchResults();
      } catch (error) {
        console.error('Error polling results:', error);
        setPolling(false);
        clearInterval(pollInterval);
      }
    }, 5000);

    // Stop polling after 3 minutes
    const timeout = setTimeout(() => {
      setPolling(false);
      clearInterval(pollInterval);
    }, 180000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
      setPolling(false);
    };
  }, [run, polling]);

  const fetchResults = async () => {
    try {
      const response = await fetch(`https://api.optiview.ai/api/vi/results?audit_id=${auditId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch results');
      }
      
      const data = await response.json();
      setRun(data.run);
      setSummary(data.summary);
      setResults(data.results || []);
      setCitations(data.citations || []);
      
      if (data.run?.status === 'complete' || data.run?.status === 'failed') {
        setPolling(false);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
      setError('Failed to load visibility results');
    }
  };

  const startRun = async () => {
    try {
      setRunning(true);
      setError(null);
      
      const response = await fetch('https://api.optiview.ai/api/vi/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audit_id: auditId,
          mode: 'on_demand',
          sources: assistants,
          max_intents: 100,
          regenerate_intents: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start run');
      }

      const data = await response.json();
      setRun(data);
      
      if (data.status === 'processing') {
        setPolling(true);
      }
    } catch (error) {
      console.error('Error starting run:', error);
      setError(error instanceof Error ? error.message : 'Failed to start visibility run');
    } finally {
      setRunning(false);
    }
  };

  const exportCSV = () => {
    if (!run) return;
    window.open(`https://api.optiview.ai/api/vi/export.csv?run_id=${run.id}`, '_blank');
  };

  useEffect(() => {
    fetchResults().finally(() => setLoading(false));
  }, [auditId]);

  const getAssistantColor = (assistant: string) => {
    switch (assistant) {
      case 'perplexity': return '#10b981';
      case 'chatgpt': return '#3b82f6';
      case 'claude': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-gray-500">Loading visibility intelligence...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Visibility Intelligence</h3>
          <p className="text-sm text-gray-600">AI assistant visibility for {domain}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {run?.status === 'processing' && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              Processing...
            </div>
          )}
          
          {run && run.status === 'complete' && (
            <button
              onClick={exportCSV}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border"
            >
              📥 Export CSV
            </button>
          )}
          
          {(!run || run.status === 'failed') && (
            <button
              onClick={startRun}
              disabled={running}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {running ? 'Starting...' : 'Run Visibility Analysis'}
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button 
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* No Run State */}
      {!run && !loading && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-lg text-gray-500 mb-4">No visibility analysis yet</div>
          <div className="text-sm text-gray-400 mb-6">
            Run a visibility analysis to see how {domain} appears in AI assistant responses
          </div>
          <button
            onClick={startRun}
            disabled={running}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {running ? 'Starting...' : 'Start Analysis'}
          </button>
        </div>
      )}

      {/* Results */}
      {run && summary && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-500 mb-1">Overall Score</div>
              <div className="text-3xl font-semibold text-blue-600">
                {summary.overall_score.toFixed(1)}
              </div>
            </div>
            <div className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-500 mb-1">Unique Domains (7d)</div>
              <div className="text-3xl font-semibold">
                {summary.counts.unique_domains_7d}
              </div>
            </div>
            <div className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-500 mb-1">Mentions (7d)</div>
              <div className="text-3xl font-semibold">
                {summary.counts.mentions_7d}
              </div>
            </div>
            <div className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-500 mb-1">Assistants</div>
              <div className="text-3xl font-semibold">
                {summary.counts.assistants}
              </div>
            </div>
          </div>

          {/* Assistant Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Filter by assistant:</span>
            {assistants.map(a => (
              <button
                key={a}
                onClick={() => setAssistant(a)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  assistant === a
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          {/* Coverage by Source */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h4 className="font-medium mb-3">Coverage by Assistant</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(summary.coverage).map(([source, coverage]) => (
                <div key={source} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{source}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full"
                        style={{ 
                          width: `${coverage * 100}%`,
                          backgroundColor: getAssistantColor(source)
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">
                      {(coverage * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Opportunities */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h4 className="font-medium mb-3">Top Opportunities</h4>
            <div className="space-y-2">
              {summary.top_intents.slice(0, 5).map((intent, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <span className="text-sm text-gray-700 flex-1">{intent.query}</span>
                  <span className="text-sm font-medium text-green-600">
                    {intent.visibility_score.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Citations */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h4 className="font-medium mb-3">Recent Citations</h4>
            <div className="space-y-3">
              {citations
                .filter(c => !assistant || c.source === assistant)
                .slice(0, 10)
                .map((citation, index) => (
                  <div key={index} className="flex items-start gap-3 py-2 border-b last:border-b-0">
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                      style={{ backgroundColor: getAssistantColor(citation.source) }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        <a 
                          href={citation.ref_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {citation.title || citation.ref_domain}
                        </a>
                      </div>
                      <div className="text-xs text-gray-500 mb-1">
                        {citation.ref_domain} • {formatDate(citation.occurred_at || run.started_at)}
                      </div>
                      {citation.snippet && (
                        <div className="text-xs text-gray-600 line-clamp-2">
                          {citation.snippet}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                        {citation.source}
                      </span>
                      {citation.is_audited_domain && (
                        <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                          Your Site
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Top Domains */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h4 className="font-medium mb-3">Top Domains</h4>
            <div className="space-y-2">
              {summary.top_citations.slice(0, 10).map((domain, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <span className="text-sm text-gray-700">{domain.ref_domain}</span>
                  <span className="text-sm font-medium text-gray-900">
                    {domain.count} citations
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

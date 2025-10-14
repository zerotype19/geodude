import React, { useState, useEffect } from 'react';
import AssistantTabs, { AssistantCounts } from './AssistantTabs';
import PromptList, { GroupedPrompt } from './PromptList';
import CitationPanel from './CitationPanel';

export interface GroupedVisibilityTabProps {
  auditId: string;
  domain: string;
  projectId: string;
}

export interface GroupedResults {
  audit_id: string;
  run_id: string;
  domain: string;
  selected_source: string;
  sources: string[];
  prompts: GroupedPrompt[];
  counts: Record<string, AssistantCounts>;
}

export default function GroupedVisibilityTab({ auditId, domain, projectId }: GroupedVisibilityTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GroupedResults | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [provenanceData, setProvenanceData] = useState<any>(null);
  const [overallCounts, setOverallCounts] = useState<Record<string, AssistantCounts>>({});

  const fetchOverallCounts = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_BASE || 'https://api.optiview.ai';
      const response = await fetch(`${apiBase}/api/vi/results:grouped?audit_id=${auditId}`);
      
      if (response.ok) {
        const data = await response.json();
        setOverallCounts(data.counts);
        
        // Select the source with the most audited citations if no source is selected
        if (!selectedSource && data.sources.length > 0) {
          let bestSource = data.sources[0];
          let maxAudited = 0;
          
          // Calculate audited citations for each source
          for (const source of data.sources) {
            const sourceData = await fetch(`${apiBase}/api/vi/results:grouped?audit_id=${auditId}&source=${source}`);
            if (sourceData.ok) {
              const sourceResults = await sourceData.json();
              const auditedCount = sourceResults.prompts.reduce((sum: number, p: any) => 
                sum + p.citations.filter((c: any) => c.was_audited).length, 0);
              
              if (auditedCount > maxAudited) {
                maxAudited = auditedCount;
                bestSource = source;
              }
            }
          }
          
          setSelectedSource(bestSource);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch overall counts:', err);
    }
  };

  const fetchGroupedResults = async (source: string = selectedSource) => {
    try {
      setLoading(true);
      setError(null);
      
      const apiBase = import.meta.env.VITE_API_BASE || 'https://api.optiview.ai';
      const response = await fetch(`${apiBase}/api/vi/results:grouped?audit_id=${auditId}&source=${source}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data);
      
      // Fetch provenance data for this audit
      try {
        const provenanceResponse = await fetch(`${apiBase}/api/vi/debug/provenance?audit_id=${auditId}`);
        if (provenanceResponse.ok) {
          const provenance = await provenanceResponse.json();
          setProvenanceData(provenance);
        }
      } catch (provenanceErr) {
        console.warn('Failed to fetch provenance data:', provenanceErr);
      }
      
      // Auto-select first prompt if none selected or if current selection is not in new data
      if (data.prompts.length > 0) {
        if (!selectedPromptId || !data.prompts.find(p => p.intent_id === selectedPromptId)) {
          setSelectedPromptId(data.prompts[0].intent_id);
        }
      }
      
    } catch (err) {
      console.error('Error fetching grouped results:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch results');
    } finally {
      setLoading(false);
    }
  };

  const handleSourceChange = (source: string) => {
    setSelectedSource(source);
    setSelectedPromptId(null); // Reset prompt selection when changing source
    fetchGroupedResults(source);
  };

  const handlePromptSelect = (promptId: string) => {
    setSelectedPromptId(promptId);
  };

  useEffect(() => {
    fetchOverallCounts();
  }, [auditId]);

  useEffect(() => {
    if (selectedSource) {
      fetchGroupedResults();
    }
  }, [selectedSource, auditId]);

  const selectedPrompt = results?.prompts.find(p => p.intent_id === selectedPromptId) || null;

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading visibility results...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-400 mr-3">⚠️</div>
            <div>
              <h3 className="text-sm font-medium text-red-800">Error loading results</h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
              <button 
                onClick={() => fetchGroupedResults()}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          <div className="text-lg mb-2">📊</div>
          <div>No visibility results found</div>
          <div className="text-sm mt-1">Run a visibility analysis to see results</div>
        </div>
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
          {provenanceData && (
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>Run: {results.run_id.split('_').pop()}</span>
              <span>Sources: {provenanceData.run?.sources?.join(', ') || 'N/A'}</span>
              <span>Status: {provenanceData.run?.status || 'N/A'}</span>
              {provenanceData.run?.created_at && (
                <span>Created: {new Date(provenanceData.run.created_at).toLocaleString()}</span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchGroupedResults()}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Assistant Tabs */}
      <AssistantTabs
        sources={results.sources}
        counts={Object.keys(overallCounts).length > 0 ? overallCounts : results.counts}
        selectedSource={selectedSource}
        onSourceChange={handleSourceChange}
      />

      {/* Wins & Gaps Analysis */}
      {overallCounts && (
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <h4 className="font-medium text-gray-900 mb-3">Performance Analysis</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(overallCounts).map(([source, counts]) => {
              const sourcePrompts = results.prompts.filter(p => p.source === source);
              const auditedCount = sourcePrompts.reduce((sum, p) => 
                sum + p.citations.filter(c => c.was_audited).length, 0);
              const auditedRate = counts.citations > 0 ? Math.round((auditedCount / counts.citations) * 100) : 0;
              
              const wins = sourcePrompts.filter(p => p.citations.some(c => c.was_audited));
              const gaps = sourcePrompts.filter(p => !p.citations.some(c => c.was_audited));
              
              return (
                <div key={source} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${
                      source === 'perplexity' ? 'bg-green-500' :
                      source === 'chatgpt_search' ? 'bg-blue-500' : 'bg-orange-500'
                    }`}></div>
                    <span className="font-medium capitalize">
                      {source === 'chatgpt_search' ? 'ChatGPT' : source}
                    </span>
                    <span className="text-sm text-gray-500">({auditedRate}% audited)</span>
                  </div>
                  
                  {wins.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-medium text-green-600 mb-1">Wins ({wins.length})</div>
                      {wins.slice(0, 2).map(prompt => (
                        <div key={prompt.intent_id} className="text-xs text-gray-600 truncate">
                          "{prompt.prompt_text.substring(0, 40)}..."
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {gaps.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-orange-600 mb-1">Gaps ({gaps.length})</div>
                      {gaps.slice(0, 2).map(prompt => (
                        <div key={prompt.intent_id} className="text-xs text-gray-600 truncate">
                          "{prompt.prompt_text.substring(0, 40)}..."
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Prompt List */}
        <div className="space-y-4">
          <PromptList
            prompts={results.prompts}
            selectedPromptId={selectedPromptId}
            onPromptSelect={handlePromptSelect}
          />
        </div>

        {/* Right Column: Citation Panel */}
        <div className="space-y-4">
          <CitationPanel
            prompt={selectedPrompt}
            domain={domain}
          />
        </div>
      </div>

      {/* Top Competitors Table */}
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <h4 className="font-medium text-gray-900 mb-3">Top Competitors Cited</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium text-gray-700">Domain</th>
                <th className="pb-2 font-medium text-gray-700">Citations</th>
                <th className="pb-2 font-medium text-gray-700">Sample Pages</th>
                <th className="pb-2 font-medium text-gray-700">Content Ideas</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Aggregate competitor domains
                const competitorMap = new Map();
                results.prompts.forEach(prompt => {
                  prompt.citations.forEach(citation => {
                    if (!citation.was_audited) {
                      const domain = citation.ref_domain;
                      if (!competitorMap.has(domain)) {
                        competitorMap.set(domain, {
                          domain,
                          count: 0,
                          samples: new Set(),
                          title: citation.title
                        });
                      }
                      const entry = competitorMap.get(domain);
                      entry.count++;
                      entry.samples.add(citation.title);
                    }
                  });
                });
                
                // Sort by count and take top 5
                const competitors = Array.from(competitorMap.values())
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 5);
                
                return competitors.map(competitor => (
                  <tr key={competitor.domain} className="border-b">
                    <td className="py-2 font-medium text-gray-900">{competitor.domain}</td>
                    <td className="py-2 text-gray-600">{competitor.count}</td>
                    <td className="py-2 text-gray-600 max-w-xs truncate" title={competitor.title}>
                      {competitor.title?.substring(0, 50)}...
                    </td>
                    <td className="py-2">
                      <button 
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                        onClick={() => {
                          const ideas = [
                            `Create ${competitor.domain} coverage explainer`,
                            `Add risks & limitations comparison`,
                            `Develop neutral comparison guide`
                          ].join('\n');
                          navigator.clipboard.writeText(ideas);
                        }}
                      >
                        Copy ideas
                      </button>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-gray-50 border rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {results.prompts.length}
            </div>
            <div className="text-sm text-gray-600">Prompts</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {results.prompts.reduce((sum, p) => sum + p.citations.length, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Citations</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-600">
              {results.prompts.reduce((sum, p) => sum + p.citations.filter(c => c.was_audited).length, 0)}
            </div>
            <div className="text-sm text-gray-600">Your Site</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-orange-600">
              {results.prompts.reduce((sum, p) => sum + p.citations.filter(c => !c.was_audited).length, 0)}
            </div>
            <div className="text-sm text-gray-600">Competitors</div>
          </div>
        </div>
      </div>
    </div>
  );
}

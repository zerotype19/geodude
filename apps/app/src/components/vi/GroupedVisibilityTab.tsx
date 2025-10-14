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
  const [selectedSource, setSelectedSource] = useState<string>('chatgpt_search');
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [provenanceData, setProvenanceData] = useState<any>(null);

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
      
      // Auto-select first prompt if none selected
      if (data.prompts.length > 0 && !selectedPromptId) {
        setSelectedPromptId(data.prompts[0].intent_id);
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
    fetchGroupedResults();
  }, [auditId]);

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
        counts={results.counts}
        selectedSource={selectedSource}
        onSourceChange={handleSourceChange}
      />

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

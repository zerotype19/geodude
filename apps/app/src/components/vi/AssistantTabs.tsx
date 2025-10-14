import React from 'react';

export interface AssistantCounts {
  prompts: number;
  citations: number;
}

export interface AssistantTabsProps {
  sources: string[];
  counts: Record<string, AssistantCounts>;
  selectedSource: string;
  onSourceChange: (source: string) => void;
}

const getAssistantDisplayName = (source: string): string => {
  switch (source) {
    case 'perplexity': return 'Perplexity';
    case 'chatgpt_search': return 'ChatGPT';
    case 'claude': return 'Claude';
    default: return source;
  }
};

const getAssistantColor = (source: string): string => {
  switch (source) {
    case 'perplexity': return '#10b981'; // green
    case 'chatgpt_search': return '#3b82f6'; // blue
    case 'claude': return '#f59e0b'; // amber
    default: return '#6b7280'; // gray
  }
};

export default function AssistantTabs({ sources, counts, selectedSource, onSourceChange }: AssistantTabsProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <span className="text-sm font-medium text-gray-700">Assistant:</span>
      {sources.map(source => {
        const count = counts[source] || { prompts: 0, citations: 0 };
        const isSelected = selectedSource === source;
        const hasResults = count.citations > 0;
        
        return (
          <button
            key={source}
            onClick={() => onSourceChange(source)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
              ${isSelected 
                ? 'bg-white text-gray-900 border-2 border-gray-300 shadow-sm' 
                : hasResults 
                  ? 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-white hover:border-gray-300 hover:shadow-sm' 
                  : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
              }
            `}
            disabled={false}
            title={hasResults ? `${count.prompts} prompts, ${count.citations} citations` : 'No results available'}
          >
            <div 
              className="w-2 h-2 rounded-full opacity-70"
              style={{ backgroundColor: getAssistantColor(source) }}
            ></div>
            <span>{getAssistantDisplayName(source)}</span>
            {hasResults && (
              <span className={`
                px-2 py-0.5 rounded-full text-xs
                ${isSelected ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600'}
              `}>
                {count.citations}
              </span>
            )}
            {!hasResults && (
              <span className="text-xs opacity-50">⚠️</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

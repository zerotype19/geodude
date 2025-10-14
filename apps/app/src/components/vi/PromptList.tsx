import React from 'react';

export interface GroupedPrompt {
  intent_id: string;
  source: string;
  kind: 'branded' | 'non_branded';
  prompt_text: string;
  prompt_reason: string;
  citations: any[];
}

export interface PromptListProps {
  prompts: GroupedPrompt[];
  selectedPromptId: string | null;
  onPromptSelect: (promptId: string) => void;
}

export default function PromptList({ prompts, selectedPromptId, onPromptSelect }: PromptListProps) {
  if (prompts.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <div className="text-center text-gray-500">
          <div className="text-lg mb-2">📝</div>
          <div>No prompts found</div>
          <div className="text-sm mt-1">Try running a new analysis</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="font-medium text-gray-900">Generated Prompts</h3>
        <p className="text-sm text-gray-600 mt-1">
          {prompts.length} prompt{prompts.length !== 1 ? 's' : ''} sent to AI assistants
        </p>
      </div>
      
      <div className="p-4 space-y-3">
        {prompts.map((prompt, index) => {
          const isSelected = selectedPromptId === prompt.intent_id;
          const citationCount = prompt.citations.length;
          
          return (
            <button
              key={prompt.intent_id}
              onClick={() => onPromptSelect(prompt.intent_id)}
              className={`
                w-full p-3 text-left transition-all duration-200 border rounded-lg bg-white
                ${isSelected 
                  ? 'border-blue-500 ring-1 ring-blue-200 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`
                      px-2 py-1 rounded-full text-xs font-medium border
                      ${prompt.kind === 'branded' 
                        ? 'border-blue-200 text-blue-700 bg-blue-50' 
                        : 'border-gray-200 text-gray-700 bg-gray-50'
                      }
                    `}>
                      {prompt.kind === 'branded' ? 'Branded' : 'Non-branded'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {citationCount} citation{citationCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <div className="text-sm font-medium text-gray-900 mb-1">
                    "{prompt.prompt_text}"
                  </div>
                  
                  <div className="text-xs text-gray-500" title={prompt.prompt_reason}>
                    {prompt.prompt_reason}
                  </div>
                </div>
                
                <div className="flex-shrink-0">
                  <div className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                    ${isSelected 
                      ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                      : 'bg-gray-100 text-gray-600'
                    }
                  `}>
                    {index + 1}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

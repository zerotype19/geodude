/**
 * Assistant Citation Chips
 * 
 * Shows which AI assistants cited this page
 */

interface AssistantChipsProps {
  assistants?: string[];
  citationCount?: number;
}

const ASSISTANT_COLORS: Record<string, string> = {
  chatgpt: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  claude: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  perplexity: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  brave: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
};

const ASSISTANT_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  perplexity: 'Perplexity',
  brave: 'Brave'
};

export default function AssistantChips({ assistants, citationCount }: AssistantChipsProps) {
  if (!assistants || assistants.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Cited by:
      </span>
      {assistants.map((assistant) => {
        const normalized = assistant.toLowerCase();
        const color = ASSISTANT_COLORS[normalized] || 'bg-gray-100 text-gray-800';
        const label = ASSISTANT_LABELS[normalized] || assistant;
        
        return (
          <span
            key={assistant}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
          >
            {label}
          </span>
        );
      })}
      {citationCount && citationCount > 1 && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          ({citationCount}×)
        </span>
      )}
    </div>
  );
}


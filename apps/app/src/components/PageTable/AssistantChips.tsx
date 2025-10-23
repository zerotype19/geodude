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
  chatgpt: 'bg-success-soft text-success',
  claude: 'bg-warn-soft text-warn',
  perplexity: 'bg-brand-soft text-brand',
  brave: 'bg-brand-soft text-brand'
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
      <span className="text-xs subtle dark:subtle">
        Cited by:
      </span>
      {assistants.map((assistant) => {
        const normalized = assistant.toLowerCase();
        const color = ASSISTANT_COLORS[normalized] || 'bg-surface-2 text-ink';
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
        <span className="text-xs subtle dark:subtle">
          ({citationCount}×)
        </span>
      )}
    </div>
  );
}


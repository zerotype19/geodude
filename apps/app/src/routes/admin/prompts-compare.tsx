import { useState } from 'react';

interface PromptSet {
  branded: string[];
  nonBranded: string[];
  meta?: {
    industry?: string;
    template_version?: string;
    realism_avg?: number;
    source?: string;
    realism_target?: number;
    source_path?: string;
    prompt_gen_version?: string;
  };
}

export default function PromptsComparePage() {
  const [domain, setDomain] = useState('cologuard.com');
  const [loading, setLoading] = useState(false);
  const [rulesPrompts, setRulesPrompts] = useState<PromptSet | null>(null);
  const [aiPrompts, setAIPrompts] = useState<PromptSet | null>(null);
  const [blendedPrompts, setBlendedPrompts] = useState<PromptSet | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPrompts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all three modes in parallel
      const [rules, ai, blended] = await Promise.all([
        fetch(`https://api.optiview.ai/api/llm/prompts?domain=${domain}&mode=rules&nocache=1`).then(r => r.json()),
        fetch(`https://api.optiview.ai/api/llm/prompts?domain=${domain}&mode=ai&nocache=1`).then(r => r.json()),
        fetch(`https://api.optiview.ai/api/llm/prompts?domain=${domain}&mode=blended&nocache=1`).then(r => r.json()),
      ]);

      setRulesPrompts(rules);
      setAIPrompts(ai);
      setBlendedPrompts(blended);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prompts');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPrompts();
  };

  const renderChip = (label: string, value: string | number | undefined, color: string) => {
    if (!value) return null;
    return (
      <span className={`inline-block px-2 py-1 text-xs rounded ${color} font-medium`}>
        {label}: {value}
      </span>
    );
  };

  const renderPromptColumn = (title: string, prompts: PromptSet | null, bgColor: string) => (
    <div className={`flex-1 ${bgColor} rounded-lg p-6`}>
      <h3 className="text-lg font-bold mb-4 text-gray-900">{title}</h3>
      
      {prompts && (
        <>
          {/* Metadata Chips */}
          <div className="mb-4 flex flex-wrap gap-2">
            {renderChip('Industry', prompts.meta?.industry, 'bg-blue-100 text-blue-800')}
            {renderChip('Version', prompts.meta?.prompt_gen_version || prompts.meta?.template_version, 'bg-purple-100 text-purple-800')}
            {renderChip('Source', prompts.meta?.source, 'bg-green-100 text-green-800')}
            {renderChip('Branded', prompts.branded?.length, 'bg-yellow-100 text-yellow-800')}
            {renderChip('Non-Branded', prompts.nonBranded?.length, 'bg-orange-100 text-orange-800')}
            {prompts.meta?.realism_avg && renderChip('Realism', prompts.meta.realism_avg.toFixed(3), 'bg-pink-100 text-pink-800')}
            {prompts.meta?.realism_target && renderChip('Target', prompts.meta.realism_target.toFixed(2), 'bg-indigo-100 text-indigo-800')}
          </div>

          {/* Branded Queries */}
          <div className="mb-6">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">
              Branded ({prompts.branded?.length || 0})
            </h4>
            <div className="space-y-1">
              {prompts.branded?.map((q, i) => (
                <div key={i} className="text-sm bg-white/50 rounded px-2 py-1">
                  {i + 1}. {q}
                </div>
              ))}
            </div>
          </div>

          {/* Non-Branded Queries */}
          <div>
            <h4 className="font-semibold text-sm text-gray-700 mb-2">
              Non-Branded ({prompts.nonBranded?.length || 0})
            </h4>
            <div className="space-y-1">
              {prompts.nonBranded?.map((q, i) => (
                <div key={i} className="text-sm bg-white/50 rounded px-2 py-1">
                  {i + 1}. {q}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <a href="/admin" className="text-blue-600 hover:underline">← Admin</a>
            <h1 className="text-3xl font-bold text-gray-900">Prompts Compare</h1>
          </div>
          <p className="text-gray-600">Compare Rules | AI | Blended prompt generation side-by-side</p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="mb-8 bg-white rounded-lg shadow p-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
                Domain
              </label>
              <input
                type="text"
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g., cologuard.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Compare Prompts'}
              </button>
            </div>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 text-red-800 rounded-lg">
            {error}
          </div>
        )}

        {/* Comparison Columns */}
        {(rulesPrompts || aiPrompts || blendedPrompts) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {renderPromptColumn('Rules (V3)', rulesPrompts, 'bg-blue-50')}
            {renderPromptColumn('AI (V4)', aiPrompts, 'bg-green-50')}
            {renderPromptColumn('Blended (Production)', blendedPrompts, 'bg-purple-50')}
          </div>
        )}

        {/* Instructions */}
        {!rulesPrompts && !aiPrompts && !blendedPrompts && !loading && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
            <p className="mb-4">Enter a domain and click "Compare Prompts" to see:</p>
            <ul className="text-left max-w-2xl mx-auto space-y-2">
              <li>• <strong>Rules</strong>: V3 template-based generation (legacy)</li>
              <li>• <strong>AI</strong>: V4 LLM-native generation (with MSS fallback)</li>
              <li>• <strong>Blended</strong>: Current production mode (V4 + quality gates)</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}


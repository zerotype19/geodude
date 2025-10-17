import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CHECKS } from "../../content/score-guide/checks";

export default function ScoreGuideIndex() {
  const [q, setQ] = useState("");
  
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return CHECKS;
    return CHECKS.filter(c =>
      [c.id, c.slug, c.title, c.category, c.summary].join(" ").toLowerCase().includes(needle)
    );
  }, [q]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-6xl p-6 space-y-6">
        <header className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Optiview Scoring Guide</h1>
              <p className="text-neutral-400 mt-2">
                Examples and implementation notes for every AEO/GEO check.
              </p>
            </div>
            <Link
              to="/"
              className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
          
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search checks (e.g., schema, FAQ, crawl, author)"
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          
          <div className="text-sm text-neutral-400">
            {filtered.length} {filtered.length === 1 ? "check" : "checks"} 
            {q && ` matching "${q}"`}
          </div>
        </header>

        <div className="divide-y divide-neutral-800 rounded-lg border border-neutral-800 bg-neutral-900/50">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-5 hover:bg-neutral-900 transition-colors">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs font-medium">
                    {c.id}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {c.category} · W{c.weight}
                  </span>
                </div>
                <div className="font-semibold text-white">{c.title}</div>
                <div className="text-neutral-400 text-sm">{c.summary}</div>
              </div>
              <Link
                className="ml-4 rounded-md bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap"
                to={`/score-guide/${c.slug}#examples`}
              >
                View examples →
              </Link>
            </div>
          ))}
          
          {filtered.length === 0 && (
            <div className="p-8 text-center text-neutral-400">
              No checks match your search. Try different keywords.
            </div>
          )}
        </div>

        <footer className="border-t border-neutral-800 pt-6 text-sm text-neutral-400">
          <p>
            💡 <strong>Tip:</strong> Click any check to see good vs. bad examples, implementation steps, and QA checklists.
          </p>
        </footer>
      </div>
    </div>
  );
}


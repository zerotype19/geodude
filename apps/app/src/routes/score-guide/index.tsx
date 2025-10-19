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
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Optiview AEO + GEO Scoring Guide</h1>
              <p className="text-gray-600 mt-2">
                Examples and implementation notes for every AEO/GEO check.
              </p>
            </div>
            <Link
              to="/"
              className="text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>

          {/* Overview Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">How to read your scores</h2>
            <div className="space-y-3 text-gray-700 text-sm">
              <p>
                <strong>Two rollups:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>AEO (Answer Engine Optimization)</strong>: how well your pages win Google/Bing answer-like surfaces (featured snippets, AI Overviews eligibility, rich results).</li>
                <li><strong>GEO (Generative Engine Optimization)</strong>: how well your content is cited/used by LLMs and answer engines (ChatGPT/Claude/Perplexity).</li>
              </ul>
              
              <p>
                <strong>Per-page checks:</strong> 21 items (A1–A11 for AEO, G1–G10 for GEO). Each scores <strong>0–3</strong>:
                <br />0 = Missing, 1 = Partial, 2 = Meets, 3 = Exceeds.
              </p>
              
              <p>
                <strong>Weights:</strong> Each check has a weight (ranging from 4 to 15). Your page score = Σ(weight × score/3). Site score = average of page scores.
              </p>
              
              <p>
                <strong>Site-level penalties:</strong> AEO scores may receive up to a <strong>-5 point penalty</strong> if average render visibility falls below 30% (reduced visibility of key schema and copy in raw HTML). GEO scores may receive a <strong>-5 to -10 point penalty</strong> if average render visibility is below 50%.
              </p>
              
              <p>
                <strong>Top Blockers:</strong> highest-impact low scores. <strong>Quick Wins:</strong> easiest high-impact fixes.
              </p>
              
              <p>
                <strong>Evidence:</strong> In page details, expand a check to see why it scored (detected schema, facts count, links, etc.).
              </p>
            </div>
          </div>

          {/* Priority Bands Legend */}
          <div className="flex items-center gap-6 text-sm">
            <div className="font-semibold text-gray-700">Priority bands:</div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-gray-700"><strong>Red (0–1):</strong> fix now</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-500 rounded"></div>
              <span className="text-gray-700"><strong>Amber (2):</strong> acceptable; improve when possible</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-gray-700"><strong>Green (3):</strong> exemplar; keep stable</span>
            </div>
          </div>
          
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search checks (e.g., schema, FAQ, crawl, author)"
            className="w-full rounded-md border border-gray-300 bg-white p-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          
          <div className="text-sm text-gray-600">
            {filtered.length} {filtered.length === 1 ? "check" : "checks"} 
            {q && ` matching "${q}"`}
          </div>
        </header>

        <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {c.id}
                  </span>
                  <span className="text-xs text-gray-500">
                    {c.category} · W{c.weight}
                  </span>
                </div>
                <div className="font-semibold text-gray-900">{c.title}</div>
                <div className="text-gray-600 text-sm">{c.summary}</div>
              </div>
              <Link
                className="ml-4 rounded-md bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap"
                to={`/score-guide/${c.slug}#examples`}
              >
                View examples →
              </Link>
            </div>
          ))}
          
          {filtered.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No checks match your search. Try different keywords.
            </div>
          )}
        </div>

        {/* Quick Implementation Snippets */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Quick Implementation Snippets</h2>
          
          <div className="space-y-6">
            {/* Answer-first block */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Answer-first block (A1)</h3>
              <pre className="bg-gray-50 border border-gray-300 rounded p-4 overflow-x-auto text-sm"><code>{`<section id="summary">
  <p><strong>Short answer:</strong> … 2–4 sentences …</p>
  <nav aria-label="Jump to">
    <a href="#steps">Steps</a> · <a href="#pros-cons">Pros & cons</a> · <a href="#sources">Sources</a>
  </nav>
</section>`}</code></pre>
            </div>

            {/* Key Facts */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Key Facts (G1)</h3>
              <pre className="bg-gray-50 border border-gray-300 rounded p-4 overflow-x-auto text-sm"><code>{`<section id="key-facts">
  <h2>Key facts</h2>
  <ul>
    <li id="fact-eligibility-2025">Eligibility changes in 2025: …</li>
    <li id="fact-fee">Fee is $99/year …</li>
    <li id="fact-sla">SLA: 99.9% …</li>
  </ul>
</section>`}</code></pre>
            </div>

            {/* References */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">References (A4/G3)</h3>
              <pre className="bg-gray-50 border border-gray-300 rounded p-4 overflow-x-auto text-sm"><code>{`<section id="sources">
  <h2>References</h2>
  <ol>
    <li><a href="https://example.org/study">Study A</a></li>
    <li><a href="https://gov.example/reg-2025">Regulation 2025</a></li>
  </ol>
</section>`}</code></pre>
            </div>

            {/* JSON-LD */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Article/CreativeWork JSON-LD (A3–A5, G2, G8, G9)</h3>
              <pre className="bg-gray-50 border border-gray-300 rounded p-4 overflow-x-auto text-sm"><code>{`<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"Article",
  "headline":"How to do X in 5 Steps",
  "url":"https://www.example.com/how-to-x",
  "datePublished":"2025-02-10",
  "dateModified":"2025-03-01",
  "author":{"@type":"Person","name":"Author Name","url":"https://www.example.com/authors/author"},
  "publisher":{"@type":"Organization","name":"Your Brand","url":"https://www.example.com"},
  "citation":[{"@type":"WebPage","name":"Study A","url":"https://example.org/study"}],
  "isBasedOn":[{"@type":"Dataset","name":"Dataset Y","url":"https://www.example.com/datasets/y"}],
  "license":"https://www.example.com/content-license"
}
</script>`}</code></pre>
            </div>

            {/* Robots stance */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Robots stance for AI bots (G4)</h3>
              <pre className="bg-gray-50 border border-gray-300 rounded p-4 overflow-x-auto text-sm"><code>{`User-agent: GPTBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: *
Disallow:
(Change "Allow" to "Disallow" per policy.)`}</code></pre>
            </div>
          </div>
        </div>

        {/* How to Use Dashboard */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">How to use the Optiview dashboard</h2>
          <ol className="list-decimal pl-5 space-y-2 text-gray-700">
            <li><strong>Open an audit → Top Blockers:</strong> Work through the highest-weight 0/1 items first (A1/A2/A3 and G1/G2/G4).</li>
            <li><strong>Open a page → Evidence:</strong> Expand a check to see what we detected (facts count, schema types, etc.). Fix and click Recompute.</li>
            <li><strong>Watch site score move:</strong> As you green A1–A3 (AEO) and G1–G2/G4 (GEO), overall scores jump.</li>
          </ol>
        </div>

        {/* Common Pitfalls */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Common pitfalls (and fixes)</h2>
          <ul className="space-y-2 text-gray-700">
            <li><strong>Fancy content hidden behind JS</strong> → server-render key blocks & JSON-LD (G4).</li>
            <li><strong>Endless "ultimate guide" pages with no anchors</strong> → split into smaller pages; add stable anchors (G5/G6).</li>
            <li><strong>FAQ spam</strong> → keep FAQs but don't rely on them; focus on answer-first + facts + provenance (A1/G1/G2).</li>
            <li><strong>No unique assets</strong> → publish a simple CSV or diagram with method notes (A4/G7).</li>
          </ul>
        </div>

        {/* Definition of Done */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Definition of "Done" per item (fast acceptance)</h2>
          <ul className="space-y-2 text-gray-700">
            <li><strong>A1/G1:</strong> Answer + Key Facts present above the fold; ≥3 bullets; jump links.</li>
            <li><strong>A3/G2:</strong> JSON-LD passes validator; citation/isBasedOn/license present.</li>
            <li><strong>A4/G7:</strong> At least one downloadable dataset or tool is linked.</li>
            <li><strong>G4:</strong> Robots stance explicit for GPTBot/Claude-Web/Perplexity; parity pass.</li>
            <li><strong>G9:</strong> Visible changelog + dateModified updated.</li>
          </ul>
        </div>

        <footer className="border-t border-gray-200 pt-6 space-y-2">
          <p className="text-sm text-gray-600">
            💡 <strong>Tip:</strong> Click any check to see good vs. bad examples, implementation steps, and QA checklists.
          </p>
          <div className="text-xs text-gray-500 border-t border-gray-100 pt-4">
            <p><strong>Document version:</strong> 2.0</p>
            <p><strong>Last revised:</strong> January 17, 2025 at 18:45 UTC</p>
            <p><strong>Changes:</strong> Updated AEO/GEO render visibility penalty thresholds (AEO: &lt;30%, GEO: &lt;50%), added FAQPage/HowTo deprecation note, clarified Google-Extended training access, documented real-world crawler non-compliance, made ToC optional for A1, updated A10 citation language to "Sources section", added evolving AIO behavior note.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}


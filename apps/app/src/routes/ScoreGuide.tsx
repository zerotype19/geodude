import React from 'react';

const ScoreGuide: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="prose prose-lg max-w-none">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Optiview AEO + GEO Scoring Guide</h1>
        
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
          <h2 className="text-xl font-semibold text-blue-800 mb-2">How to read your scores</h2>
          <ul className="list-disc list-inside text-blue-700 space-y-2">
            <li><strong>Two rollups:</strong>
              <ul className="list-disc list-inside ml-6 mt-2">
                <li><strong>AEO</strong> (Answer Engine Optimization): how well your pages win Google/Bing answer-like surfaces (featured snippets, AI Overviews eligibility, rich results).</li>
                <li><strong>GEO</strong> (Generative Engine Optimization): how well your content is cited/used by LLMs and answer engines (ChatGPT/Claude/Perplexity).</li>
              </ul>
            </li>
            <li><strong>Per-page checks:</strong> 20 items (A1–A10, G1–G10). Each scores <strong>0–3</strong>:
              <ul className="list-disc list-inside ml-6 mt-2">
                <li><strong>0</strong> Missing, <strong>1</strong> Partial, <strong>2</strong> Meets, <strong>3</strong> Exceeds.</li>
              </ul>
            </li>
            <li><strong>Weights:</strong> Each check has a weight. Your page score = Σ(weight × score/3). Site score = average of page scores.</li>
            <li><strong>Top Blockers:</strong> highest-impact low scores. <strong>Quick Wins:</strong> easiest high-impact fixes.</li>
            <li><strong>Evidence:</strong> In page details, expand a check to see <em>why</em> it scored (detected schema, facts count, links, etc.).</li>
          </ul>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Priority bands</h3>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-red-700"><strong>Red (0–1):</strong> fix now.</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-yellow-700"><strong>Amber (2):</strong> acceptable; improve when possible.</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-green-700"><strong>Green (3):</strong> exemplar; keep stable.</span>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-6">AEO (Answer Engine Optimization)</h2>

        <div className="space-y-8">
          <div className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-50">
            <h3 className="text-xl font-semibold text-blue-800 mb-2">A1 — Answer-first design (weight 15)</h3>
            <p className="text-blue-700 mb-3"><strong>What we check:</strong> A concise answer in the first ~600–800 chars, jump links/ToC, a scannable list/table near the top.</p>
            <p className="text-blue-700 mb-3"><strong>Why it matters:</strong> Reduces pogo-sticking; aligns with engagement-re-ranking and snippet eligibility.</p>
            <div className="text-blue-700">
              <p className="mb-2"><strong>How to win:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Add a <strong>2–4 sentence answer</strong> at the top.</li>
                <li>Include a <strong>"Jump to"</strong> ToC with in-page anchors.</li>
                <li>Use a <strong>step list</strong> or <strong>table</strong> if procedural/comparative.</li>
              </ul>
              <p className="mt-2"><strong>Checklist:</strong> answer block, ToC, H2 steps, short paragraphs.</p>
              <p className="text-sm mt-2 italic"><strong>Tooltip:</strong> "Put the answer at the top with jump links and a scannable list/table."</p>
            </div>
          </div>

          <div className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-50">
            <h3 className="text-xl font-semibold text-blue-800 mb-2">A2 — Topical cluster integrity (15)</h3>
            <p className="text-blue-700 mb-3"><strong>Checks:</strong> Page links to/from a pillar; breadcrumb present; cluster-internal links use descriptive anchors.</p>
            <p className="text-blue-700 mb-3"><strong>Win:</strong> Create a pillar ("/topic/") and 6–15 focused subpages; interlink them; add breadcrumbs.</p>
            <p className="text-sm text-blue-600 italic"><strong>Tooltip:</strong> "Belongs to a tight cluster with pillar links and breadcrumb."</p>
          </div>

          <div className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-50">
            <h3 className="text-xl font-semibold text-blue-800 mb-2">A3 — Host / site-level authority (15)</h3>
            <p className="text-blue-700 mb-3"><strong>Checks:</strong> Valid <code>Organization</code> + <code>Person</code> JSON-LD, About/Contact, author pages.</p>
            <p className="text-blue-700 mb-3"><strong>Win:</strong> Add <strong>Organization</strong> schema site-wide; author bios with credentials; visible editorial standards.</p>
            <p className="text-sm text-blue-600 italic"><strong>Tooltip:</strong> "Clear Organization & Author identity with valid schema."</p>
          </div>

          <div className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-50">
            <h3 className="text-xl font-semibold text-blue-800 mb-2">A4 — Originality & effort (12)</h3>
            <p className="text-blue-700 mb-3"><strong>Checks:</strong> Unique assets: data tables, tools, diagrams, code; references/method notes.</p>
            <p className="text-blue-700 mb-3"><strong>Win:</strong> Publish a downloadable asset (CSV/JSON, calculator, diagram) and explain your method.</p>
            <p className="text-sm text-blue-600 italic"><strong>Tooltip:</strong> "Unique assets & method—hard to copy."</p>
          </div>

          <div className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-50">
            <h3 className="text-xl font-semibold text-blue-800 mb-2">A5 — Schema accuracy & breadth (10)</h3>
            <p className="text-blue-700 mb-3"><strong>Checks:</strong> Valid JSON-LD types (<code>Article</code>, <code>HowTo</code>, <code>FAQPage</code>, <code>QAPage</code>, <code>Product</code>, <code>BreadcrumbList</code>)—no errors.</p>
            <p className="text-blue-700 mb-3"><strong>Win:</strong> Use server-rendered JSON-LD; minimum viable properties per type; validate.</p>
            <p className="text-sm text-blue-600 italic"><strong>Tooltip:</strong> "Correct JSON-LD for the page intent; no errors."</p>
          </div>

          <div className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-50">
            <h3 className="text-xl font-semibold text-blue-800 mb-2">A6 — Crawlability & canonicals (10)</h3>
            <p className="text-blue-700 mb-3"><strong>Checks:</strong> Self-canonical; unique title/H1; not <code>noindex</code>; no duplicate canonicals in cluster.</p>
            <p className="text-blue-700 mb-3"><strong>Win:</strong> One canonical per URL; dedupe similar pages; stable titles/H1s.</p>
            <p className="text-sm text-blue-600 italic"><strong>Tooltip:</strong> "Self-canonical, unique title/H1; crawlable."</p>
          </div>

          <div className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-50">
            <h3 className="text-xl font-semibold text-blue-800 mb-2">A7 — UX & performance proxies (8)</h3>
            <p className="text-blue-700 mb-3"><strong>Checks:</strong> No big CLS above the fold; images have width/height; proper viewport; lazy-load below fold.</p>
            <p className="text-blue-700 mb-3"><strong>Win:</strong> Reserve image space; avoid layout shifts near the answer block.</p>
            <p className="text-sm text-blue-600 italic"><strong>Tooltip:</strong> "Stable above-the-fold; no jumpy layout."</p>
          </div>

          <div className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-50">
            <h3 className="text-xl font-semibold text-blue-800 mb-2">A8 — Sitemaps & discoverability (6)</h3>
            <p className="text-blue-700 mb-3"><strong>Checks:</strong> <code>/sitemap.xml</code> exists; fresh <code>lastmod</code>; child sitemaps valid.</p>
            <p className="text-blue-700 mb-3"><strong>Win:</strong> Generate per-section sitemaps; keep <code>lastmod</code> accurate.</p>
            <p className="text-sm text-blue-600 italic"><strong>Tooltip:</strong> "Sitemap present & fresh."</p>
          </div>

          <div className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-50">
            <h3 className="text-xl font-semibold text-blue-800 mb-2">A9 — Freshness & stability (5)</h3>
            <p className="text-blue-700 mb-3"><strong>Checks:</strong> <code>dateModified</code> present and increasing; internal links not 404; URL stable.</p>
            <p className="text-blue-700 mb-3"><strong>Win:</strong> Update cadence by topic; keep URLs stable; maintain link health.</p>
            <p className="text-sm text-blue-600 italic"><strong>Tooltip:</strong> "Shows updates; links work; URLs stay put."</p>
          </div>

          <div className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-50">
            <h3 className="text-xl font-semibold text-blue-800 mb-2">A10 — AI Overviews readiness (4)</h3>
            <p className="text-blue-700 mb-3"><strong>Checks:</strong> Clear task framing, steps/pros-cons/safety notes, at least one credible external citation.</p>
            <p className="text-blue-700 mb-3"><strong>Win:</strong> Add a "Summary" + "Steps" + "Considerations/Safety" + "Sources" section.</p>
            <p className="text-sm text-blue-600 italic"><strong>Tooltip:</strong> "Complete, safe, and well-cited answer for AIO."</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-6">GEO (Generative Engine Optimization)</h2>

        <div className="space-y-8">
          <div className="border-l-4 border-green-500 pl-6 py-4 bg-green-50">
            <h3 className="text-xl font-semibold text-green-800 mb-2">G1 — Citable "Key Facts" block (15)</h3>
            <p className="text-green-700 mb-3"><strong>Checks:</strong> "Key facts / At-a-glance" near top; 3–7 atomic bullets; optional anchors per fact.</p>
            <p className="text-green-700 mb-3"><strong>Win:</strong> Add a facts box with <strong>stable IDs</strong> (<code>#fact-eligibility-2025</code>).</p>
            <p className="text-sm text-green-600 italic"><strong>Tooltip:</strong> "3–7 atomic facts near the top (anchored)."</p>
          </div>

          <div className="border-l-4 border-green-500 pl-6 py-4 bg-green-50">
            <h3 className="text-xl font-semibold text-green-800 mb-2">G2 — Provenance schema (15)</h3>
            <p className="text-green-700 mb-3"><strong>Checks:</strong> <code>Article/CreativeWork</code> with <code>author</code>, <code>publisher</code>, <code>datePublished</code>, <code>dateModified</code>, <code>citation</code>, <code>isBasedOn</code>, <code>license</code>.</p>
            <p className="text-green-700 mb-3"><strong>Win:</strong> Include sources in JSON-LD, not just on page.</p>
            <p className="text-sm text-green-600 italic"><strong>Tooltip:</strong> "Author, publisher, dates + citation/isBasedOn/license in JSON-LD."</p>
          </div>

          <div className="border-l-4 border-green-500 pl-6 py-4 bg-green-50">
            <h3 className="text-xl font-semibold text-green-800 mb-2">G3 — Evidence density (12)</h3>
            <p className="text-green-700 mb-3"><strong>Checks:</strong> References section; outbound links to high-trust domains; tables/footnotes present.</p>
            <p className="text-green-700 mb-3"><strong>Win:</strong> Add <strong>References</strong> with primary sources and in-page tables (not images).</p>
            <p className="text-sm text-green-600 italic"><strong>Tooltip:</strong> "Good references & real data tables."</p>
          </div>

          <div className="border-l-4 border-green-500 pl-6 py-4 bg-green-50">
            <h3 className="text-xl font-semibold text-green-800 mb-2">G4 — AI crawler access & parity (12)</h3>
            <p className="text-green-700 mb-3"><strong>Checks:</strong> robots policy for GPTBot/Claude-Web/Perplexity; HTML ≈ rendered DOM for key blocks.</p>
            <p className="text-green-700 mb-3"><strong>Win:</strong> Set your desired allow/deny; ensure server HTML contains key content/schema.</p>
            <p className="text-sm text-green-600 italic"><strong>Tooltip:</strong> "Bots allowed/denied intentionally; content matches rendered."</p>
          </div>

          <div className="border-l-4 border-green-500 pl-6 py-4 bg-green-50">
            <h3 className="text-xl font-semibold text-green-800 mb-2">G5 — Chunkability & structure (10)</h3>
            <p className="text-green-700 mb-3"><strong>Checks:</strong> Short paragraphs; semantic headings; glossary; TL;DR summary.</p>
            <p className="text-green-700 mb-3"><strong>Win:</strong> Add TL;DR, Glossary, and keep sections small and well-labeled.</p>
            <p className="text-sm text-green-600 italic"><strong>Tooltip:</strong> "Chunked content with summary & glossary."</p>
          </div>

          <div className="border-l-4 border-green-500 pl-6 py-4 bg-green-50">
            <h3 className="text-xl font-semibold text-green-800 mb-2">G6 — Canonical fact URLs (8)</h3>
            <p className="text-green-700 mb-3"><strong>Checks:</strong> One URL per fact topic; stable anchor names.</p>
            <p className="text-green-700 mb-3"><strong>Win:</strong> Split omnibus pages; add stable anchors for linkable facts.</p>
            <p className="text-sm text-green-600 italic"><strong>Tooltip:</strong> "Stable URLs/anchors for individual facts."</p>
          </div>

          <div className="border-l-4 border-green-500 pl-6 py-4 bg-green-50">
            <h3 className="text-xl font-semibold text-green-800 mb-2">G7 — Dataset availability (8)</h3>
            <p className="text-green-700 mb-3"><strong>Checks:</strong> Downloadable CSV/JSON with version notes.</p>
            <p className="text-green-700 mb-3"><strong>Win:</strong> Host a <code>/datasets/</code> file per table; link it from the page.</p>
            <p className="text-sm text-green-600 italic"><strong>Tooltip:</strong> "Provide CSV/JSON with versions."</p>
          </div>

          <div className="border-l-4 border-green-500 pl-6 py-4 bg-green-50">
            <h3 className="text-xl font-semibold text-green-800 mb-2">G8 — Policy transparency (6)</h3>
            <p className="text-green-700 mb-3"><strong>Checks:</strong> Visible content license/AI reuse stance in UI + JSON-LD <code>license</code>.</p>
            <p className="text-green-700 mb-3"><strong>Win:</strong> Add a site-wide policy page and link it; include <code>license</code> in schema.</p>
            <p className="text-sm text-green-600 italic"><strong>Tooltip:</strong> "Clear license/AI policy shown & in schema."</p>
          </div>

          <div className="border-l-4 border-green-500 pl-6 py-4 bg-green-50">
            <h3 className="text-xl font-semibold text-green-800 mb-2">G9 — Update hygiene (7)</h3>
            <p className="text-green-700 mb-3"><strong>Checks:</strong> Visible changelog/"What changed" and <code>dateModified</code> aligned.</p>
            <p className="text-green-700 mb-3"><strong>Win:</strong> Add a small changelog block or <code>&lt;details&gt;</code> with edits and dates.</p>
            <p className="text-sm text-green-600 italic"><strong>Tooltip:</strong> "Changelog + dateModified kept in sync."</p>
          </div>

          <div className="border-l-4 border-green-500 pl-6 py-4 bg-green-50">
            <h3 className="text-xl font-semibold text-green-800 mb-2">G10 — Cluster ↔ evidence linking (7)</h3>
            <p className="text-green-700 mb-3"><strong>Checks:</strong> Pillars link to a <code>/sources</code> hub; hub links back.</p>
            <p className="text-green-700 mb-3"><strong>Win:</strong> Build a central <strong>Sources/Research</strong> page; link both ways.</p>
            <p className="text-sm text-green-600 italic"><strong>Tooltip:</strong> "Pillars link to a sources hub and back."</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-6">Quick implementation snippets</h2>

        <div className="space-y-6">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Answer-first block (A1)</h3>
            <pre className="bg-gray-800 text-green-400 p-4 rounded text-sm overflow-x-auto"><code>{`<section id="summary">
  <p><strong>Short answer:</strong> … 2–4 sentences …</p>
  <nav aria-label="Jump to">
    <a href="#steps">Steps</a> · <a href="#pros-cons">Pros & cons</a> · <a href="#sources">Sources</a>
  </nav>
</section>`}</code></pre>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Key Facts (G1)</h3>
            <pre className="bg-gray-800 text-green-400 p-4 rounded text-sm overflow-x-auto"><code>{`<section id="key-facts">
  <h2>Key facts</h2>
  <ul>
    <li id="fact-eligibility-2025">Eligibility changes in 2025: …</li>
    <li id="fact-fee">Fee is $99/year …</li>
    <li id="fact-sla">SLA: 99.9% …</li>
  </ul>
</section>`}</code></pre>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">References (A4/G3)</h3>
            <pre className="bg-gray-800 text-green-400 p-4 rounded text-sm overflow-x-auto"><code>{`<section id="sources">
  <h2>References</h2>
  <ol>
    <li><a href="https://example.org/study">Study A</a></li>
    <li><a href="https://gov.example/reg-2025">Regulation 2025</a></li>
  </ol>
</section>`}</code></pre>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Article/CreativeWork JSON-LD (A3–A5, G2, G8, G9)</h3>
            <pre className="bg-gray-800 text-green-400 p-4 rounded text-sm overflow-x-auto"><code>{`<script type="application/ld+json">
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

          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Robots stance for AI bots (G4)</h3>
            <pre className="bg-gray-800 text-green-400 p-4 rounded text-sm overflow-x-auto"><code>{`User-agent: GPTBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: *
Disallow:`}</code></pre>
            <p className="text-sm text-gray-600 mt-2 italic">(Change "Allow" to "Disallow" per policy.)</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-6">How to use the Optiview dashboard</h2>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <ol className="list-decimal list-inside space-y-3 text-blue-700">
            <li><strong>Open an audit → Top Blockers:</strong> Work through the highest-weight 0/1 items first (A1/A2/A3 and G1/G2/G4).</li>
            <li><strong>Open a page → Evidence:</strong> Expand a check to see what we detected (facts count, schema types, etc.). Fix and click <strong>Recompute</strong>.</li>
            <li><strong>Watch site score move:</strong> As you green A1–A3 (AEO) and G1–G2/G4 (GEO), overall scores jump.</li>
          </ol>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-6">Common pitfalls (and fixes)</h2>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
          <ul className="list-disc list-inside space-y-3 text-red-700">
            <li><strong>Fancy content hidden behind JS</strong> → server-render key blocks & JSON-LD (G4).</li>
            <li><strong>Endless "ultimate guide" pages</strong> with no anchors → split into smaller pages; add stable anchors (G5/G6).</li>
            <li><strong>FAQ spam</strong> → keep FAQs but don't rely on them; focus on answer-first + facts + provenance (A1/G1/G2).</li>
            <li><strong>No unique assets</strong> → publish a simple CSV or diagram with method notes (A4/G7).</li>
          </ul>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-6">Definition of "Done" per item (fast acceptance)</h2>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <ul className="list-disc list-inside space-y-2 text-green-700">
            <li><strong>A1/G1:</strong> Answer + Key Facts present above the fold; ≥3 bullets; jump links.</li>
            <li><strong>A3/G2:</strong> JSON-LD passes validator; <code>citation/isBasedOn/license</code> present.</li>
            <li><strong>A4/G7:</strong> At least one downloadable dataset or tool is linked.</li>
            <li><strong>G4:</strong> Robots stance explicit for GPTBot/Claude-Web/Perplexity; parity pass.</li>
            <li><strong>G9:</strong> Visible changelog + <code>dateModified</code> updated.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ScoreGuide;

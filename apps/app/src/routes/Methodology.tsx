import React from 'react';
import { Link } from 'react-router-dom';

export default function Methodology() {
  const lastUpdated = "January 17, 2025";

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="text-brand hover:text-brand text-sm mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold  mb-2">
            Data Sources & Methodology Disclosure
          </h1>
          <p className="muted">Last updated: {lastUpdated}</p>
        </div>

        {/* Content */}
        <div className="bg-surface-1 rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold  mb-3">1. Purpose</h2>
            <p className="muted leading-relaxed">
              This document explains how Optiview generates its audit scores, data points, and visibility insights. 
              Our goal is to ensure transparency about what data we use and how we interpret it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">2. Data Sources</h2>
            <p className="muted leading-relaxed mb-3">Optiview combines multiple input types:</p>
            <ul className="space-y-3 muted">
              <li>
                <strong>Crawled HTML & metadata</strong> - collected directly from publicly available web pages that you 
                authorize us to audit, including both static HTML and JavaScript-rendered content for visibility analysis.
              </li>
              <li>
                <strong>Search engine signals</strong> - derived from Google, Bing, and Brave index results (where permitted), 
                limited to top-level pages for ranking context.
              </li>
              <li>
                <strong>AI visibility signals</strong> - from monitored LLM sources such as ChatGPT (OpenAI), Claude (Anthropic), 
                Perplexity, and Brave Search citations, using context-aware query generation that adapts to each domain's 
                industry and positioning.
              </li>
              <li>
                <strong>Technical metrics</strong> - e.g., schema presence, render visibility ratio, canonical correctness, 
                freshness timestamps, and performance scores measured through our crawler and browser automation.
              </li>
              <li>
                <strong>Industry classification</strong> - hybrid system combining keyword analysis, JSON-LD type detection, 
                navigation taxonomy, and Workers AI embeddings to classify domains into 18+ industry verticals with confidence 
                scoring.
              </li>
              <li>
                <strong>Heuristic weights</strong> - proprietary weighting and scoring frameworks created by Optiview.ai based 
                on public documentation, experiments, and open-source benchmarks, refined through continuous cross-domain 
                pattern analysis.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">3. How Scoring Works</h2>
            <div className="space-y-4 muted">
              <div>
                <h3 className="font-semibold text-lg  mb-2">
                  AEO (Answer Engine Optimization)
                </h3>
                <p className="leading-relaxed">
                  Evaluates content structure, schema, and presentation based on known and inferred ranking patterns for 
                  answer-based results (e.g., snippets, AI Overviews, People Also Ask).
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg  mb-2">
                  GEO (Generative Engine Optimization)
                </h3>
                <p className="leading-relaxed">
                  Evaluates accessibility, provenance, and factual structure for use and citation by generative AI systems.
                </p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-surface-2 rounded border border-border">
              <p className="text-sm muted mb-2">
                Each check (A1–A11, G1–G10) is scored 0–3 using static and rendered page data. Weights (4–15) determine the 
                relative importance of each check. <strong>Scores are heuristic indicators only</strong> - not predictive 
                models or guarantees.
              </p>
              <p className="text-sm muted">
                <strong>Site-level penalties:</strong> AEO scores may receive up to a -5 point penalty if average render 
                visibility (static HTML vs. JavaScript-rendered content) falls below 30%. GEO scores may receive a -5 to -10 
                point penalty if render visibility is below 50%. This reflects the reality that AI crawlers and search engines 
                may not execute JavaScript reliably.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">4. Citation Intelligence Methodology</h2>
            <p className="muted leading-relaxed mb-3">
              Optiview's citation system uses a <strong>self-learning, context-aware approach</strong> to generate 
              human-realistic queries that mirror actual user search patterns:
            </p>
            <div className="space-y-4 muted">
              <div>
                <h3 className="font-semibold text-lg  mb-2">Adaptive Query Generation (V4)</h3>
                <p className="leading-relaxed">
                  Rather than static templates, our system analyzes each domain's homepage, meta descriptions, JSON-LD, 
                  and navigation structure to generate ~28 unique queries (10 branded + 18 non-branded) that:
                </p>
                <ul className="list-disc ml-6 space-y-1 mt-2">
                  <li>Read like authentic user questions (proper grammar, natural phrasing)</li>
                  <li>Span multiple intent types (discovery, informational, evaluative, commercial)</li>
                  <li>Adapt to your industry vertical (18+ templates including finance, health, software, retail)</li>
                  <li>Pass quality gates to ensure zero brand leaks in non-branded queries</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg  mb-2">Continuous Learning Architecture</h3>
                <p className="leading-relaxed">
                  After each audit, the system automatically updates a <strong>Prompt Intelligence Index</strong> that stores:
                </p>
                <ul className="list-disc ml-6 space-y-1 mt-2">
                  <li>Brand identity with normalized variants and aliases</li>
                  <li>Primary entities and semantic phrase extraction</li>
                  <li>Site classification (e-commerce, corporate, media, software)</li>
                  <li>Citation performance patterns for future optimization</li>
                </ul>
                <p className="leading-relaxed mt-2">
                  This creates a <strong>flywheel effect</strong> where each audit improves the system's ability to 
                  generate effective queries for all future domains.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg  mb-2">Three-Tier Caching</h3>
                <ul className="list-disc ml-6 space-y-1">
                  <li><strong>Hot cache (KV)</strong>: 5-10ms response, 7-day TTL, serves 90% of requests</li>
                  <li><strong>Canonical store (D1)</strong>: 50-100ms, durable history with version tracking</li>
                  <li><strong>Fresh build</strong>: 300-500ms, triggered on cache miss or audit completion</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">5. External Data Limitations</h2>
            <ul className="list-disc ml-6 space-y-2 muted">
              <li>Data from search and AI platforms may be incomplete, cached, or regionally restricted.</li>
              <li>AI citation monitoring depends on public availability and can change without notice.</li>
              <li>Rendered content checks depend on browser automation and may miss dynamic elements.</li>
              <li>Query generation uses Workers AI (Llama 3.1-8b-instruct) with fallback to industry templates 
                  if quality gates fail.</li>
              <li>Optiview does not use private, paid, or confidential APIs without user authorization.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">6. Interpretive Nature</h2>
            <p className="muted leading-relaxed">
              All insights, rankings, and "Quick Win" recommendations represent <strong>interpretations of observed 
              patterns</strong>, not official documentation or endorsements by any external entity. Use these results to guide 
              experimentation, not as definitive fact.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">7. Methodology Updates</h2>
            <p className="muted leading-relaxed">
              We refine our scoring logic periodically to reflect emerging best practices and changes in the digital ecosystem. 
              Updates may alter prior scores or interpretations. Changelogs are published on the{' '}
              <Link to="/score-guide" className="text-brand hover:underline">scoring guide</Link> page when material 
              changes occur.
            </p>
          </section>

          {/* Scoring Details Box */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-lg  mb-3">Scoring Framework Details</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm muted">
              <div>
                <h4 className="font-medium  mb-1">AEO Checks (A1-A11)</h4>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Answer-first design</li>
                  <li>Topical cluster integrity</li>
                  <li>Host/site authority</li>
                  <li>Originality & effort</li>
                  <li>Schema accuracy</li>
                  <li>Crawlability & canonicals</li>
                  <li>UX & performance</li>
                  <li>Sitemaps & discoverability</li>
                  <li>Freshness & stability</li>
                  <li>AI Overviews readiness</li>
                  <li>Render visibility (SPA risk)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium  mb-1">GEO Checks (G1-G10)</h4>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Citable facts block</li>
                  <li>Provenance schema</li>
                  <li>Evidence density</li>
                  <li>AI crawler access</li>
                  <li>Chunkability & structure</li>
                  <li>Canonical fact URLs</li>
                  <li>Dataset availability</li>
                  <li>Policy transparency</li>
                  <li>Update hygiene</li>
                  <li>Cluster-evidence linking</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-xs muted">
                For complete scoring details, see the{' '}
                <Link to="/score-guide" className="text-brand hover:underline font-medium">
                  AEO + GEO Scoring Guide
                </Link>
              </p>
            </div>
          </div>

          {/* Summary Box */}
          <div className="bg-success-soft border-l-4 border-success p-4 rounded">
            <p className="text-sm text-ink">
              <strong>Summary:</strong> Optiview's data and scores are based on proprietary heuristics, public sources, and 
              experimental testing. They are informative, not authoritative.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


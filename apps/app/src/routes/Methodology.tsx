import React from 'react';
import { Link } from 'react-router-dom';

export default function Methodology() {
  const lastUpdated = "January 17, 2025";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Data Sources & Methodology Disclosure
          </h1>
          <p className="text-gray-600">Last updated: {lastUpdated}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">1. Purpose</h2>
            <p className="text-gray-700 leading-relaxed">
              This document explains how Optiview generates its audit scores, data points, and visibility insights. 
              Our goal is to ensure transparency about what data we use and how we interpret it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">2. Data Sources</h2>
            <p className="text-gray-700 leading-relaxed mb-3">Optiview combines multiple input types:</p>
            <ul className="space-y-3 text-gray-700">
              <li>
                <strong>Crawled HTML & metadata</strong> — collected directly from publicly available web pages that you 
                authorize us to audit.
              </li>
              <li>
                <strong>Search engine signals</strong> — derived from Google, Bing, and Brave index results (where permitted), 
                limited to top-level pages for ranking context.
              </li>
              <li>
                <strong>AI visibility signals</strong> — from monitored LLM sources such as ChatGPT, Claude, and Perplexity 
                citations, where access is permitted.
              </li>
              <li>
                <strong>Technical metrics</strong> — e.g., schema presence, render visibility, canonical correctness, freshness, 
                and performance scores measured through our crawler.
              </li>
              <li>
                <strong>Heuristic weights</strong> — proprietary weighting and scoring frameworks created by Optiview.ai based 
                on public documentation, experiments, and open-source benchmarks.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">3. How Scoring Works</h2>
            <div className="space-y-4 text-gray-700">
              <div>
                <h3 className="font-semibold text-lg text-gray-900 mb-2">
                  AEO (Answer Engine Optimization)
                </h3>
                <p className="leading-relaxed">
                  Evaluates content structure, schema, and presentation based on known and inferred ranking patterns for 
                  answer-based results (e.g., snippets, AI Overviews, People Also Ask).
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900 mb-2">
                  GEO (Generative Engine Optimization)
                </h3>
                <p className="leading-relaxed">
                  Evaluates accessibility, provenance, and factual structure for use and citation by generative AI systems.
                </p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
              <p className="text-sm text-gray-700">
                Each check (A1–A11, G1–G10) is scored 0–3 using static and rendered page data. Weights (4–15) determine the 
                relative importance of each check. <strong>Scores are heuristic indicators only</strong> — not predictive 
                models or guarantees.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">4. External Data Limitations</h2>
            <ul className="list-disc ml-6 space-y-2 text-gray-700">
              <li>Data from search and AI platforms may be incomplete, cached, or regionally restricted.</li>
              <li>AI citation monitoring depends on public availability and can change without notice.</li>
              <li>Rendered content checks depend on browser automation and may miss dynamic elements.</li>
              <li>Optiview does not use private, paid, or confidential APIs without user authorization.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">5. Interpretive Nature</h2>
            <p className="text-gray-700 leading-relaxed">
              All insights, rankings, and "Quick Win" recommendations represent <strong>interpretations of observed 
              patterns</strong>, not official documentation or endorsements by any external entity. Use these results to guide 
              experimentation, not as definitive fact.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">6. Methodology Updates</h2>
            <p className="text-gray-700 leading-relaxed">
              We refine our scoring logic periodically to reflect emerging best practices and changes in the digital ecosystem. 
              Updates may alter prior scores or interpretations. Changelogs are published on the{' '}
              <Link to="/score-guide" className="text-blue-600 hover:underline">scoring guide</Link> page when material 
              changes occur.
            </p>
          </section>

          {/* Scoring Details Box */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-lg text-gray-900 mb-3">Scoring Framework Details</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                <h4 className="font-medium text-gray-900 mb-1">AEO Checks (A1-A11)</h4>
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
                <h4 className="font-medium text-gray-900 mb-1">GEO Checks (G1-G10)</h4>
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
              <p className="text-xs text-gray-600">
                For complete scoring details, see the{' '}
                <Link to="/score-guide" className="text-blue-600 hover:underline font-medium">
                  AEO + GEO Scoring Guide
                </Link>
              </p>
            </div>
          </div>

          {/* Summary Box */}
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
            <p className="text-sm text-gray-800">
              <strong>Summary:</strong> Optiview's data and scores are based on proprietary heuristics, public sources, and 
              experimental testing. They are informative, not authoritative.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


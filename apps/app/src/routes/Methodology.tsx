import React from 'react';
import { Link } from 'react-router-dom';

export default function Methodology() {
  const lastUpdated = "October 23, 2025";

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="text-brand hover:underline text-sm mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold mb-2">
            Data Sources & Methodology
          </h1>
          <p className="text-ink-muted">Last updated: {lastUpdated}</p>
        </div>

        {/* Content */}
        <div className="card card-body space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Purpose</h2>
            <p className="text-ink-muted leading-relaxed">
              This document explains how Optiview generates its audit scores, diagnostic checks, and AI visibility insights. 
              Our goal is to ensure transparency about what data we use, how we measure performance, and how we interpret results.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Data Sources</h2>
            <p className="text-ink-muted leading-relaxed mb-3">Optiview combines multiple input types:</p>
            <ul className="space-y-3 text-ink-muted">
              <li>
                <strong className="text-ink">Crawled HTML & Metadata</strong> - Collected directly from publicly available web pages that you 
                authorize us to audit, including both static HTML and JavaScript-rendered content for visibility analysis.
              </li>
              <li>
                <strong className="text-ink">AI Visibility Signals</strong> - Real-time citation testing across ChatGPT (OpenAI), Claude (Anthropic), 
                Perplexity, and Brave Search using context-aware query generation that adapts to each domain's industry and positioning.
              </li>
              <li>
                <strong className="text-ink">Technical Diagnostics</strong> - 36 automated checks measuring schema presence, HTML structure, 
                metadata quality, canonical correctness, entity graphs, and performance indicators through our crawler and browser automation.
              </li>
              <li>
                <strong className="text-ink">Industry Classification</strong> - Hybrid system combining keyword analysis, JSON-LD type detection, 
                navigation taxonomy, and Workers AI embeddings to classify domains into 18+ industry verticals with confidence scoring.
              </li>
              <li>
                <strong className="text-ink">Scoring Criteria Database</strong> - Centralized D1 table storing all 36 check definitions, weights, 
                thresholds, impact levels, and educational content, ensuring consistency across audits and tools.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Diagnostic Scoring System (36 Checks)</h2>
            <div className="space-y-4 text-ink-muted">
              <p className="leading-relaxed">
                Optiview uses a <strong className="text-ink">36-check diagnostic framework</strong> organized into 6 categories, with each check 
                scored on a <strong className="text-ink">0-100 scale</strong>. Checks are weighted by impact (High, Medium, Low) to calculate 
                category and composite scores.
              </p>
              
              <div className="card-muted rounded-xl p-4">
                <h3 className="font-semibold text-lg text-ink mb-3">Check Categories</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium text-ink mb-2">📐 Technical Foundations (8 checks)</h4>
                    <p className="text-xs text-ink-muted">Schema, metadata, and semantic markup that explain meaning to machines</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-ink mb-2">🗂️ Structure & Organization (6 checks)</h4>
                    <p className="text-xs text-ink-muted">Pages and links arranged so people and parsers understand your site</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-ink mb-2">✍️ Content & Clarity (7 checks)</h4>
                    <p className="text-xs text-ink-muted">Clear, complete answers that AI assistants can quote</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-ink mb-2">🛡️ Authority & Trust (5 checks)</h4>
                    <p className="text-xs text-ink-muted">Visible expertise and evidence to earn citations</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-ink mb-2">🔍 Crawl & Discoverability (6 checks)</h4>
                    <p className="text-xs text-ink-muted">Ensure crawlers and AIs can reach and render your content</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-ink mb-2">⚡ Experience & Performance (4 checks)</h4>
                    <p className="text-xs text-ink-muted">Fast, readable, accessible everywhere</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg text-ink mb-2">Scoring Methodology</h3>
                <ul className="list-disc ml-6 space-y-2">
                  <li><strong className="text-ink">Page-Level Checks (23):</strong> Run on every crawled page, measuring individual page quality</li>
                  <li><strong className="text-ink">Site-Level Checks (13):</strong> Run once per audit, measuring overall site health</li>
                  <li><strong className="text-ink">Composite Score:</strong> Weighted average of all checks, factoring in impact levels</li>
                  <li><strong className="text-ink">Category Scores:</strong> Aggregated from checks within each category</li>
                </ul>
              </div>

              <div className="card-muted rounded-xl p-4 border border-border">
                <p className="text-sm mb-2">
                  <strong className="text-ink">Check Types:</strong>
                </p>
                <ul className="list-disc ml-6 space-y-1 text-sm">
                  <li><code className="bg-surface-3 px-2 py-0.5 rounded text-xs">html_dom</code> - Parse and analyze HTML structure</li>
                  <li><code className="bg-surface-3 px-2 py-0.5 rounded text-xs">http</code> - Inspect HTTP headers and status codes</li>
                  <li><code className="bg-surface-3 px-2 py-0.5 rounded text-xs">aggregate</code> - Cross-page pattern analysis</li>
                  <li><code className="bg-surface-3 px-2 py-0.5 rounded text-xs">llm</code> - AI-powered quality assessment (future)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Citation Intelligence</h2>
            <p className="text-ink-muted leading-relaxed mb-3">
              Optiview's citation system uses a <strong className="text-ink">self-learning, context-aware approach</strong> to generate 
              human-realistic queries that mirror actual user search patterns:
            </p>
            <div className="space-y-4 text-ink-muted">
              <div>
                <h3 className="font-semibold text-lg text-ink mb-2">Adaptive Query Generation</h3>
                <p className="leading-relaxed">
                  Rather than static templates, our system analyzes each domain's homepage, meta descriptions, JSON-LD, 
                  and navigation structure to generate ~28-30 unique queries (10-12 branded + 18 non-branded) that:
                </p>
                <ul className="list-disc ml-6 space-y-1 mt-2">
                  <li>Read like authentic user questions (proper grammar, natural phrasing)</li>
                  <li>Span multiple intent types (discovery, informational, evaluative, commercial)</li>
                  <li>Adapt to your industry vertical (18+ templates including finance, health, software, retail)</li>
                  <li>Pass quality gates to ensure natural language and prevent brand leaks</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-ink mb-2">Real-Time Testing</h3>
                <p className="leading-relaxed">
                  Each query is tested against 4 major AI sources:
                </p>
                <ul className="list-disc ml-6 space-y-1 mt-2">
                  <li><strong className="text-ink">ChatGPT</strong> - OpenAI's conversational search</li>
                  <li><strong className="text-ink">Claude</strong> - Anthropic's AI assistant</li>
                  <li><strong className="text-ink">Perplexity</strong> - AI-powered answer engine</li>
                  <li><strong className="text-ink">Brave Search</strong> - Privacy-focused search with AI answers</li>
                </ul>
                <p className="leading-relaxed mt-2">
                  Results show which pages are cited, citation frequency, and where you're missing opportunities.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-ink mb-2">Three-Tier Architecture</h3>
                <ul className="list-disc ml-6 space-y-1">
                  <li><strong className="text-ink">Hot cache (KV):</strong> 5-10ms response, 7-day TTL, serves 90% of requests</li>
                  <li><strong className="text-ink">Canonical store (D1):</strong> 50-100ms, durable history with version tracking</li>
                  <li><strong className="text-ink">Fresh build:</strong> 300-500ms, triggered on cache miss or audit completion</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Data Limitations & Constraints</h2>
            <ul className="list-disc ml-6 space-y-2 text-ink-muted">
              <li>AI citation monitoring depends on public API availability and can change without notice</li>
              <li>Rendered content checks depend on browser automation and may miss complex dynamic elements</li>
              <li>Query generation uses Workers AI (Llama 3.1-8b-instruct) with fallback to industry templates</li>
              <li>Scores are point-in-time snapshots and may vary based on cache freshness</li>
              <li>Site-level checks run once per audit; page-level checks scale with crawl depth</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Interpretive Nature</h2>
            <p className="text-ink-muted leading-relaxed">
              All insights, rankings, and recommendations represent <strong className="text-ink">interpretations of observed 
              patterns</strong>, not official documentation or guarantees. Our checks measure technical correctness and best practices, 
              but cannot predict actual AI citation performance or search rankings. Use these results to guide optimization, 
              not as definitive fact.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">7. Continuous Improvement</h2>
            <p className="text-ink-muted leading-relaxed">
              We refine our scoring logic periodically to reflect emerging best practices and changes in the AI/search ecosystem. 
              Updates may alter prior scores or interpretations. Material changes are documented in our{' '}
              <Link to="/score-guide" className="text-brand hover:underline">scoring guide</Link>, where you can explore 
              detailed criteria, examples, and implementation guides for all 36 checks.
            </p>
          </section>

          {/* Summary Box */}
          <div className="bg-brand-soft border-l-4 border-brand p-4 rounded-xl">
            <p className="text-sm text-ink">
              <strong>Summary:</strong> Optiview provides diagnostic scoring and AI visibility testing based on 36 automated checks, 
              real-time citation testing, and industry-specific query generation. All data comes from public sources and is interpretive, 
              not authoritative. View the{' '}
              <Link to="/score-guide" className="text-brand hover:underline font-medium">complete scoring guide</Link>
              {' '}for detailed criteria and implementation examples.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

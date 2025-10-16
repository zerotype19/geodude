import React from 'react';
import { Link } from 'react-router-dom';

const HelpScoring: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="prose prose-lg max-w-none">
        <div className="mb-8">
          <Link to="/score-guide" className="inline-flex items-center text-blue-600 hover:text-blue-800">
            ← Back to Score Guide
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Scoring Help & Interpretation</h1>
        
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
          <h2 className="text-xl font-semibold text-blue-800 mb-2">Understanding Your Scores</h2>
          <p className="text-blue-700">
            Optiview evaluates your content using two complementary frameworks: AEO (Answer Engine Optimization) 
            for traditional search engines and GEO (Generative Engine Optimization) for AI systems.
          </p>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-6">Score Interpretation</h2>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-6 h-6 bg-red-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-red-800">Red (0-1)</h3>
            </div>
            <p className="text-red-700 text-sm">
              <strong>Fix now.</strong> These are critical issues preventing your content from ranking well or being cited by AI systems.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-6 h-6 bg-yellow-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-yellow-800">Amber (2)</h3>
            </div>
            <p className="text-yellow-700 text-sm">
              <strong>Acceptable; improve when possible.</strong> You're meeting basic requirements but have room for optimization.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-6 h-6 bg-green-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-green-800">Green (3)</h3>
            </div>
            <p className="text-green-700 text-sm">
              <strong>Exemplar; keep stable.</strong> You're exceeding expectations and setting the standard for this metric.
            </p>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-6">Priority Framework</h2>

        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Focus Order for Maximum Impact:</h3>
          <ol className="list-decimal list-inside space-y-3 text-gray-700">
            <li><strong>Top Blockers (Red items):</strong> Start with the highest-weight items (A1, A2, A3, G1, G2, G4)</li>
            <li><strong>Quick Wins (Easy fixes):</strong> Look for simple improvements that don't require major content changes</li>
            <li><strong>Amber Optimization:</strong> Once red items are fixed, focus on moving amber scores to green</li>
            <li><strong>Maintenance:</strong> Keep green scores stable and monitor for regressions</li>
          </ol>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-6">Evidence Fields Explained</h2>

        <div className="space-y-4 mb-8">
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-blue-800">factsCount</h3>
            <p className="text-gray-600 text-sm">Number of atomic facts detected in key facts sections</p>
          </div>
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-blue-800">anchors</h3>
            <p className="text-gray-600 text-sm">Number of stable anchor links found in the content</p>
          </div>
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-blue-800">schemaTypes</h3>
            <p className="text-gray-600 text-sm">JSON-LD schema types detected (Article, HowTo, FAQPage, etc.)</p>
          </div>
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-blue-800">jumpLinks</h3>
            <p className="text-gray-600 text-sm">Number of internal navigation links found</p>
          </div>
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-blue-800">tablesCount</h3>
            <p className="text-gray-600 text-sm">Number of data tables detected (not layout tables)</p>
          </div>
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-blue-800">parityPass</h3>
            <p className="text-gray-600 text-sm">Whether server-rendered HTML matches browser-rendered content</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-6">Common Questions</h2>

        <div className="space-y-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Why is my site score different from my page scores?</h3>
            <p className="text-gray-600">
              Site scores are calculated as the average of all page scores. If you have pages with very different scores, 
              the site average will reflect that variation. Focus on bringing up your lowest-scoring pages first.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Should I prioritize AEO or GEO?</h3>
            <p className="text-gray-600">
              Both are important, but AEO typically has more immediate impact on traditional search rankings. 
              Start with A1-A3 (answer-first, cluster integrity, authority), then move to G1-G2 (key facts, provenance).
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">How often should I recompute scores?</h3>
            <p className="text-gray-600">
              After making content changes, use the "Recompute" button to see updated scores. 
              The system only rescores existing HTML without refetching, so it's fast and doesn't count against crawl limits.
            </p>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold text-green-800 mb-2">Need More Help?</h3>
          <p className="text-green-700">
            For detailed implementation guidance, check out the <Link to="/score-guide" className="underline">complete Score Guide</Link> 
            with code examples and step-by-step instructions for each metric.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HelpScoring;

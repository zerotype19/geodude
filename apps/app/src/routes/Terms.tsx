import React from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
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
            Terms of Use & No Liability Disclaimer
          </h1>
          <p className="muted">Last updated: {lastUpdated}</p>
        </div>

        {/* Content */}
        <div className="bg-surface-1 rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold  mb-3">1. Acceptance of Terms</h2>
            <p className="muted leading-relaxed">
              By accessing or using the Optiview platform ("Service," "App," "Site"), you agree to these Terms of Use ("Terms"). 
              If you do not agree, you must discontinue use immediately.
            </p>
            <p className="muted leading-relaxed mt-3">
              Optiview is provided by <strong>Optiview.ai LLC</strong> ("Company," "we," "our," or "us") as a data and analytics 
              tool for informational and educational purposes only.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">2. Purpose of the Service</h2>
            <p className="muted leading-relaxed">
              Optiview provides visibility insights, audits, heuristic scores, and content optimization suggestions related to{' '}
              <strong>Answer Engine Optimization (AEO)</strong> and <strong>Generative Engine Optimization (GEO)</strong>.
            </p>
            <p className="muted leading-relaxed mt-3">
              These outputs are generated using automated analysis, machine heuristics, and evolving public information. 
              They are intended solely to <strong>inform and guide your independent decision-making</strong> - not to prescribe 
              specific actions or guarantee any particular outcome.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">3. Informational Nature of Results</h2>
            <p className="muted leading-relaxed mb-3">
              All <strong>scores, rankings, grades, and recommendations</strong> within Optiview represent{' '}
              <strong>heuristic indicators only</strong>. They are <strong>not definitive or authoritative measures</strong> of 
              search engine performance, visibility, or compliance.
            </p>
            <ul className="list-disc ml-6 space-y-2 muted">
              <li>
                The AEO and GEO scoring systems are proprietary frameworks created by Optiview.ai and{' '}
                <strong>are not endorsed, affiliated with, or recognized by Google, Bing, OpenAI, Anthropic, Perplexity, 
                or any other search or AI provider</strong>.
              </li>
              <li>
                Any "weights," "penalties," or "priorities" are subjective heuristics designed for internal consistency - 
                not external validation.
              </li>
              <li>
                Recommendations are <strong>suggested actions</strong> derived from publicly observable trends, leaks, and 
                best-practice research, but may not reflect current or future ranking algorithms.
              </li>
              <li>
                Scores and analysis may change at any time as the platform evolves or as external systems 
                (e.g., search engines, LLMs) change behavior.
              </li>
            </ul>
            <p className="muted leading-relaxed mt-3">
              You acknowledge and agree that <strong>Optiview is not a substitute for professional SEO, legal, or compliance 
              advice</strong>, and that you alone are responsible for any actions taken (or not taken) based on information 
              provided through the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">4. No Warranties or Guarantees</h2>
            <p className="muted leading-relaxed mb-3">
              The Service, including all scores, reports, and recommendations, is provided <strong>"as is" and 
              "as available"</strong> without warranties of any kind, whether express or implied.
            </p>
            <p className="muted leading-relaxed mb-3">We do <strong>not warrant or guarantee</strong> that:</p>
            <ul className="list-disc ml-6 space-y-2 muted">
              <li>The Service will be error-free or uninterrupted.</li>
              <li>Scores, insights, or recommendations will result in improved search rankings, visibility, traffic, or AI citations.</li>
              <li>Data or analysis will remain accurate, complete, or current.</li>
              <li>Third-party platforms (Google, Bing, ChatGPT, Claude, Perplexity, etc.) will behave in any consistent or predictable way.</li>
            </ul>
            <p className="muted leading-relaxed mt-3">
              To the fullest extent permitted by law, Optiview disclaims all warranties, including implied warranties of 
              merchantability, fitness for a particular purpose, non-infringement, and course of performance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">5. Limitation of Liability</h2>
            <p className="muted leading-relaxed mb-3">
              In no event shall Optiview.ai LLC, its affiliates, partners, employees, or licensors be liable for any direct, 
              indirect, incidental, special, consequential, exemplary, or punitive damages, including (without limitation) loss of 
              profits, data, goodwill, or business interruption arising out of or related to:
            </p>
            <ul className="list-disc ml-6 space-y-2 muted">
              <li>Use or inability to use the Service,</li>
              <li>Reliance on any scores, recommendations, or analytics results,</li>
              <li>Errors, omissions, or inaccuracies in analysis or reporting,</li>
              <li>Changes in external algorithms, search visibility, or AI system behavior,</li>
              <li>Or any other interaction with the Service.</li>
            </ul>
            <p className="muted leading-relaxed mt-3">
              Your sole and exclusive remedy for dissatisfaction with the Service is to stop using it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">6. No Endorsement or Affiliation</h2>
            <p className="muted leading-relaxed">
              References to third-party companies, platforms, or technologies (including Google, Bing, OpenAI, Anthropic, 
              Perplexity, or others) are for descriptive purposes only. Optiview has <strong>no official relationship, 
              sponsorship, or endorsement</strong> from any of these entities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">7. Data Accuracy and Availability</h2>
            <p className="muted leading-relaxed">
              The Service depends on crawlers, APIs, and third-party data sources that may be incomplete, unavailable, or 
              inaccurate. We may update or change methodologies, scoring weights, or heuristic models at any time without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">8. User Responsibilities</h2>
            <p className="muted leading-relaxed">
              You agree to use the Service only for lawful purposes and in compliance with these Terms. You must not misuse 
              the Service, attempt to reverse engineer its components, or misrepresent Optiview's scoring outputs as official 
              guidance from any search or AI provider.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">9. Indemnification</h2>
            <p className="muted leading-relaxed mb-3">
              You agree to indemnify and hold harmless Optiview.ai LLC, its affiliates, and employees from any claims, losses, 
              damages, liabilities, or expenses (including legal fees) arising from:
            </p>
            <ul className="list-disc ml-6 space-y-2 muted">
              <li>Your use or misuse of the Service,</li>
              <li>Your reliance on its data or outputs,</li>
              <li>Or your violation of these Terms or applicable law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">10. Changes to These Terms</h2>
            <p className="muted leading-relaxed">
              We may update these Terms at any time by posting a revised version on this page. Continued use of the Service 
              after such updates constitutes your acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">11. Governing Law</h2>
            <p className="muted leading-relaxed">
              These Terms are governed by and construed in accordance with the laws of the State of New Jersey, United States, 
              without regard to conflict-of-law principles.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">12. Contact Us</h2>
            <p className="muted leading-relaxed">
              If you have questions about these Terms or wish to report a concern, contact us at:
            </p>
            <p className="text-brand mt-2">
               <a href="mailto:legal@optiview.ai" className="hover:underline">legal@optiview.ai</a>
            </p>
          </section>

          {/* Summary Box */}
          <div className="bg-warn-soft border-l-4 border-amber-500 p-4 rounded">
            <p className="text-sm text-gray-800">
              <strong>Summary:</strong> Optiview scores and recommendations are heuristic indicators only. They are not official, 
              endorsed, or guaranteed measures of SEO or AI visibility performance. Use at your own discretion. No warranties or 
              liability are implied.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


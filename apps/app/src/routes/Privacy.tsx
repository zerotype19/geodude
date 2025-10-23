import React from 'react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  const lastUpdated = "January 17, 2025";

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="text-brand hover:text-brand text-sm mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold  mb-2">Privacy Policy</h1>
          <p className="muted">Last updated: {lastUpdated}</p>
        </div>

        {/* Content */}
        <div className="bg-surface-1 rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold  mb-3">1. Overview</h2>
            <p className="muted leading-relaxed">
              Optiview.ai ("Optiview," "we," "our," or "us") respects your privacy. This Privacy Policy explains how we 
              collect, use, and protect personal information when you use our website and services (the "Service").
            </p>
            <p className="muted leading-relaxed mt-3">
              Optiview is designed primarily as a business analytics tool. We do not sell, rent, or trade your data - ever.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">2. Information We Collect</h2>
            <p className="muted leading-relaxed mb-3">
              We collect limited information necessary to operate the Service, including:
            </p>
            <ul className="space-y-3 muted">
              <li>
                <strong>Account data:</strong> email address, organization name, and project identifiers.
              </li>
              <li>
                <strong>Usage data:</strong> logs of when users access audits, dashboards, or events.
              </li>
              <li>
                <strong>Telemetry data:</strong> aggregated performance, crawl, and scoring information used to improve 
                system accuracy.
              </li>
              <li>
                <strong>Cookies and analytics:</strong> small data files to remember preferences, manage sessions, and 
                measure usage.
              </li>
            </ul>
            <p className="muted leading-relaxed mt-3">
              We do not collect or store personal browsing data beyond what's required for security and analytics. 
              Crawled website content is processed only for the domains you authorize.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">3. How We Use Your Information</h2>
            <p className="muted leading-relaxed mb-3">We use collected information to:</p>
            <ul className="list-disc ml-6 space-y-2 muted">
              <li>Operate, maintain, and improve the Service,</li>
              <li>Generate audits, scores, and reports,</li>
              <li>Provide customer support,</li>
              <li>Communicate important updates or new features,</li>
              <li>Ensure system integrity and prevent abuse.</li>
            </ul>
            <p className="muted leading-relaxed mt-3">
              We may use aggregated, anonymized data for statistical insights - but never in a way that identifies you or 
              your company.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">4. Data Retention</h2>
            <p className="muted leading-relaxed">
              We retain project and audit data for as long as your account remains active. You may request deletion of data 
              or account records at any time by contacting{' '}
              <a href="mailto:privacy@optiview.ai" className="text-brand hover:underline">privacy@optiview.ai</a>.
            </p>
            <p className="muted leading-relaxed mt-3">Backups are purged on a scheduled basis.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">5. Sharing and Disclosure</h2>
            <p className="muted leading-relaxed mb-3">We only share data:</p>
            <ul className="list-disc ml-6 space-y-2 muted">
              <li>
                With trusted service providers that help us operate the platform (e.g., Cloudflare, database hosting, or analytics).
              </li>
              <li>When required by law or to protect our rights and users' safety.</li>
            </ul>
            <p className="muted leading-relaxed mt-3">
              We do not sell or share data with advertisers or unrelated third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">6. Security</h2>
            <p className="muted leading-relaxed">
              We use modern encryption, access control, and audit logging to protect stored data. No system is 100% secure; 
              use the Service at your own discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">7. Children's Privacy</h2>
            <p className="muted leading-relaxed">
              Optiview is intended for professional use by adults 18 years and older. We do not knowingly collect personal 
              information from children.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">8. Updates</h2>
            <p className="muted leading-relaxed">
              We may update this Privacy Policy periodically. Continued use of the Service after updates constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold  mb-3">9. Contact</h2>
            <p className="muted leading-relaxed">
              For privacy inquiries or deletion requests, contact:
            </p>
            <p className="text-brand mt-2">
              📧 <a href="mailto:privacy@optiview.ai" className="hover:underline">privacy@optiview.ai</a>
            </p>
          </section>

          {/* Summary Box */}
          <div className="bg-brand-soft border-l-4 border-brand p-4 rounded">
            <p className="text-sm text-gray-800">
              <strong>Summary:</strong> Optiview.ai respects your privacy and only collects limited business-use data needed 
              to operate the platform. We do not sell or share user data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


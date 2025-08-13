import React from 'react';
import { Card } from '../components/ui/Card';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mt-2 text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <Card className="p-8">
          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 mb-4">
                At Optiview Analytics, we respect your privacy and are committed to protecting your 
                personal information. This Privacy Policy explains how we collect, use, and safeguard 
                your data when you use our analytics platform.
              </p>
              <p className="text-gray-700">
                By using Optiview, you consent to the data practices described in this policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
              <p className="text-gray-700 mb-4">
                We collect the following types of information:
              </p>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">2.1 Account Information</h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                <li>Email address for authentication</li>
                <li>Account preferences and settings</li>
                <li>Usage patterns and service interactions</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">2.2 Website Analytics Data</h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                <li>Page views and navigation patterns</li>
                <li>Traffic sources and referrers</li>
                <li>Device and browser information</li>
                <li>Geographic location (country/region level)</li>
                <li>Content interaction metrics</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">2.3 Technical Information</h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>IP addresses (hashed for privacy)</li>
                <li>User agent strings (hashed for privacy)</li>
                <li>Session identifiers</li>
                <li>Error logs and performance metrics</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-700 mb-4">
                We use the collected information for the following purposes:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Provide and maintain our analytics services</li>
                <li>Process authentication and manage accounts</li>
                <li>Generate reports and insights for your websites</li>
                <li>Improve our platform and develop new features</li>
                <li>Monitor service performance and troubleshoot issues</li>
                <li>Comply with legal obligations</li>
                <li>Send service-related communications</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Data Processing and Storage</h2>
              <p className="text-gray-700 mb-4">
                Your data is processed and stored securely using industry-standard practices:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Data is encrypted in transit and at rest</li>
                <li>We use secure cloud infrastructure with enterprise-grade security</li>
                <li>Access to data is strictly controlled and logged</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Data is stored in compliance with applicable regulations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Sharing and Disclosure</h2>
              <p className="text-gray-700 mb-4">
                We do not sell, trade, or rent your personal information to third parties. We may share 
                data only in the following circumstances:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>With your explicit consent</li>
                <li>To comply with legal requirements or court orders</li>
                <li>To protect our rights, property, or safety</li>
                <li>With trusted service providers who assist in operating our platform</li>
                <li>In connection with a business transfer or merger</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Retention</h2>
              <p className="text-gray-700 mb-4">
                We retain your data for as long as necessary to provide our services:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Account information: Until account deletion</li>
                <li>Analytics data: Configurable retention periods (default: 2 years)</li>
                <li>Logs and technical data: Up to 90 days</li>
                <li>Backup data: Up to 30 days after deletion</li>
              </ul>
              <p className="text-gray-700">
                You can request data deletion at any time through your account settings.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Rights and Choices</h2>
              <p className="text-gray-700 mb-4">
                You have the following rights regarding your personal information:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Access and review your data</li>
                <li>Correct inaccurate information</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
                <li>Opt out of certain data collection</li>
                <li>Withdraw consent for data processing</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Cookies and Tracking</h2>
              <p className="text-gray-700 mb-4">
                We use cookies and similar technologies to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Maintain your authentication session</li>
                <li>Remember your preferences and settings</li>
                <li>Analyze website usage and performance</li>
                <li>Provide personalized experiences</li>
              </ul>
              <p className="text-gray-700">
                You can control cookie settings through your browser preferences.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. International Data Transfers</h2>
              <p className="text-gray-700 mb-4">
                Your data may be transferred to and processed in countries other than your own. We ensure 
                appropriate safeguards are in place to protect your data during such transfers.
              </p>
              <p className="text-gray-700">
                For users in the European Economic Area, we comply with GDPR requirements for 
                international data transfers.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Children's Privacy</h2>
              <p className="text-gray-700">
                Our services are not intended for children under 13 years of age. We do not knowingly 
                collect personal information from children under 13. If you believe we have collected 
                such information, please contact us immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Changes to This Policy</h2>
              <p className="text-gray-700 mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any material 
                changes by:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Posting the updated policy on our website</li>
                <li>Sending email notifications to registered users</li>
                <li>Displaying in-app notifications</li>
              </ul>
              <p className="text-gray-700">
                Your continued use of Optiview after changes become effective constitutes acceptance of 
                the updated policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Contact Us</h2>
              <p className="text-gray-700 mb-4">
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-gray-700">
                  <strong>Email:</strong> privacy@optiview.ai<br />
                  <strong>Data Protection Officer:</strong> dpo@optiview.ai<br />
                  <strong>Address:</strong> [Your Company Address]<br />
                  <strong>Phone:</strong> [Your Phone Number]
                </p>
              </div>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}

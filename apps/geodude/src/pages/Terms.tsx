import React from 'react';
import { Card } from '../components/ui/Card';

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="mt-2 text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <Card className="p-8">
          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 mb-4">
                Welcome to Optiview Analytics. These Terms of Service ("Terms") govern your use of our 
                analytics platform and services. By accessing or using Optiview, you agree to be bound 
                by these Terms.
              </p>
              <p className="text-gray-700">
                Optiview provides web analytics and traffic classification services to help businesses 
                understand their website traffic and user behavior.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Service Description</h2>
              <p className="text-gray-700 mb-4">
                Optiview offers the following services:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Website traffic analytics and reporting</li>
                <li>AI traffic classification and detection</li>
                <li>Referral tracking and analysis</li>
                <li>Content performance insights</li>
                <li>API access for custom integrations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Acceptable Use</h2>
              <p className="text-gray-700 mb-4">
                You agree to use Optiview only for lawful purposes and in accordance with these Terms. 
                You agree not to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Use the service to collect personal information without consent</li>
                <li>Attempt to reverse engineer or compromise the platform</li>
                <li>Use the service for spam or malicious activities</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Interfere with the service or other users</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Privacy and Data</h2>
              <p className="text-gray-700 mb-4">
                Your privacy is important to us. Our collection and use of data is governed by our 
                Privacy Policy, which is incorporated into these Terms by reference.
              </p>
              <p className="text-gray-700">
                By using Optiview, you acknowledge that you have read and understood our Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Service Availability</h2>
              <p className="text-gray-700 mb-4">
                We strive to provide reliable service but cannot guarantee uninterrupted availability. 
                We may perform maintenance, updates, or modifications that temporarily affect service.
              </p>
              <p className="text-gray-700">
                We are not liable for any damages resulting from service interruptions or technical issues.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Limitation of Liability</h2>
              <p className="text-gray-700 mb-4">
                To the maximum extent permitted by law, Optiview shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages arising from your use of the service.
              </p>
              <p className="text-gray-700">
                Our total liability shall not exceed the amount you paid for the service in the 12 months 
                preceding the claim.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Termination</h2>
              <p className="text-gray-700 mb-4">
                You may terminate your account at any time by contacting us. We may terminate or suspend 
                your access for violations of these Terms or for any other reason.
              </p>
              <p className="text-gray-700">
                Upon termination, your right to use the service ceases immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Changes to Terms</h2>
              <p className="text-gray-700 mb-4">
                We may modify these Terms at any time. We will notify you of material changes via email 
                or through the service.
              </p>
              <p className="text-gray-700">
                Your continued use of Optiview after changes become effective constitutes acceptance of 
                the new Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Governing Law</h2>
              <p className="text-gray-700">
                These Terms are governed by and construed in accordance with the laws of the jurisdiction 
                where Optiview is incorporated, without regard to conflict of law principles.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Contact Information</h2>
              <p className="text-gray-700 mb-4">
                If you have questions about these Terms, please contact us:
              </p>
              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-gray-700">
                  <strong>Email:</strong> legal@optiview.ai<br />
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

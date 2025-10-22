import { describe, it, expect } from 'vitest';
import { runChecksOnHtml } from '../src/scoring/runner';

const HTML_BASIC = `
<html lang="en"><head>
<title>Acme Widgets — Official Site</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Buy Acme widgets. Simple, fast, reliable solutions for your business needs.">
<link rel="canonical" href="https://acme.com/">
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"Organization",
  "name":"Acme",
  "logo":"https://acme.com/logo.png",
  "sameAs":["https://twitter.com/acme","https://linkedin.com/company/acme"]
}
</script>
</head>
<body>
  <main>
    <h1>Acme Widgets</h1>
    <p>We help you do more with less. Get started today with our simple, fast platform.</p>
    <a href="/pricing">Pricing</a>
    <a href="/features">Features</a>
    <a href="/about">About Us</a>
  </main>
</body>
</html>
`;

const HTML_FAQ = `
<html lang="en-US"><head>
<title>FAQ - Acme Help Center</title>
<meta name="description" content="Frequently asked questions about Acme products and services.">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="canonical" href="https://acme.com/faq">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is Acme?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Acme is a leading widget manufacturer."
      }
    },
    {
      "@type": "Question",
      "name": "How do I get started?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sign up for a free trial on our homepage."
      }
    },
    {
      "@type": "Question",
      "name": "What are your pricing options?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We offer three tiers: Starter, Professional, and Enterprise."
      }
    }
  ]
}
</script>
</head>
<body>
  <h1>Frequently Asked Questions</h1>
  <details>
    <summary>What is Acme?</summary>
    <p>Acme is a leading widget manufacturer.</p>
  </details>
  <details>
    <summary>How do I get started?</summary>
    <p>Sign up for a free trial on our homepage.</p>
  </details>
</body>
</html>
`;

const HTML_POOR = `
<html><head>
<title>Home</title>
</head>
<body>
  <h1>Welcome</h1>
  <h3>About</h3>
  <p>Content here</p>
</body>
</html>
`;

describe('Scoring V1 - Smoke Tests', () => {
  it('runs all checks without throwing errors', () => {
    const results = runChecksOnHtml({
      url: 'https://acme.com/',
      html: HTML_BASIC,
      site: {
        domain: 'acme.com',
        homepageUrl: 'https://acme.com',
        targetLocale: 'en-US'
      }
    });

    expect(results).toHaveLength(13); // 13 checks total
    expect(results.every(r => typeof r.score === 'number')).toBe(true);
    expect(results.every(r => r.score >= 0 && r.score <= 100)).toBe(true);
    expect(results.every(r => ['ok', 'warn', 'fail', 'not_applicable', 'error'].includes(r.status))).toBe(true);
  });

  it('scores good HTML positively', () => {
    const results = runChecksOnHtml({
      url: 'https://acme.com/',
      html: HTML_BASIC,
      site: { domain: 'acme.com', homepageUrl: 'https://acme.com', targetLocale: 'en-US' }
    });

    const byId = Object.fromEntries(results.map(r => [r.id, r]));

    // Title with brand should score well
    expect(byId['C1_title_quality'].score).toBeGreaterThan(60);
    
    // Meta description present
    expect(byId['C2_meta_description'].score).toBeGreaterThan(60);
    
    // Single H1
    expect(byId['C3_h1_presence'].score).toBe(100);
    
    // Mobile viewport
    expect(byId['T1_mobile_viewport'].score).toBe(100);
    
    // Canonical correct
    expect(byId['G10_canonical'].score).toBeGreaterThan(50);
    
    // No noindex
    expect(byId['T3_noindex_robots'].score).toBe(100);
    
    // Organization schema present
    expect(byId['A12_entity_graph'].score).toBeGreaterThan(0);
  });

  it('detects FAQ schema correctly', () => {
    const results = runChecksOnHtml({
      url: 'https://acme.com/faq',
      html: HTML_FAQ,
      site: { domain: 'acme.com', homepageUrl: 'https://acme.com', targetLocale: 'en-US' }
    });

    const byId = Object.fromEntries(results.map(r => [r.id, r]));

    // FAQ presence should score high (100 with details + FAQ heading)
    expect(byId['A3_faq_presence'].score).toBeGreaterThanOrEqual(60);
    
    // FAQPage schema should be valid
    expect(byId['A4_schema_faqpage'].score).toBe(100);
  });

  it('scores poor HTML negatively', () => {
    const results = runChecksOnHtml({
      url: 'https://example.com/',
      html: HTML_POOR,
      site: { domain: 'example.com', homepageUrl: 'https://example.com', targetLocale: 'en' }
    });

    const byId = Object.fromEntries(results.map(r => [r.id, r]));

    // Short generic title
    expect(byId['C1_title_quality'].score).toBeLessThan(50);
    
    // No meta description
    expect(byId['C2_meta_description'].score).toBe(0);
    
    // No viewport
    expect(byId['T1_mobile_viewport'].score).toBe(0);
    
    // No canonical
    expect(byId['G10_canonical'].score).toBe(0);
    
    // Semantic heading issues (H1 → H3 skip)
    expect(byId['A2_headings_semantic'].score).toBeLessThan(100);
  });

  it('handles errors gracefully', () => {
    const results = runChecksOnHtml({
      url: 'https://example.com/',
      html: '<html><body>Minimal</body></html>',
      site: { domain: 'example.com', homepageUrl: 'https://example.com' }
    });

    // Should return results for all checks, even if some fail
    expect(results).toHaveLength(13);
    
    // No check should have status 'error' (they should handle gracefully)
    const errors = results.filter(r => r.status === 'error');
    expect(errors.length).toBe(0);
  });

  it('includes scope metadata on all checks', () => {
    const results = runChecksOnHtml({
      url: 'https://example.com/',
      html: HTML_BASIC,
      site: { domain: 'example.com', homepageUrl: 'https://example.com' }
    });

    // All checks should have scope: "page"
    expect(results.every(r => r.scope === 'page')).toBe(true);
  });
});


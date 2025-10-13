/**
 * Tests for Phase Next Detectors
 */

import { describe, it, expect } from 'vitest';
import { classifyPageType } from '../detectors/page-type-classifier';
import { validateSchemaFitness } from '../detectors/schema-fitness';
import { analyzeAnswerFitness } from '../detectors/answer-fitness';
import { analyzeEEAT } from '../detectors/eeat-detector';
import { calculateRenderParity } from '../detectors/render-parity';

describe('Page Type Classifier', () => {
  it('should classify FAQ pages correctly', () => {
    const result = classifyPageType(
      'https://example.com/faq',
      '<h1>Frequently Asked Questions</h1><div itemscope itemtype="https://schema.org/FAQPage">',
      'FAQ - Example',
      'Frequently Asked Questions'
    );
    
    expect(result.type).toBe('faq');
    expect(result.confidence).toBeGreaterThan(50);
  });

  it('should classify product pages correctly', () => {
    const result = classifyPageType(
      'https://example.com/product/widget',
      '<h1>Widget Pro</h1><span itemprop="price">$99.99</span>',
      'Widget Pro - Example',
      'Widget Pro'
    );
    
    expect(result.type).toBe('product');
    expect(result.confidence).toBeGreaterThan(50);
  });

  it('should classify article pages correctly', () => {
    const result = classifyPageType(
      'https://example.com/blog/article',
      '<article><h1>How to Build a Website</h1><p>Published on 2024-01-01</p></article>',
      'How to Build a Website - Example Blog',
      'How to Build a Website'
    );
    
    expect(result.type).toBe('article');
    expect(result.confidence).toBeGreaterThan(50);
  });
});

describe('Schema Fitness Validator', () => {
  it('should validate Article schema correctly', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@type": "Article",
        "headline": "Test Article",
        "author": {
          "@type": "Person",
          "name": "John Doe"
        },
        "datePublished": "2024-01-01"
      }
      </script>
    `;
    
    const result = validateSchemaFitness(html, 'article');
    
    expect(result.valid).toBe(true);
    expect(result.fitness).toBeGreaterThan(80);
    expect(result.type).toBe('Article');
  });

  it('should validate Product schema correctly', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@type": "Product",
        "name": "Test Product",
        "offers": {
          "@type": "Offer",
          "price": "99.99"
        }
      }
      </script>
    `;
    
    const result = validateSchemaFitness(html, 'product');
    
    expect(result.valid).toBe(true);
    expect(result.fitness).toBeGreaterThan(80);
    expect(result.type).toBe('Product');
  });

  it('should detect missing required properties', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@type": "Article",
        "headline": "Test Article"
      }
      </script>
    `;
    
    const result = validateSchemaFitness(html, 'article');
    
    expect(result.valid).toBe(false);
    expect(result.missingProps).toContain('author');
    expect(result.missingProps).toContain('datePublished');
  });
});

describe('Answer Fitness Detector', () => {
  it('should analyze content fitness correctly', () => {
    const html = `
      <h1>How to Build a Website</h1>
      <h2>Step 1: Choose a Platform</h2>
      <p>First, you need to choose a platform for your website...</p>
      <h2>Step 2: Get Hosting</h2>
      <p>Next, you'll need to get hosting for your website...</p>
      <h3>FAQ</h3>
      <p>What is the best platform? WordPress is a popular choice...</p>
    `;
    
    const result = analyzeAnswerFitness(html, 'How to Build a Website', 'How to Build a Website');
    
    expect(result.fitness).toBeGreaterThan(50);
    expect(result.chunkability).toBeGreaterThan(0);
    expect(result.qaScaffolds).toBeGreaterThan(0);
    expect(result.breakdown.headingHierarchy).toBe(true);
  });

  it('should detect Q&A scaffolds', () => {
    const html = `
      <h1>FAQ</h1>
      <h2>What is this?</h2>
      <p>This is a frequently asked question...</p>
      <h2>How do I use it?</h2>
      <p>You can use it by following these steps...</p>
    `;
    
    const result = analyzeAnswerFitness(html, 'FAQ', 'FAQ');
    
    expect(result.qaScaffolds).toBeGreaterThan(50);
    expect(result.breakdown.qaSections).toBeGreaterThan(0);
  });
});

describe('E-E-A-T Detector', () => {
  it('should analyze E-E-A-T signals correctly', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@type": "Person",
        "name": "John Doe",
        "sameAs": ["https://linkedin.com/in/johndoe", "https://github.com/johndoe"]
      }
      </script>
      <h1>Our Research Shows</h1>
      <p>Based on our testing, we found that...</p>
      <img src="/screenshots/test-results.png" alt="Test Results">
    `;
    
    const result = analyzeEEAT(html, 'https://example.com', 'Research Article', 'Our Research Shows');
    
    expect(result.overall).toBeGreaterThan(50);
    expect(result.expertise).toBeGreaterThan(50);
    expect(result.experience).toBeGreaterThan(50);
    expect(result.breakdown.expertise.personSchema).toBe(true);
    expect(result.breakdown.expertise.sameAsLinks).toBeGreaterThan(0);
  });
});

describe('Render Parity Detector', () => {
  it('should calculate similarity correctly', async () => {
    const html = '<h1>Hello World</h1><p>This is a test.</p>';
    const renderedText = 'Hello World This is a test.';
    
    const result = await calculateRenderParity(html, renderedText);
    
    expect(result.similarity).toBeGreaterThan(90);
    expect(result.rawTextLength).toBeGreaterThan(0);
    expect(result.renderedTextLength).toBeGreaterThan(0);
  });

  it('should detect differences', async () => {
    const html = '<h1>Hello World</h1><p>This is a test.</p>';
    const renderedText = 'Hello Universe This is a different test.';
    
    const result = await calculateRenderParity(html, renderedText);
    
    expect(result.similarity).toBeLessThan(90);
    expect(result.differences.length).toBeGreaterThan(0);
  });
});
